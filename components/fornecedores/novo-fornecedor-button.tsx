"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FornecedorFormModal } from "./fornecedor-form-modal"

type TipoProduto = { id: string; nome: string; icone: string | null }

type Props = {
  tiposProduto: TipoProduto[]
}

export function NovoFornecedorButton({ tiposProduto }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
      >
        <Plus className="mr-2 h-4 w-4" />
        Novo fornecedor
      </Button>
      <FornecedorFormModal
        mode="create"
        open={open}
        onOpenChange={setOpen}
        tiposProduto={tiposProduto}
      />
    </>
  )
}
