"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Power, Trash2, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  PacoteFormModal,
  type FornecedorOpcao,
  type TipoProdutoOpcao,
} from "./pacote-form-modal"
import { PacoteViewModal } from "./pacote-view-modal"
import type { CampoDinamico } from "@/components/shared/campo-dinamico-input"
import {
  deletePacote,
  togglePacoteAtivo,
} from "@/app/(dashboard)/pacotes/actions"
import type { TipoPacote } from "@/lib/schemas/pacote"
import { cn } from "@/lib/utils"
import { IconTooltip } from "@/components/ui/tooltip"

export type PacoteRow = {
  id: string
  nome: string
  descricao: string | null
  tipo_pacote: TipoPacote
  data_inicio_viagem: string
  data_fim_viagem: string
  tipo_produto_id: string | null
  fornecedor_id: string | null
  valor_custo_total: number | null
  valores_extras: Record<string, string>
  ativo: boolean
  itens: {
    tipo_produto_id: string
    descricao: string | null
    valores_extras: Record<string, string>
    ordem: number
    fornecedores: { fornecedor_id: string; valor_custo: number; ordem: number }[]
  }[]
}

type Props = {
  pacote: PacoteRow
  tiposProduto: TipoProdutoOpcao[]
  fornecedores: FornecedorOpcao[]
  camposExtra: CampoDinamico[]
  empresaId: string
  podeEditar: boolean
  podeExcluir: boolean
}

export function PacoteRowActions({
  pacote: p,
  tiposProduto,
  fornecedores,
  camposExtra,
  empresaId,
  podeEditar,
  podeExcluir,
}: Props) {
  const router = useRouter()
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const initial = {
    nome: p.nome,
    descricao: p.descricao,
    tipo_pacote: p.tipo_pacote,
    data_inicio_viagem: p.data_inicio_viagem,
    data_fim_viagem: p.data_fim_viagem,
    tipo_produto_id: p.tipo_produto_id,
    fornecedor_id: p.fornecedor_id,
    valor_custo_total: p.valor_custo_total,
    valores_extras: p.valores_extras,
    itens: p.itens,
  }

  function onToggleConfirmed() {
    const novoAtivo = !p.ativo
    startTransition(async () => {
      const r = await togglePacoteAtivo(p.id, novoAtivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(novoAtivo ? "Pacote ativado." : "Pacote inativado.")
      setConfirmOpen(false)
      router.refresh()
    })
  }

  function onDeleteConfirmed() {
    startTransition(async () => {
      const r = await deletePacote(p.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Pacote excluído.")
      setDeleteOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <IconAction icon={Eye} label="Visualizar" onClick={() => setViewOpen(true)} tone="neutral" />

      {podeEditar && (
        <>
          <IconAction icon={Pencil} label="Editar" onClick={() => setEditOpen(true)} tone="bright" />
          <IconAction
            icon={Power}
            label={p.ativo ? "Inativar" : "Ativar"}
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            tone={p.ativo ? "amber" : "emerald"}
          />
        </>
      )}

      {podeExcluir && (
        <IconAction
          icon={Trash2}
          label="Excluir"
          onClick={() => setDeleteOpen(true)}
          disabled={isPending}
          tone="rose"
        />
      )}

      {/* Modal: visualizar (card somente leitura) */}
      <PacoteViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        pacote={p}
        tiposProduto={tiposProduto}
        fornecedores={fornecedores}
        camposExtra={camposExtra}
      />

      {/* Modal: editar */}
      <PacoteFormModal
        mode="edit"
        id={p.id}
        initial={initial}
        open={editOpen}
        onOpenChange={setEditOpen}
        tiposProduto={tiposProduto}
        fornecedores={fornecedores}
        camposExtra={camposExtra}
        empresaId={empresaId}
      />

      {/* Confirmação: ativar / inativar */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{p.ativo ? "Inativar pacote?" : "Ativar pacote?"}</DialogTitle>
            <DialogDescription>
              {p.ativo ? (
                <>
                  <strong className="text-white">{p.nome}</strong> não aparecerá
                  mais como opção nas vendas. O histórico fica preservado. Você
                  pode reativar a qualquer momento.
                </>
              ) : (
                <>
                  <strong className="text-white">{p.nome}</strong> voltará a
                  aparecer como opção nas vendas.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>Cancelar</Button>
            </DialogClose>
            <LoaderButton
              onClick={onToggleConfirmed}
              loading={isPending}
              className={
                p.ativo
                  ? "bg-amber-500 text-white hover:bg-amber-500/90"
                  : "bg-emerald-500 text-white hover:bg-emerald-500/90"
              }
            >
              {p.ativo ? "Inativar" : "Ativar"}
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: excluir */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir pacote?</DialogTitle>
            <DialogDescription>
              <strong className="text-white">{p.nome}</strong> será removido
              permanentemente. Essa ação não pode ser desfeita. Pacotes com
              vendas já registradas não podem ser excluídos — inative-os em vez
              disso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>Cancelar</Button>
            </DialogClose>
            <LoaderButton
              variant="destructive"
              onClick={onDeleteConfirmed}
              loading={isPending}
            >
              Excluir
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Icon button ─────────────────────────────────────────────────────────────

type IconActionProps = {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  tone: "neutral" | "bright" | "amber" | "emerald" | "rose"
}

function IconAction({ icon: Icon, label, onClick, disabled, tone }: IconActionProps) {
  const toneClass: Record<typeof tone, string> = {
    neutral:
      "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.07] hover:text-white",
    bright:
      "border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright hover:border-nexus-bright/50 hover:bg-nexus-bright/15",
    amber:
      "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-200",
    emerald:
      "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/15 hover:text-emerald-200",
    rose: "border-rose-500/25 bg-rose-500/[0.08] text-rose-300 hover:border-rose-500/50 hover:bg-rose-500/15 hover:text-rose-200",
  }
  return (
    <IconTooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          toneClass[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </IconTooltip>
  )
}
