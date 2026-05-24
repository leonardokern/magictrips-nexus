"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { aprovarVenda } from "@/app/(dashboard)/vendas/actions"

type Props = {
  vendaId: string
  clienteNome: string
  totalVenda: string
}

export function AprovarVendaButton({ vendaId, clienteNome, totalVenda }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirmar() {
    startTransition(async () => {
      const r = await aprovarVenda(vendaId)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao aprovar venda.")
      } else {
        toast.success("Venda aprovada com sucesso.")
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-emerald-600 text-white hover:bg-emerald-500"
      >
        <CheckCircle className="mr-2 h-4 w-4" />
        Aprovar venda
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Confirmar aprovação
            </DialogTitle>
            <DialogDescription>
              Você está aprovando a venda de{" "}
              <strong className="text-white">{clienteNome}</strong> no valor de{" "}
              <strong className="text-white">{totalVenda}</strong>. Essa ação
              ficará registrada com seu nome e não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Aprovando…
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar aprovação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
