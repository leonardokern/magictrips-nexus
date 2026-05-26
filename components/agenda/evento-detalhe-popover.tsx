"use client"

import { useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Trash2, ExternalLink } from "lucide-react"
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
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: evento.cor }}
            />
            <DialogTitle className="text-base">{evento.titulo}</DialogTitle>
          </div>
          <DialogDescription className="text-xs uppercase tracking-wider text-white/45">
            {TIPO_LABEL[evento.tipo] ?? evento.tipo} · {formatDateBR(evento.dia)}
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
          {evento.descricao && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/45">
                Descrição
              </p>
              <p className="mt-1 text-white/85">{evento.descricao}</p>
            </div>
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
          <div className="flex gap-2">
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
    </Dialog>
  )
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

// suprimir warning de import não usado
void LoaderButton
