"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Pencil,
  Percent,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react"
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
import { PerfilFormModal } from "./perfil-form-modal"
import { deletePerfil } from "@/app/(dashboard)/perfis/actions"
import type { PerfilTipo, PermissoesValue } from "@/lib/schemas/perfil"
import { cn } from "@/lib/utils"
import { IconTooltip } from "@/components/ui/tooltip"

type Empresa = { id: string; nome: string; slug: string }

type Props = {
  perfil: {
    id: string
    nome: string
    tipo: PerfilTipo
    empresa_id: string | null
    permissoes: PermissoesValue
    ativo: boolean
    comissoes: Record<string, number>
    /** Vem do seed (sistema=true) — bloqueia exclusão por UI. */
    sistema: boolean
    /** Chave estável: 'admin'|'gerente'|'agente' ou null pra perfis customizados. */
    chave_sistema: "admin" | "gerente" | "agente" | null
  }
  empresas: Empresa[]
  usuariosCount: number
  podeEditar: boolean
  agendaEnabled?: boolean
  propostasEnabled?: boolean
}

export function PerfilRowActions({
  perfil,
  empresas,
  usuariosCount,
  podeEditar,
  agendaEnabled,
  propostasEnabled,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isAdmin = perfil.chave_sistema === "admin"
  // Único bloqueio: ter usuário atrelado. Perfis do sistema (sistema=true) também
  // podem ser deletados desde que ninguém esteja atrelado a eles.
  const podeExcluir = usuariosCount === 0

  const deleteLabel =
    usuariosCount > 0
      ? `Existem ${usuariosCount} usuário(s) neste perfil — mude-os antes de excluir`
      : "Excluir"

  function abrirEditar(step: 1 | 2 | 3 = 1) {
    setModalStep(step)
    setOpen(true)
  }

  function onDeleteConfirmed() {
    startTransition(async () => {
      const r = await deletePerfil(perfil.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Perfil excluído.")
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {podeEditar && !isAdmin && (
        <>
          <IconAction
            icon={Pencil}
            label="Editar"
            onClick={() => abrirEditar(1)}
            tone="bright"
          />
          <IconAction
            icon={ShieldCheck}
            label="Permissões"
            onClick={() => abrirEditar(2)}
            tone="bright"
          />
          {perfil.tipo === "agente" && (
            <IconAction
              icon={Percent}
              label="Comissões"
              onClick={() => abrirEditar(3)}
              tone="bright"
            />
          )}
          <IconAction
            icon={Trash2}
            label={deleteLabel}
            onClick={() => setConfirmOpen(true)}
            disabled={!podeExcluir}
            tone="rose"
          />
        </>
      )}

      <PerfilFormModal
        mode="edit"
        id={perfil.id}
        initial={{
          nome: perfil.nome,
          tipo: perfil.tipo,
          empresa_id: perfil.empresa_id,
          permissoes: perfil.permissoes,
          comissoes: perfil.comissoes,
        }}
        open={open}
        onOpenChange={setOpen}
        empresas={empresas}
        initialStep={modalStep}
        agendaEnabled={agendaEnabled}
        propostasEnabled={propostasEnabled}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir perfil?</DialogTitle>
            <DialogDescription>
              <strong className="text-white">{perfil.nome}</strong> será removido
              permanentemente. Essa ação não pode ser desfeita. As permissões e
              regras de comissão deste perfil serão apagadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
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

function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  tone: "neutral" | "bright" | "amber" | "emerald" | "rose"
}) {
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
