"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ModalLoader } from "@/components/ui/modal-loader"
import { VendaResumoPanel } from "./venda-resumo-panel"
import {
  getVendaDetalhes,
  type VendaDetalhes,
} from "@/app/(dashboard)/vendas/actions"
import { toast } from "sonner"

/**
 * Botão "Ver venda original" do card de comparação de alteração.
 * Abre um Dialog (Radix nested) com a venda original em cima do modal
 * atual da alteração — sem trocar rota nem fechar o contexto atual.
 *
 * O fetch dos detalhes é lazy: só dispara quando o usuário clica.
 */
export function VerVendaOriginalButton({
  vendaId,
  identificador,
}: {
  vendaId: string
  identificador: string
}) {
  const [open, setOpen] = useState(false)
  const [detalhes, setDetalhes] = useState<VendaDetalhes | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setDetalhes(null)
      return
    }
    if (detalhes) return
    let cancelado = false
    setLoading(true)
    getVendaDetalhes(vendaId).then((r) => {
      if (cancelado) return
      if (r.ok && r.data) setDetalhes(r.data)
      else if (!r.ok) toast.error(r.error ?? "Erro ao carregar venda original.")
      setLoading(false)
    })
    return () => {
      cancelado = true
    }
  }, [open, vendaId, detalhes])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white"
      >
        Ver venda original ({identificador})
        <ExternalLink className="h-3 w-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
            <DialogTitle className="text-base font-semibold text-white">
              Venda original · {identificador}
              {detalhes?.clienteNome && (
                <span className="text-white/55"> · {detalhes.clienteNome}</span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detalhes da venda original {identificador}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading || !detalhes ? (
              <ModalLoader label="Carregando venda original…" />
            ) : (
              <VendaResumoPanel
                detalhes={detalhes}
                mostraComissao
                vendaId={vendaId}
                mostraRelatorio={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
