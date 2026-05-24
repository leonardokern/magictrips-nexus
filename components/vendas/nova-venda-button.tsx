"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NovaVendaModal } from "./nova-venda-modal"

export function NovaVendaButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nova venda
      </Button>
      <NovaVendaModal open={open} onOpenChange={setOpen} />
    </>
  )
}
