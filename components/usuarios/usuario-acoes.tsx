"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Power, Trash2 } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { SenhaProvisoriaDialog } from "./senha-provisoria-dialog"
import {
  deleteUsuario,
  resetarSenha,
  toggleUsuarioAtivo,
} from "@/app/(dashboard)/usuarios/actions"

type Props = {
  id: string
  nome: string
  ativo: boolean
  isSelf: boolean
  permEditar: boolean
  permExcluir: boolean
}

export function UsuarioAcoes({
  id,
  nome,
  ativo,
  isSelf,
  permEditar,
  permExcluir,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [resetDialog, setResetDialog] = useState(false)
  const [senhaDialog, setSenhaDialog] = useState<string | null>(null)
  const [toggleDialog, setToggleDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)

  function handleReset() {
    startTransition(async () => {
      const r = await resetarSenha(id)
      setResetDialog(false)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      if (r.data) setSenhaDialog(r.data.senhaProvisoria)
    })
  }

  function handleToggle() {
    startTransition(async () => {
      const r = await toggleUsuarioAtivo(id, !ativo)
      setToggleDialog(false)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(ativo ? "Usuário desativado." : "Usuário ativado.")
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteUsuario(id)
      // deleteUsuario faz redirect em caso de sucesso
      if (r && !r.ok) {
        toast.error(r.error)
        setDeleteDialog(false)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {permEditar && (
        <Dialog open={resetDialog} onOpenChange={setResetDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Resetar senha
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resetar senha de {nome}</DialogTitle>
              <DialogDescription>
                Uma nova senha provisória será gerada e exibida na tela. O
                usuário terá que trocá-la no próximo login.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleReset}
                className="bg-indigo-500 text-white hover:bg-indigo-400"
              >
                Gerar nova senha
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {permEditar && !isSelf && (
        <Dialog open={toggleDialog} onOpenChange={setToggleDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
            >
              <Power className="mr-2 h-4 w-4" />
              {ativo ? "Desativar" : "Ativar"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {ativo ? "Desativar" : "Ativar"} {nome}
              </DialogTitle>
              <DialogDescription>
                {ativo
                  ? "Usuário desativado não consegue mais entrar no sistema. As vendas dele permanecem preservadas."
                  : "Reativa o acesso do usuário. Ele poderá entrar normalmente."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleToggle}
                className={
                  ativo
                    ? "bg-amber-500 text-white hover:bg-amber-400"
                    : "bg-emerald-500 text-white hover:bg-emerald-400"
                }
              >
                {ativo ? "Desativar" : "Ativar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {permExcluir && !isSelf && (
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir {nome}</DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. Se o usuário possui vendas
                registradas, a exclusão será bloqueada — desative-o em vez disso.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDelete}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {senhaDialog && (
        <SenhaProvisoriaDialog
          open={Boolean(senhaDialog)}
          onClose={() => {
            setSenhaDialog(null)
            router.refresh()
          }}
          senha={senhaDialog}
          contexto="resetar"
          nome={nome}
        />
      )}
    </div>
  )
}
