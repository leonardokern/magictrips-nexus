"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
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
import { UsuarioFormModal } from "./usuario-form-modal"
import { toggleUsuarioAtivo } from "@/app/(dashboard)/usuarios/actions"
import { cn } from "@/lib/utils"
import { IconTooltip } from "@/components/ui/tooltip"

type Perfil = { id: string; nome: string; empresa_id: string | null }
type Empresa = { id: string; nome: string; slug: string }

type Props = {
  usuario: {
    id: string
    nome: string
    email: string
    perfil_id: string
    perfil_nome: string
    empresa_ids: string[]
    ativo: boolean
    foto_url?: string | null
  }
  perfis: Perfil[]
  empresas: Empresa[]
  podeEditar: boolean
  isSelf: boolean
}

export function UsuarioRowActions({
  usuario,
  perfis,
  empresas,
  podeEditar,
  isSelf,
}: Props) {
  const router = useRouter()
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isAdmin = usuario.perfil_nome === "Administrador"

  function onToggleConfirmed() {
    const novoAtivo = !usuario.ativo
    startTransition(async () => {
      const r = await toggleUsuarioAtivo(usuario.id, novoAtivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(novoAtivo ? "Usuário ativado." : "Usuário inativado.")
      setConfirmOpen(false)
      router.refresh()
    })
  }

  const initialPayload = {
    nome: usuario.nome,
    email: usuario.email,
    perfil_id: usuario.perfil_id,
    empresa_ids: usuario.empresa_ids,
    foto_url: usuario.foto_url,
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
            label={
              isAdmin
                ? "O Administrador Master não pode ser editado por aqui"
                : "Editar"
            }
            onClick={() => setEditOpen(true)}
            disabled={isAdmin}
            tone="bright"
          />
          <IconAction
            icon={Power}
            label={
              isAdmin
                ? "O Administrador Master não pode ser inativado"
                : isSelf
                  ? "Você não pode inativar o próprio usuário"
                  : usuario.ativo
                    ? "Inativar"
                    : "Ativar"
            }
            onClick={() => setConfirmOpen(true)}
            disabled={isPending || isSelf || isAdmin}
            tone={usuario.ativo ? "amber" : "emerald"}
          />
        </>
      )}

      {/* Modal de visualização (read-only) */}
      <UsuarioFormModal
        mode="edit"
        id={usuario.id}
        initial={initialPayload}
        open={viewOpen}
        onOpenChange={setViewOpen}
        perfis={perfis}
        empresas={empresas}
        readOnly
      />

      {/* Modal de edição */}
      <UsuarioFormModal
        mode="edit"
        id={usuario.id}
        initial={initialPayload}
        open={editOpen}
        onOpenChange={setEditOpen}
        perfis={perfis}
        empresas={empresas}
      />

      {/* Confirmação de ativar/inativar */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {usuario.ativo ? "Inativar usuário?" : "Ativar usuário?"}
            </DialogTitle>
            <DialogDescription>
              {usuario.ativo ? (
                <>
                  <strong className="text-white">{usuario.nome}</strong> não
                  conseguirá mais fazer login no sistema. O histórico de ações
                  fica preservado. Você pode reativar a qualquer momento.
                </>
              ) : (
                <>
                  <strong className="text-white">{usuario.nome}</strong> voltará
                  a poder fazer login com a senha atual.
                </>
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
                usuario.ativo
                  ? "bg-amber-500 text-white hover:bg-amber-500/90"
                  : "bg-emerald-500 text-white hover:bg-emerald-500/90"
              }
            >
              {usuario.ativo ? "Inativar" : "Ativar"}
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Link export kept for callers that prefer plain navigation (no current usage)
export { Link }

// ─── Icon button ────────────────────────────────────────────────────────────

type IconActionProps = {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  tone: "neutral" | "bright" | "amber" | "emerald"
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: IconActionProps) {
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
