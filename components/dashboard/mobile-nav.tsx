"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarNav, type NavSection } from "./sidebar-nav"
import { LogoutButton } from "./logout-button"

type Props = {
  sections: NavSection[]
  version: string
  signOut: () => Promise<void>
}

export function MobileNav({ sections, version, signOut }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Fecha ao navegar
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Trava o scroll do body quando drawer abre
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* Botão hamburguer */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/[0.06] bg-[#0d1a24]/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Cabeçalho do drawer */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
          <Link href="/dashboard" className="flex items-center" onClick={() => setOpen(false)}>
            <Image
              src="/brand/nexus-logo-nome-transparent.png"
              alt="Nexus Magic Trips"
              width={110}
              height={55}
              className="h-8 w-auto select-none"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navegação */}
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav sections={sections} />
        </div>

        {/* Rodapé */}
        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <p className="mb-1.5 px-3 font-mono text-[10px] text-white/25">v{version}</p>
          <form action={signOut}>
            <LogoutButton />
          </form>
        </div>
      </aside>
    </>
  )
}
