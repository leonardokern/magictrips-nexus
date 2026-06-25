"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ExternalLink, FileText, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import { formatBRL } from "@/lib/utils/sum-parser"
import { excluirEventoManual, type AgendaEvento } from "@/app/(dashboard)/agenda/actions"
import {
  getClientesComParcelasPendentes,
  getDetalheParcelaParaAgenda,
  type ClienteComParcelas,
  type DetalheParcelaAgenda,
} from "@/app/(dashboard)/financeiro/actions"
import { GerarFaturaModal } from "@/components/financeiro/gerar-fatura-modal"
import { useRouter } from "next/navigation"

type Props = {
  evento: AgendaEvento | null
  onClose: () => void
  /** Callback chamado depois de excluir com sucesso — usado pra recarregar o calendário. */
  onDeleted?: () => void
}

const TIPO_LABEL: Record<AgendaEvento["tipo"], string> = {
  conta_receber: "Conta a receber",
  cartao_fechamento: "Fechamento de cartão",
  cartao_vencimento: "Vencimento de cartão",
  viagem_inicio: "Início de viagem",
  lembrete: "Lembrete do sistema",
  nota: "Nota",
  reuniao: "Reunião",
  tarefa: "Tarefa",
  outro: "Outro",
}

export function EventoDetalhePopover({ evento, onClose, onDeleted }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Estado extra pra eventos de conta_receber: carrega cliente da parcela +
  // faturas já vinculadas. O id da parcela vive no event.id como `pr-{uuid}`.
  const [detalheParcela, setDetalheParcela] =
    useState<DetalheParcelaAgenda | null>(null)
  const [clientesParaFatura, setClientesParaFatura] = useState<
    ClienteComParcelas[]
  >([])
  const [gerarFaturaOpen, setGerarFaturaOpen] = useState(false)

  const isContaReceber = evento?.tipo === "conta_receber"
  const parcelaId =
    isContaReceber && evento?.id?.startsWith("pr-")
      ? evento.id.slice(3)
      : null

  useEffect(() => {
    setDetalheParcela(null)
    if (!parcelaId) return
    let cancelled = false
    ;(async () => {
      const [det, clientes] = await Promise.all([
        getDetalheParcelaParaAgenda(parcelaId),
        getClientesComParcelasPendentes(),
      ])
      if (cancelled) return
      setDetalheParcela(det)
      setClientesParaFatura(clientes)
    })()
    return () => {
      cancelled = true
    }
  }, [parcelaId])

  if (!evento) return null

  const ehManual =
    evento.tipo === "nota" ||
    evento.tipo === "reuniao" ||
    evento.tipo === "tarefa" ||
    evento.tipo === "outro"

  const linkInterno =
    evento.referenciaTipo === "venda" && evento.referenciaId
      ? `/vendas?venda=${evento.referenciaId}`
      : null

  function excluir() {
    if (!evento) return
    if (!confirm("Excluir este evento?")) return
    startTransition(async () => {
      const r = await excluirEventoManual(evento.referenciaId ?? "")
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Evento excluído.")
      onClose()
      // Avisa o calendário pra recarregar a lista de eventos do client state
      onDeleted?.()
      // Revalida server components (caso outra parte da página dependa)
      router.refresh()
    })
  }

  return (
    <Dialog open={!!evento} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* Título = TIPO do evento (ex: "Fechamento de cartão"); o título
              específico do registro vai pro body como "Identificação". */}
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: evento.cor }}
            />
            <DialogTitle className="text-base">
              {TIPO_LABEL[evento.tipo] ?? evento.tipo}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs uppercase tracking-wider text-white/45">
            {formatDateBR(evento.dia)}
            {evento.horaInicio && (
              <>
                {" "}
                · <span className="tabular-nums">{evento.horaInicio}</span>
                {evento.horaFim && (
                  <>
                    {" – "}
                    <span className="tabular-nums">{evento.horaFim}</span>
                  </>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Identificação — título específico do evento (ex: nome do cartão,
              identificador da venda, título da nota). */}
          <CampoDetalhe label="Identificação" value={evento.titulo} />

          {evento.descricao && (
            <CampoDetalhe label="Descrição" value={evento.descricao} />
          )}

          {evento.valor != null && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/45">
                Valor
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                {formatBRL(evento.valor)}
              </p>
            </div>
          )}

          {/* Vínculo a outra entidade do sistema (venda, fornecedor, cartão…) */}
          {evento.referenciaTipo && (
            <CampoDetalhe
              label="Vinculado a"
              value={
                REFERENCIA_LABEL[evento.referenciaTipo] ?? evento.referenciaTipo
              }
            />
          )}

          {/* IDs internos — utilidade pra suporte/debug, com fonte mono e cinza */}
          {evento.referenciaId && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/45">
                ID do registro
              </p>
              <p className="mt-1 truncate font-mono text-[11px] text-white/45">
                {evento.referenciaId}
              </p>
            </div>
          )}

          {/* Faturas já vinculadas a essa parcela — só em conta_receber.
              Cada item abre o PDF da fatura em nova aba. */}
          {isContaReceber && detalheParcela && detalheParcela.faturas.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/45">
                {detalheParcela.faturas.length === 1
                  ? "Fatura vinculada"
                  : "Faturas vinculadas"}
              </p>
              <ul className="mt-1 space-y-1">
                {detalheParcela.faturas.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/api/faturas/${f.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] px-2 py-1 text-xs text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
                    >
                      <FileText className="h-3 w-3" />
                      {f.numero_display}
                      <ExternalLink className="h-3 w-3 opacity-70" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2">
          {ehManual ? (
            <Button
              variant="outline"
              size="sm"
              onClick={excluir}
              disabled={isPending}
              className="border-rose-500/25 bg-rose-500/[0.08] text-rose-300 hover:border-rose-500/50 hover:bg-rose-500/15"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {isPending ? "Excluindo…" : "Excluir"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex flex-wrap gap-2">
            {/* Gerar fatura — só pra conta_receber, abre modal stacked com
                cliente pré-selecionado. Esconde o link "Abrir venda" pra
                priorizar a ação primária da agenda financeira. */}
            {isContaReceber && detalheParcela?.cliente_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGerarFaturaOpen(true)}
                className="border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15"
              >
                <FileText className="mr-2 h-3.5 w-3.5" />
                Gerar Fatura
              </Button>
            )}
            {linkInterno && (
              <Link href={linkInterno} onClick={onClose}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Abrir venda
                </Button>
              </Link>
            )}
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                Fechar
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Modal stacked — Radix Dialog suporta nested dialogs.
          O cliente vem pré-selecionado via initialClienteId. */}
      {isContaReceber && detalheParcela?.cliente_id && (
        <GerarFaturaModal
          open={gerarFaturaOpen}
          onClose={() => setGerarFaturaOpen(false)}
          clientes={clientesParaFatura}
          initialClienteId={detalheParcela.cliente_id}
        />
      )}
    </Dialog>
  )
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

const REFERENCIA_LABEL: Record<string, string> = {
  venda: "Venda",
  cartao: "Cartão",
  parcela_receber: "Parcela a receber",
  parcela_pagar: "Parcela a pagar",
  lembrete: "Lembrete",
  agenda: "Evento manual",
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  usuario: "Usuário",
}

function CampoDetalhe({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line break-words text-white/85">
        {value}
      </p>
    </div>
  )
}

// suprimir warning de import não usado
void LoaderButton
