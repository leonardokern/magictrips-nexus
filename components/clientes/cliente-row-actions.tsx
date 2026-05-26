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
import { ClienteFormModal } from "./cliente-form-modal"
import { ClienteOverviewModal } from "./cliente-overview-modal"
import { toggleClienteAtivo } from "@/app/(dashboard)/clientes/actions"
import type { ClienteFormValues } from "@/lib/schemas/cliente"
import { cn } from "@/lib/utils"
import { IconTooltip } from "@/components/ui/tooltip"

type Empresa = { id: string; nome: string }

type Props = {
  cliente: {
    id: string
    nome_display: string
    status: "lead" | "ativo" | "inativo"
    /** Payload completo para abrir o form de edição/visualização. */
    initial: Partial<ClienteFormValues>
  }
  empresas: Empresa[]
  defaultEmpresaId?: string
  lockEmpresa?: boolean
  podeEditar: boolean
}

export function ClienteRowActions({
  cliente,
  empresas,
  defaultEmpresaId,
  lockEmpresa,
  podeEditar,
}: Props) {
  const router = useRouter()
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const ativo = cliente.status === "ativo"

  function onToggleConfirmed() {
    startTransition(async () => {
      const r = await toggleClienteAtivo(cliente.id, !ativo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(ativo ? "Cliente inativado." : "Cliente ativado.")
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <IconAction
        icon={Eye}
        label="Visualizar"
        onClick={() => setViewOpen(true)}
        tone="neutral"
      />
      {podeEditar && (
        <>
          <IconAction
            icon={Pencil}
            label="Editar"
            onClick={() => setEditOpen(true)}
            tone="bright"
          />
          <IconAction
            icon={Power}
            label={ativo ? "Inativar" : "Ativar"}
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            tone={ativo ? "amber" : "emerald"}
          />
        </>
      )}

      {/* Visualizar — overview card + lista de vendas */}
      <ClienteOverviewModal
        id={cliente.id}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />

      {/* Editar */}
      <ClienteFormModal
        mode="edit"
        id={cliente.id}
        initial={cliente.initial as ClienteFormValues}
        open={editOpen}
        onOpenChange={setEditOpen}
        empresas={empresas}
        defaultEmpresaId={defaultEmpresaId}
        lockEmpresa={lockEmpresa}
      />

      {/* Confirmação Ativar/Inativar */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ativo ? "Inativar cliente?" : "Ativar cliente?"}
            </DialogTitle>
            <DialogDescription>
              <strong className="text-white">{cliente.nome_display}</strong>{" "}
              {ativo ? (
                <>
                  ficará inativo no sistema. Histórico de vendas preservado.
                  Pode reativar a qualquer momento.
                </>
              ) : (
                <>voltará a aparecer nas listas como ativo.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <LoaderButton
              onClick={onToggleConfirmed}
              loading={isPending}
              className={
                ativo
                  ? "bg-amber-500 text-white hover:bg-amber-500/90"
                  : "bg-emerald-500 text-white hover:bg-emerald-500/90"
              }
            >
              {ativo ? "Inativar" : "Ativar"}
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Icon button (mesmo padrão usuarios/perfis) ─────────────────────────────

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
