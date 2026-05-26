"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

/**
 * Wrapper Radix Tooltip estilizado no tema Nexus. Usar sempre dentro de um
 * `<TooltipProvider>` no topo da árvore (já incluído no layout do dashboard).
 *
 * Padrão de uso:
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <button>Ícone</button>
 *   </TooltipTrigger>
 *   <TooltipContent>Texto explicativo</TooltipContent>
 * </Tooltip>
 * ```
 *
 * Ou, mais simples, usar o helper `<IconTooltip label="...">{children}</IconTooltip>`.
 */
const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border border-white/10 bg-card/95 px-2.5 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-md",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

/**
 * Atalho pra cenário mais comum: um trigger único com label de texto.
 * Encapsula Tooltip + Trigger (com asChild) + Content. Use quando seu
 * componente filho já gerencia o seu próprio elemento clicável (ex:
 * `IconAction`, `IconLinkAction`, ou qualquer `<button>` puro).
 */
function IconTooltip({
  label,
  side = "top",
  children,
  delayDuration = 200,
}: {
  label: string
  side?: "top" | "right" | "bottom" | "left"
  children: React.ReactNode
  delayDuration?: number
}) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, IconTooltip }
