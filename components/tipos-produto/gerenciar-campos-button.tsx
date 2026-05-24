"use client"

import { useState } from "react"
import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GerenciarCamposModal } from "./gerenciar-campos-modal"

type Props = {
  podeCriar: boolean
  podeEditar: boolean
  podeExcluir: boolean
}

export function GerenciarCamposButton({
  podeCriar,
  podeEditar,
  podeExcluir,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.04] hover:text-white"
      >
        <Settings2 className="mr-2 h-4 w-4" />
        Gerenciar campos
      </Button>
      <GerenciarCamposModal
        open={open}
        onOpenChange={setOpen}
        podeCriar={podeCriar}
        podeEditar={podeEditar}
        podeExcluir={podeExcluir}
      />
    </>
  )
}
