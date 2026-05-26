"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Power, type LucideIcon } from "lucide-react"
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
import { FornecedorFormModal } from "./fornecedor-form-modal"
import { FornecedorViewModal } from "./fornecedor-view-modal"
import { toggleFornecedorAtivo } from "@/app/(dashboard)/fornecedores/actions"
import { cn } from "@/lib/utils"
import { IconTooltip } from "@/components/ui/tooltip"
import type { TipoFornecedor } from "@/lib/schemas/fornecedor"

type TipoProduto = { id: string; nome: string; icone: string | null }

type Props = {
  fornecedor: {
    id: string
    nome: string
    cnpj: string
    tipo: TipoFornecedor | null
    ativo: boolean
    tiposProdutoIds: string[]
    modoComissionado: boolean
    modoComissionadoDia: number | null
    modoNet: boolean
  }
  tiposProduto: TipoProduto[]
  podeEditar: boolean
}

export function FornecedorRowActions({ fornecedor: f, tiposProduto, podeEditar }: Props) {
  const router = useRouter()
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const initial = {
    nome: f.nome,
    cnpj: f.cnpj,
    tipo: f.tipo,
    tiposProdutoIds: f.tiposProdutoIds,
    modoComissionado: f.modoComissionado,
    modoComissionadoDia: f.modoComissionadoDia,
    modoNet: f.modoNet,
  }

  function onToggleConfirmed() {
    const novoAtivo = !f.ativo
    startTransition(async () => {
      const r = await toggleFornecedorAtivo(f.id, novoAtivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(novoAtivo ? "Fornecedor ativado." : "Fornecedor inativado.")
      setConfirmOpen(false)
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
            label={f.ativo ? "Inativar" : "Ativar"}
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            tone={f.ativo ? "amber" : "emerald"}
          />
        </>
      )}

      {/* Modal: visualizar (card) */}
      <FornecedorViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        fornecedor={{
          id: f.id,
          nome: f.nome,
          cnpj: f.cnpj,
          tipo: f.tipo,
          ativo: f.ativo,
          tiposProdutoIds: f.tiposProdutoIds,
          modoComissionado: f.modoComissionado,
          modoComissionadoDia: f.modoComissionadoDia,
          modoNet: f.modoNet,
        }}
        tiposProduto={tiposProduto}
      />

      {/* Modal: editar */}
      <FornecedorFormModal
        mode="edit"
        id={f.id}
        initial={initial}
        open={editOpen}
        onOpenChange={setEditOpen}
        tiposProduto={tiposProduto}
      />

      {/* Confirmação: ativar / inativar */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {f.ativo ? "Inativar fornecedor?" : "Ativar fornecedor?"}
            </DialogTitle>
            <DialogDescription>
              {f.ativo ? (
                <>
                  <strong className="text-white">{f.nome}</strong> não aparecerá
                  mais como opção nas vendas. O histórico fica preservado. Você
                  pode reativar a qualquer momento.
                </>
              ) : (
                <>
                  <strong className="text-white">{f.nome}</strong> voltará a
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
                f.ativo
                  ? "bg-amber-500 text-white hover:bg-amber-500/90"
                  : "bg-emerald-500 text-white hover:bg-emerald-500/90"
              }
            >
              {f.ativo ? "Inativar" : "Ativar"}
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
  tone: "neutral" | "bright" | "amber" | "emerald"
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
