"use client"

import { useState } from "react"
import { CheckCircle } from "lucide-react"
import { MarcarFaturaPagaModal } from "./marcar-fatura-paga-modal"
import type { CaixaItem } from "@/app/(dashboard)/cartoes/actions"

type Props = {
  faturaId: string
  faturaNumero: string
  valorTotal: number
  caixas: CaixaItem[]
}

export function FaturaRowActions({ faturaId, faturaNumero, valorTotal, caixas }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Registrar recebimento"
        aria-label="Registrar recebimento"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/15"
      >
        <CheckCircle className="h-4 w-4" />
      </button>

      <MarcarFaturaPagaModal
        open={open}
        onClose={() => setOpen(false)}
        faturaId={faturaId}
        faturaNumero={faturaNumero}
        valorTotal={valorTotal}
        caixas={caixas}
      />
    </>
  )
}
