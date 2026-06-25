"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Eye,
  Pencil,
  CheckCircle,
  RotateCcw,
  Trash2,
  ShieldCheck,
  Receipt,
  FileText,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModalLoader } from "@/components/ui/modal-loader"
import { VendaResumoPanel } from "./venda-resumo-panel"
import { VerVendaOriginalButton } from "./ver-venda-original-button"
import { EditarVendaModal } from "./editar-venda-modal"
import {
  aprovarVenda,
  solicitarRevisaoVenda,
  excluirVenda,
  getVendaDetalhes,
  type VendaDetalhes,
} from "@/app/(dashboard)/vendas/actions"
import { cn } from "@/lib/utils"
import { IconTooltip } from "@/components/ui/tooltip"
import { getStatusLabel, getStatusChip } from "@/lib/utils/venda-status"

/**
 * Lock global por venda.id — coordena auto-abertura via `?venda=<id>`
 * entre as duas instâncias deste componente (desktop + mobile) que
 * compartilham o mesmo URL/searchParams. A primeira a rodar o efeito
 * ganha a corrida e abre o modal; a outra desiste. Liberado quando a URL
 * deixa de apontar pra venda. Sem isso, abriam dois Dialogs Radix
 * stackados em `document.body` (o portal ignora `md:hidden` do parent).
 */
const autoAbertasIdsGlobal = new Set<string>()

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type VendaListItem = {
  id: string
  identificador: string
  status: string
  usuario_id: string
  clienteNome: string
  totalVenda: string
}

