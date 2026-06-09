"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { NovaVendaModal } from "./nova-venda-modal"

export function NovaVendaButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={cn("bg-nexus-bright text-white hover:bg-nexus-bright-soft", className)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nova venda
      </Button>
      <NovaVendaModal open={open} onOpenChange={setOpen} />
    </>
  )
}
