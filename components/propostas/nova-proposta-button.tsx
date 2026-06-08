"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NovaPropostaModal } from "./nova-proposta-modal"

export function NovaPropostaButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nova proposta
      </Button>
      <NovaPropostaModal open={open} onOpenChange={setOpen} />
    </>
  )
}
