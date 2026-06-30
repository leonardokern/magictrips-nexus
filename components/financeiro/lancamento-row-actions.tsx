"use client"

import { useState, useTransition } from "react"
import { Pencil, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import { cancelarLancamentoManual } from "@/app/(dashboard)/financeiro/actions"
import type { CategoriaFinanceira } from "@/app/(dashboard)/financeiro/actions"
import type { CaixaItem } from "@/app/(dashboard)/cartoes/actions"
import type { CartaoSimples } from "@/components/financeiro/nova-saida-modal"
import {
  LancamentoDetalheModal,
  type LancamentoData,
} from "@/components/financeiro/lancamento-detalhe-modal"

type Props = {
  tipo: "receber" | "pagar"
  parcelaId: string
  descricao: string
  // Dados completos para view/edit — obrigatório para tipo "receber"
  lancamento?: LancamentoData
  categorias?: CategoriaFinanceira[]
  caixas?: CaixaItem[]
  cartoes?: CartaoSimples[]
}

export function LancamentoRowActions({
  tipo,
  parcelaId,
  descricao,
  lancamento,
  categorias = [],
  caixas = [],
  cartoes = [],
}: Props) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openCancel, setOpenCancel] = useState(false)
  const [isPending, startTransition] = useTransition()

  const podeMostrarDetalhe = !!lancamento

  function confirmarCancelamento() {
    startTransition(async () => {
      const r = await cancelarLancamentoManual(tipo, parcelaId)
      if (!r.ok) { toast.error(r.error); return }
      toast.success("Lançamento cancelado.")
      setOpenCancel(false)
    })
  }

  return (
    <>
      {/* Editar */}
      {podeMostrarDetalhe && (
        <button
          onClick={() => setOpenEdit(true)}
          title="Editar lançamento"
          aria-label="Editar lançamento"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}

      {/* Cancelar */}
      <button
        onClick={() => setOpenCancel(true)}
        title="Cancelar lançamento"
        aria-label="Cancelar lançamento"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-500/25 bg-rose-500/[0.08] text-rose-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/15"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Modal de edição */}
      {podeMostrarDetalhe && (
        <LancamentoDetalheModal
          open={openEdit}
          onClose={() => setOpenEdit(false)}
          mode="edit"
          tipo={tipo}
          lancamento={lancamento!}
          categorias={categorias}
          caixas={caixas}
          cartoes={cartoes}
        />
      )}

      {/* Dialog de cancelamento */}
      <Dialog open={openCancel} onOpenChange={(v) => !isPending && setOpenCancel(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-300">
              <X className="h-4 w-4" />
              Cancelar Lançamento
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-white/70">
              Tem certeza que deseja cancelar este lançamento? A operação não pode ser desfeita.
            </p>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-sm text-white truncate">{descricao}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isPending} onClick={() => setOpenCancel(false)}>
              Voltar
            </Button>
            <LoaderButton
              loading={isPending}
              onClick={confirmarCancelamento}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              Confirmar cancelamento
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
