"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Boxes,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Percent,
  Receipt,
  Shield,
  ShoppingCart,
  Tag,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarNav, type NavSection } from "./sidebar-nav"
import { LogoutButton } from "./logout-button"

type Props = {
  sections: NavSection[]
  version: string
  signOut: () => Promise<void>
}

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  propostas: FileText,
  vendas: ShoppingCart,
  clientes: Users,
  receber: Wallet,
  pagar: Receipt,
  caixa: TrendingUp,
  cartoes: CreditCard,
  fornecedores: Package,
  agenda: CalendarDays,
  usuarios: UserCog,
  perfis: Shield,
  comissoes: Percent,
  origens: Tag,
  tipos_produto: Boxes,
  auditoria: History,
}

const PRIORITY_HREFS = ["/dashboard", "/vendas", "/clientes"]

export function BottomNav({ sections, version, signOut }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setMoreOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [moreOpen])

  const allItems = sections.flatMap((s) => s.items)
  const bottomTabs = PRIORITY_HREFS
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const sheet = (
    <>
      <div
        aria-hidden
        onClick={() => setMoreOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
          moreOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-white/[0.08] bg-[#0b1520]/98 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out",
          moreOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Handle */}
        <div className="flex shrink-0 justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            aria-label="Fechar menu"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav sections={sections} />
        </div>

        <div
          className="shrink-0 border-t border-white/[0.06] px-4 pt-3"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <p className="mb-2 px-2 font-mono text-[10px] text-white/25">v{version}</p>
          <form action={signOut}>
            <LogoutButton />
          </form>
        </div>
      </div>
    </>
  )

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-[#0b1520]/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-14 items-stretch">
          {bottomTabs.map((tab) => {
            const Icon = ICONS[tab.icon] ?? LayoutDashboard
            const isActive =
              tab.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                  isActive ? "text-nexus-bright" : "text-white/40",
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-nexus-bright" />
                )}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
              moreOpen ? "text-nexus-bright" : "text-white/40",
            )}
          >
            {moreOpen && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-nexus-bright" />
            )}
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {mounted && createPortal(sheet, document.body)}
    </>
  )
}
