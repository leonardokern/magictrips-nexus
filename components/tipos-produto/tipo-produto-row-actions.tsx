"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Power, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TipoProdutoFormModal } from "./tipo-produto-form-modal"
import {
  deleteTipoProduto,
  toggleTipoProdutoAtivo,
} from "@/app/(dashboard)/tipos-produto/actions"
import type {
  TipoCampo,
  TipoProdutoVinculoCampo,
} from "@/lib/schemas/tipo-produto"

type CampoExtra = { id: string; nome: string; tipo_campo: TipoCampo }

type Props = {
  tipo: {
    id: string
    nome: string
    ativo: boolean
    icone: string | null
    campos: TipoProdutoVinculoCampo[]
  }
  camposDisponiveis: CampoExtra[]
  podeEditar: boolean
  podeExcluir: boolean
}

export function TipoProdutoRowActions({
  tipo,
  camposDisponiveis,
  podeEditar,
  podeExcluir,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onToggle() {
    const novoAtivo = !tipo.ativo
    startTransition(async () => {
      const r = await toggleTipoProdutoAtivo(tipo.id, novoAtivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(novoAtivo ? "Tipo ativado." : "Tipo inativado.")
      router.refresh()
    })
  }

  function onDelete() {
    startTransition(async () => {
      const r = await deleteTipoProduto(tipo.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Tipo excluído.")
      setConfirmOpen(false)
      router.refresh()
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
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            disabled={isPending}
            className={
              "h-8 px-2 text-xs " +
              (tipo.ativo
                ? "text-amber-300/85 hover:bg-amber-500/10 hover:text-amber-200"
                : "text-emerald-300/85 hover:bg-emerald-500/10 hover:text-emerald-200")
            }
          >
            <Power className="mr-1 h-3.5 w-3.5" />
            {tipo.ativo ? "Inativar" : "Ativar"}
          </Button>
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

      <TipoProdutoFormModal
        mode="edit"
        id={tipo.id}
        initial={{ nome: tipo.nome, icone: tipo.icone, campos: tipo.campos }}
        open={editOpen}
        onOpenChange={setEditOpen}
        camposDisponiveis={camposDisponiveis}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir tipo?</DialogTitle>
            <DialogDescription>
              Isso remove <strong>{tipo.nome}</strong> e todos os vínculos com
              campos. Vendas que já usaram este tipo bloqueiam a exclusão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isPending}
            >
              {isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
