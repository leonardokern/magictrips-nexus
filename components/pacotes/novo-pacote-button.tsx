"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PacoteFormModal,
  type FornecedorOpcao,
  type TipoProdutoOpcao,
} from "./pacote-form-modal"
import type { CampoDinamico } from "@/components/shared/campo-dinamico-input"

type Props = {
  tiposProduto: TipoProdutoOpcao[]
  fornecedores: FornecedorOpcao[]
  camposExtra: CampoDinamico[]
  empresaId: string
}

export function NovoPacoteButton({
  tiposProduto,
  fornecedores,
  camposExtra,
  empresaId,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
      >
        <Plus className="mr-2 h-4 w-4" />
        Novo pacote
      </Button>
      <PacoteFormModal
        mode="create"
        open={open}
        onOpenChange={setOpen}
        tiposProduto={tiposProduto}
        fornecedores={fornecedores}
        camposExtra={camposExtra}
        empresaId={empresaId}
      />
    </>
  )
}