type Props = {
  venda: VendaListItem
  /** Usuário pode aprovar/devolver — exibe botões de ação no modal. */
  podeAprovar: boolean
  /** Usuário pode editar (gerente/admin com permissão ou agente dono em_revisao). */
  podeEditar: boolean
  /** Usuário pode excluir esta venda (Admin/Gerente em status aprovado). */
  podeExcluir?: boolean
  /** Exibe coluna de comissão no painel (Admin/Gerente). */
  mostraComissao: boolean
  /** true = Gerente/Admin (Validar Venda). false = Agente dono (resubmeter). */
  modoGerente: boolean
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function VendaRowActions({
  venda,
  podeAprovar,
  podeEditar,
  podeExcluir = false,
  mostraComissao,
  modoGerente,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // ── Estado dos dialogs ──────────────────────────────────────────
  const [viewOpen, setViewOpen] = useState(false)
  const [editarOpen, setEditarOpen] = useState(false)
  const [validarOpen, setValidarOpen] = useState(false)
  const [revisaoOpen, setRevisaoOpen] = useState(false)
  const [excluirOpen, setExcluirOpen] = useState(false)
  const [motivoExcluir, setMotivoExcluir] = useState("")

  // ── Dados lazy do modal de visualização ────────────────────────
  const [detalhes, setDetalhes] = useState<VendaDetalhes | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  // ── Pendências de mutation ──────────────────────────────────────
  const [isPendingAprovar, startAprovar] = useTransition()
  const [isPendingRevisao, startRevisao] = useTransition()
  const [isPendingExcluir, startExcluir] = useTransition()
  const [motivoRevisao, setMotivoRevisao] = useState("")

  // ── Status derivado da venda (pode mudar após reload) ──────────
  const statusAtual = detalhes?.status ?? venda.status
  const podeAcionarModal =
    podeAprovar && statusAtual === "pendente_validacao"
  // Agente dono de uma venda em revisão — pode abrir o editor a partir
  // do modal de visualização (a tabela mostra só o olho nesse status).
  const podeRevisarNoModal = podeEditar && statusAtual === "em_revisao"
  // Quando o criador da venda já é Gerente/Admin, o botão "Solicitar revisão"
  // não faz sentido — ele tem permissão pra editar e aprovar direto. Devolver
  // a venda a si mesmo seria fluxo perdido.
  const criadorEhValidador =
    detalhes?.agentePerfilNome === "Gerente" ||
    detalhes?.agentePerfilNome === "Administrador"

  // Defesa: se `venda.id` mudar (não deveria acontecer com keys corretas,
  // mas garantimos), descarta detalhes pra forçar re-fetch.
  useEffect(() => {
    setDetalhes(null)
  }, [venda.id])

  // Carrega detalhes quando o modal de visualização é aberto.
  // Cancela a fetch se o componente desmontar ou se o modal fechar antes
  // da resposta voltar — evita setState em instância errada.
  useEffect(() => {
    if (!viewOpen) return
    if (detalhes) return // já carregado pra esta venda
    let cancelado = false
    setLoadingDetalhes(true)
    getVendaDetalhes(venda.id).then((r) => {
      if (cancelado) return
      if (r.ok && r.data) setDetalhes(r.data)
      else if (!r.ok) toast.error(r.error ?? "Erro ao carregar venda.")
      setLoadingDetalhes(false)
    })
    return () => {
      cancelado = true
    }
  }, [viewOpen, venda.id, detalhes])

  // Auto-abre o modal de visualização quando vem via ?venda=<id>
  // (notificação clicada no header).
  //
  // Bug histórico: cada venda renderiza DUAS instâncias deste componente
  // (uma no bloco desktop `hidden md:block`, outra no mobile `md:hidden`).
  // As classes responsivas escondem o trigger, mas o Radix Dialog vive
  // em portal no `document.body` — ambas instâncias disparavam
  // `setViewOpen(true)` e dois modais empilhavam (um com dados, outro
  // ainda carregando). O `useRef` local não impede isso, só a re-execução
  // na MESMA instância.
  //
  // Fix: lock global por venda.id no nível do módulo. A primeira instância
  // a rodar o efeito ganha a corrida; a outra vê o set e desiste. Quando a
  // URL deixa de apontar pra esta venda, o lock é liberado pra que uma
  // próxima navegação `?venda=<mesmo id>` possa abrir o modal de novo.
  const jaAutoAbriuRef = useRef(false)
  useEffect(() => {
    const alvo = searchParams.get("venda")

    if (alvo !== venda.id) {
      // URL não aponta mais pra esta venda — libera o lock pra próxima.
      autoAbertasIdsGlobal.delete(venda.id)
      jaAutoAbriuRef.current = false
      return
    }

    if (jaAutoAbriuRef.current) return
    if (autoAbertasIdsGlobal.has(venda.id)) {
      // Outra instância (desktop ou mobile) já abriu — só marca pra não
      // tentar de novo nesta mesma instância.
      jaAutoAbriuRef.current = true
      return
    }

    autoAbertasIdsGlobal.add(venda.id)
    jaAutoAbriuRef.current = true
    setViewOpen(true)
    // Limpa o param na próxima tick — evita conflitar com a abertura
    // do modal e com o `setState` do `setViewOpen` na mesma render.
    queueMicrotask(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("venda")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, venda.id])

  // ── Handlers ────────────────────────────────────────────────────

  function abrirValidar() {
    setViewOpen(false)
    setValidarOpen(true)
  }

  function abrirRevisao() {
    setViewOpen(false)
    setMotivoRevisao("")
    setRevisaoOpen(true)
  }

  function handleAprovar() {
    startAprovar(async () => {
      const r = await aprovarVenda(venda.id)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao aprovar venda.")
        return
      }
      toast.success("Venda aprovada com sucesso.")
      setValidarOpen(false)
      setDetalhes(null) // força reload no próximo open
      router.refresh()
    })
  }

  function handleRevisao() {
    if (!motivoRevisao.trim()) {
      toast.error("Informe o motivo da revisão.")
      return
    }
    startRevisao(async () => {
      const r = await solicitarRevisaoVenda(venda.id, motivoRevisao)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao solicitar revisão.")
        return
      }
      toast.success("Revisão solicitada. Venda devolvida ao agente.")
      setRevisaoOpen(false)
      setDetalhes(null)
      router.refresh()
    })
  }

  function abrirExcluir() {
    setMotivoExcluir("")
    setExcluirOpen(true)
  }

  function handleExcluir() {
    startExcluir(async () => {
      const r = await excluirVenda(venda.id, motivoExcluir)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao excluir venda.")
        return
      }
      toast.success("Venda excluída do sistema.")
      setExcluirOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {/* ── Botões da linha ────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-1.5">
        {(() => {
          // Pra Admin/Gerente sobre uma venda aguardando aprovação, o
          // primeiro botão remete a "revisar/validar", não a "visualizar".
          // Mesmo clique abre o modal — apenas a affordance muda.
          //
          // Em `em_revisao` a venda já foi devolvida ao agente — o gerente
          // só pode visualizar (sem ação de validar pendente); a correção
          // é responsabilidade do agente via botão de editar (lápis).
          const ehRevisao =
            podeAprovar && venda.status === "pendente_validacao"
          return ehRevisao ? (
            <IconAction
              icon={ShieldCheck}
              label="Revisar e validar"
              onClick={() => setViewOpen(true)}
              tone="amber"
            />
          ) : (
            <IconAction
              icon={Eye}
              label="Visualizar venda"
              onClick={() => setViewOpen(true)}
              tone="neutral"
            />
          )
        })()}
        {podeEditar && venda.status !== "em_revisao" && (
          <IconAction
            icon={Pencil}
            label="Editar venda"
            onClick={() => setEditarOpen(true)}
            tone="bright"
          />
        )}
        {/* Em vendas validadas: Comprovante + Relatório antes do Excluir.
            Ambos liberados pra qualquer um que enxergue a venda — o agente
            só vê as próprias por RLS, e os dados (comissão, margem RAV)
            são os mesmos que ele já vê na revisão e no dashboard. */}
        {venda.status === "aprovado" && (
          <>
            <IconLinkAction
              icon={Receipt}
              label="Imprimir comprovante"
              href={`/api/vendas/${venda.id}/comprovante`}
              tone="neutral"
            />
            <IconLinkAction
              icon={FileText}
              label="Imprimir relatório"
              href={`/api/vendas/${venda.id}/relatorio`}
              tone="neutral"
            />
          </>
        )}
        {podeExcluir && (
          <IconAction
            icon={Trash2}
            label="Excluir venda"
            onClick={abrirExcluir}
            tone="rose"
          />
        )}
      </div>

      {/* ── Modal de edição ──────────────────────────────────── */}
      <EditarVendaModal
        vendaId={venda.id}
        open={editarOpen}
        modoGerente={modoGerente}
        onOpenChange={(o) => {
          setEditarOpen(o)
          if (!o) router.refresh()
        }}
      />

      {/* ── Modal de visualização ──────────────────────────────── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base font-semibold text-white">
                {detalhes?.identificador ?? venda.identificador} · {venda.clienteNome}
              </DialogTitle>
              <StatusBadge
                status={detalhes?.status ?? venda.status}
                podeAprovar={podeAprovar}
              />
            </div>
            <DialogDescription className="sr-only">
              Resumo completo da venda {detalhes?.identificador ?? venda.identificador} de {venda.clienteNome}
            </DialogDescription>
          </DialogHeader>

          {/* Corpo */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loadingDetalhes || !detalhes ? (
              <ModalLoader label="Carregando venda…" />
            ) : (
              <VendaResumoPanel
                detalhes={detalhes}
                mostraComissao={true}
                vendaId={venda.id}
                mostraRelatorio={true}
                renderAlteracaoBotoes={(alts) =>
                  alts.map((a) => (
                    <VerVendaOriginalButton
                      key={a.id}
                      vendaId={a.id}
                      identificador={a.identificador}
                    />
                  ))
                }
              />
            )}
          </div>

          {/* Rodapé */}
          <DialogFooter className="shrink-0 border-t border-white/[0.06] bg-card/95 px-6 py-4 backdrop-blur">
            <DialogClose asChild>
              <Button variant="ghost" className="text-white/70">
                Fechar
              </Button>
            </DialogClose>

            {podeAcionarModal && detalhes && (
              <>
                {/* "Solicitar revisão" só faz sentido quando o criador da
                    venda é um Agente — devolver a venda pra um Gerente/Admin
                    seria devolver pra si próprio, já que ele pode editar e
                    aprovar direto. */}
                {!criadorEhValidador && (
                  <Button
                    variant="ghost"
                    onClick={abrirRevisao}
                    className="border border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-200"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Solicitar revisão
                  </Button>
                )}

                <Button
                  onClick={abrirValidar}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Validar venda
                </Button>
              </>
            )}

            {podeRevisarNoModal && detalhes && (
              <Button
                onClick={() => {
                  setViewOpen(false)
                  setEditarOpen(true)
                }}
                className="border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
                variant="ghost"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Revisar e reenviar para validação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: confirmar aprovação ────────────────────────── */}
      <Dialog open={validarOpen} onOpenChange={setValidarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Confirmar aprovação
            </DialogTitle>
            <DialogDescription>
              Você está aprovando a venda de{" "}
              <strong className="text-white">{venda.clienteNome}</strong> no
              valor de{" "}
              <strong className="text-white">{venda.totalVenda}</strong>. Essa
              ação ficará registrada com seu nome e não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPendingAprovar}>
                Cancelar
              </Button>
            </DialogClose>
            <LoaderButton
              onClick={handleAprovar}
              loading={isPendingAprovar}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirmar aprovação
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: solicitar revisão ──────────────────────────── */}
      <Dialog open={revisaoOpen} onOpenChange={setRevisaoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-400" />
              Solicitar revisão
            </DialogTitle>
            <DialogDescription>
              Explique ao agente o que precisa ser corrigido. A venda voltará
              para rascunho e o agente poderá editá-la.
            </DialogDescription>
          </DialogHeader>

          <div className="px-1">
            <Textarea
              placeholder="Descreva o motivo da revisão…"
              value={motivoRevisao}
              onChange={(e) => setMotivoRevisao(e.target.value)}
              rows={4}
              className="resize-none border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:ring-amber-500/40"
              disabled={isPendingRevisao}
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPendingRevisao}>
                Cancelar
              </Button>
            </DialogClose>
            <LoaderButton
              onClick={handleRevisao}
              loading={isPendingRevisao}
              disabled={!motivoRevisao.trim()}
              className="bg-amber-500 text-white hover:bg-amber-500/90"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Solicitar revisão
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: confirmar exclusão ─────────────────────────── */}
      <Dialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-400" />
              Excluir venda
            </DialogTitle>
            <DialogDescription>
              Você está prestes a excluir a venda{" "}
              <strong className="font-mono text-nexus-bright">{venda.identificador}</strong>{" "}
              de <strong className="text-white">{venda.clienteNome}</strong>. A
              ação é <strong className="text-rose-300">irreversível</strong>:
              produtos, passageiros e cobrança serão removidos. Um log de
              auditoria ficará registrado.
            </DialogDescription>
          </DialogHeader>

          <div className="px-1">
            <Textarea
              placeholder="Motivo da exclusão (opcional)…"
              value={motivoExcluir}
              onChange={(e) => setMotivoExcluir(e.target.value)}
              rows={3}
              className="resize-none border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:ring-rose-500/40"
              disabled={isPendingExcluir}
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPendingExcluir}>
                Cancelar
              </Button>
            </DialogClose>
            <LoaderButton
              onClick={handleExcluir}
              loading={isPendingExcluir}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir definitivamente
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Badge de status ─────────────────────────────────────────────────────────

function StatusBadge({
  status,
  podeAprovar,
}: {
  status: string
  podeAprovar: boolean
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        getStatusChip(status),
      )}
    >
      {getStatusLabel(status, { podeAprovar })}
    </span>
  )
}

