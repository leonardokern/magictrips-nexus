"use client"

import { useFormStatus } from "react-dom"
import { LogOut } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

/**
 * Botão de logout com feedback visual durante o submit do form action.
 * Usa `useFormStatus` para detectar pending — precisa estar dentro de
 * `<form action={signOutAction}>`.
 */
export function LogoutButton({ className }: { className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      title={pending ? "Saindo…" : "Sair"}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
        pending
          ? "cursor-progress bg-white/[0.04] text-white"
          : "text-white/70 hover:bg-white/[0.04] hover:text-white",
        className,
      )}
    >
      {pending ? (
        <Spinner className="h-4 w-4 text-nexus-bright" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      <span>{pending ? "Saindo…" : "Sair"}</span>
    </button>
  )
}
