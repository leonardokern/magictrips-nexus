"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModalLoader } from "@/components/ui/modal-loader"
import { VendaResumoPanel } from "./venda-resumo-panel"
import { getVendaDetalhes, type VendaDetalhes } from "@/app/(dashboard)/vendas/actions"

type Props = {
  vendaId: string
  identificador: string
  mostraComissao?: boolean
}

export function VerVendaLink({ vendaId, identificador, mostraComissao = false }: Props) {
  const [open, setOpen] = useState(false)
  const [detalhes, setDetalhes] = useState<VendaDetalhes | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (detalhes) return
    let cancelado = false
    setLoading(true)
    getVendaDetalhes(vendaId).then((r) => {
      if (cancelado) return
      if (r.ok && r.data) setDetalhes(r.data)
      else if (!r.ok) toast.error(r.error ?? "Erro ao carregar venda.")
      setLoading(false)
    })
    return () => { cancelado = true }
  }, [open, vendaId, detalhes])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-xs text-nexus-bright underline-offset-2 hover:underline"
      >
        {identificador}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
            <DialogTitle className="font-mono text-base">{identificador}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading && <ModalLoader label="Carregando venda…" />}
            {!loading && detalhes && (
              <VendaResumoPanel
                detalhes={detalhes}
                mostraComissao={mostraComissao}
                vendaId={vendaId}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
