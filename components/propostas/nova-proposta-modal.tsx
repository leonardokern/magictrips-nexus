"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModalLoader } from "@/components/ui/modal-loader"
import { PropostaWizard } from "./proposta-wizard"
import { getDadosNovaProposta, type DadosNovaProposta } from "@/app/(dashboard)/propostas/actions"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NovaPropostaModal({ open, onOpenChange }: Props) {
  const [dados, setDados] = useState<DadosNovaProposta | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setDados(null)
      return
    }
    setLoading(true)
    getDadosNovaProposta().then((r) => {
      if (r.ok) setDados(r.data)
      setLoading(false)
    })
  }, [open])

  function handleSuccess() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
          <DialogTitle>Nova proposta comercial</DialogTitle>
        </DialogHeader>

        {loading || !dados ? (
          <div className="flex-1 py-8">
            <ModalLoader label="Carregando dados..." />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <PropostaWizard
              dados={dados}
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