// ─── Icon button (mesmo padrão de usuarios/usuario-row-actions.tsx) ───────────

type Tone = "neutral" | "bright" | "amber" | "emerald" | "rose"

type IconActionProps = {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  tone: Tone
}

/** Tabela de classes por tom — compartilhada entre IconAction e IconLinkAction. */
const TONE_CLASSES: Record<Tone, string> = {
  neutral:
    "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.07] hover:text-white",
  bright:
    "border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright hover:border-nexus-bright/50 hover:bg-nexus-bright/15",
  amber:
    "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-200",
  emerald:
    "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/15 hover:text-emerald-200",
  rose:
    "border-rose-500/25 bg-rose-500/[0.08] text-rose-300 hover:border-rose-500/50 hover:bg-rose-500/15 hover:text-rose-200",
}

function IconAction({ icon: Icon, label, onClick, disabled, tone }: IconActionProps) {
  return (
    <IconTooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </IconTooltip>
  )
}

/**
 * Variante do IconAction como link <a> — usada pra abrir PDFs em nova aba.
 * Compartilha exatamente o mesmo estilo do IconAction (h-9 w-9, tons,
 * borda) pra manter consistência visual nas linhas da tabela.
 */
function IconLinkAction({
  icon: Icon,
  label,
  href,
  tone,
}: {
  icon: LucideIcon
  label: string
  href: string
  tone: Tone
}) {
  return (
    <IconTooltip label={label}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </a>
    </IconTooltip>
  )
}
