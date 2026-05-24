"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Power, Trash2 } from "lucide-react"
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
import { CampoExtraFormModal } from "./campo-extra-form-modal"
import {
  deleteCampoExtra,
  toggleCampoExtraAtivo,
} from "@/app/(dashboard)/tipos-produto/actions"
import type { CampoOpcao, TipoCampo } from "@/lib/schemas/tipo-produto"

type Props = {
  campo: {
    id: string
    nome: string
    tipo_campo: TipoCampo
    placeholder: string | null
    ativo: boolean
    opcoes: CampoOpcao[]
  }
  podeEditar: boolean
  podeExcluir: boolean
  /** Callback após qualquer mutação (criar/editar/inativar/excluir). */
  onSuccess?: () => void
}

export function CampoExtraRowActions({
  campo,
  podeEditar,
  podeExcluir,
  onSuccess,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onToggle() {
    const novoAtivo = !campo.ativo
    startTransition(async () => {
      const r = await toggleCampoExtraAtivo(campo.id, novoAtivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(novoAtivo ? "Campo ativado." : "Campo inativado.")
      router.refresh()
      onSuccess?.()
    })
  }

  function onDelete() {
    startTransition(async () => {
      const r = await deleteCampoExtra(campo.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Campo excluído.")
      setConfirmOpen(false)
      router.refresh()
      onSuccess?.()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {podeEditar && (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            className="h-8 px-2 text-xs text-white/75 hover:bg-white/[0.05] hover:text-white"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Editar
          </Button>
          <LoaderButton
            size="sm"
            variant="ghost"
            onClick={onToggle}
            loading={isPending}
            className={
              "h-8 px-2 text-xs " +
              (campo.ativo
                ? "text-amber-300/85 hover:bg-amber-500/10 hover:text-amber-200"
                : "text-emerald-300/85 hover:bg-emerald-500/10 hover:text-emerald-200")
            }
          >
            {!isPending && <Power className="mr-1 h-3.5 w-3.5" />}
            {campo.ativo ? "Inativar" : "Ativar"}
          </LoaderButton>
        </>
      )}

      {podeExcluir && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmOpen(true)}
          className="h-8 px-2 text-xs text-rose-300/85 hover:bg-rose-500/10 hover:text-rose-200"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Remover
        </Button>
      )}

      <CampoExtraFormModal
        mode="edit"
        id={campo.id}
        initial={{
          nome: campo.nome,
          tipo_campo: campo.tipo_campo,
          placeholder: campo.placeholder,
          opcoes: campo.opcoes,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onSuccess}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir campo?</DialogTitle>
            <DialogDescription>
              Isso remove <strong>{campo.nome}</strong> e suas opções. Não dá
              pra excluir se ele estiver vinculado a algum tipo de produto.
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
              onClick={onDelete}
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
