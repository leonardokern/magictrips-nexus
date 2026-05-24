"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, Pencil, CheckCircle, RotateCcw, type LucideIcon } from "lucide-react"
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
import { EditarVendaModal } from "./editar-venda-modal"
import {
  aprovarVenda,
  solicitarRevisaoVenda,
  getVendaDetalhes,
  type VendaDetalhes,
} from "@/app/(dashboard)/vendas/actions"
import { cn } from "@/lib/utils"

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
  mostraComissao,
  modoGerente,
}: Props) {
  const router = useRouter()

  // ── Estado dos dialogs ──────────────────────────────────────────
  const [viewOpen, setViewOpen] = useState(false)
  const [editarOpen, setEditarOpen] = useState(false)
  const [validarOpen, setValidarOpen] = useState(false)
  const [revisaoOpen, setRevisaoOpen] = useState(false)

  // ── Dados lazy do modal de visualização ────────────────────────
  const [detalhes, setDetalhes] = useState<VendaDetalhes | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  // ── Pendências de mutation ──────────────────────────────────────
  const [isPendingAprovar, startAprovar] = useTransition()
  const [isPendingRevisao, startRevisao] = useTransition()
  const [motivoRevisao, setMotivoRevisao] = useState("")

  // ── Status derivado da venda (pode mudar após reload) ──────────
  const statusAtual = detalhes?.status ?? venda.status
  const podeAcionarModal =
    podeAprovar && statusAtual === "pendente_validacao"

  // Carrega detalhes quando o modal de visualização é aberto
  useEffect(() => {
    if (!viewOpen) return
    if (detalhes) return // já carregado
    setLoadingDetalhes(true)
    getVendaDetalhes(venda.id).then((r) => {
      if (r.ok && r.data) setDetalhes(r.data)
      else if (!r.ok) toast.error(r.error ?? "Erro ao carregar venda.")
      setLoadingDetalhes(false)
    })
  }, [viewOpen, venda.id, detalhes])

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

  return (
    <>
      {/* ── Botões da linha ────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-1.5">
        <IconAction
          icon={Eye}
          label="Visualizar venda"
          onClick={() => setViewOpen(true)}
          tone="neutral"
        />
        {podeEditar && (
          <IconAction
            icon={Pencil}
            label="Editar venda"
            onClick={() => setEditarOpen(true)}
            tone="bright"
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
              <StatusBadge status={detalhes?.status ?? venda.status} />
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
                mostraRelatorio={mostraComissao}
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
                <Button
                  variant="ghost"
                  onClick={abrirRevisao}
                  className="border border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-200"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Solicitar revisão
                </Button>

                <Button
                  onClick={abrirValidar}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Validar venda
                </Button>
              </>
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
    </>
  )
}

// ─── Badge de status ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  pendente_validacao: "Aguardando aprovação",
  aprovado: "Aprovada",
  cancelado: "Cancelada",
}

const STATUS_CHIP: Record<string, string> = {
  rascunho: "border-white/15 bg-white/[0.04] text-white/55",
  em_revisao: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  pendente_validacao: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  aprovado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cancelado: "border-rose-500/30 bg-rose-500/10 text-rose-300",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        STATUS_CHIP[status] ?? STATUS_CHIP.rascunho,
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ─── Icon button (mesmo padrão de usuarios/usuario-row-actions.tsx) ───────────

type Tone = "neutral" | "bright" | "amber" | "emerald"

type IconActionProps = {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  tone: Tone
}

function IconAction({ icon: Icon, label, onClick, disabled, tone }: IconActionProps) {
  const toneClass: Record<Tone, string> = {
    neutral:
      "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.07] hover:text-white",
    bright:
      "border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright hover:border-nexus-bright/50 hover:bg-nexus-bright/15",
    amber:
      "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-200",
    emerald:
      "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/15 hover:text-emerald-200",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        toneClass[tone],
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
