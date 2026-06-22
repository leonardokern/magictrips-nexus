"use client"

import { useState } from "react"
import { ChevronDown, Pencil, Plus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { NovaVendaModal } from "./nova-venda-modal"
import { AlteracaoValoresModal } from "./alteracao-valores-modal"

export function NovaVendaButton({ className }: { className?: string }) {
  const [novaOpen, setNovaOpen] = useState(false)
  const [alteracaoOpen, setAlteracaoOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "bg-nexus-bright text-white hover:bg-nexus-bright-soft",
              className,
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova venda
            <ChevronDown className="ml-2 h-4 w-4 opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onSelect={() => setNovaOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-nexus-bright/30 bg-nexus-bright/10">
              <ShoppingCart className="h-3.5 w-3.5 text-nexus-bright" />
            </div>
            <p className="text-sm font-medium text-white">Nova venda</p>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setAlteracaoOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
              <Pencil className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <p className="text-sm font-medium text-white">
              Alteração de venda
            </p>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NovaVendaModal open={novaOpen} onOpenChange={setNovaOpen} />
      <AlteracaoValoresModal
        open={alteracaoOpen}
        onOpenChange={setAlteracaoOpen}
      />
    </>
  )
}
