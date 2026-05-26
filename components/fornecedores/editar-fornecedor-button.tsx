"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FornecedorFormModal } from "./fornecedor-form-modal"
import type { TipoFornecedor } from "@/lib/schemas/fornecedor"

type TipoProduto = { id: string; nome: string; icone: string | null }

type Props = {
  id: string
  initial: {
    nome: string
    cnpj: string
    tipo: TipoFornecedor | null
    tiposProdutoIds: string[]
    modoComissionado: boolean
    modoComissionadoDia: number | null
    modoNet: boolean
  }
  tiposProduto: TipoProduto[]
}

export function EditarFornecedorButton({ id, initial, tiposProduto }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
      >
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Button>
      <FornecedorFormModal
        mode="edit"
        id={id}
        initial={initial}
        open={open}
        onOpenChange={setOpen}
        tiposProduto={tiposProduto}
      />
    </>
  )
}
