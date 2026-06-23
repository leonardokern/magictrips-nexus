"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GerarFaturaModal } from "./gerar-fatura-modal"
import type { ClienteComParcelas } from "@/app/(dashboard)/financeiro/actions"

export function GerarFaturaModalTrigger({
  clientes,
}: {
  clientes: ClienteComParcelas[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-1.5 bg-nexus-bright text-white hover:bg-nexus-bright/90"
        disabled={clientes.length === 0}
        title={clientes.length === 0 ? "Nenhum cliente com parcelas pendentes" : undefined}
      >
        <FileText className="h-4 w-4" />
        Gerar Fatura
      </Button>
      <GerarFaturaModal
        open={open}
        onClose={() => setOpen(false)}
        clientes={clientes}
      />
    </>
  )
}
