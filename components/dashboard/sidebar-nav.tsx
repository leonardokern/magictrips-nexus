"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Boxes,
  Building2,
  CalendarDays,
  CreditCard,
  FileBarChart,
  FileText,
  History,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  ScrollText,
  Shield,
  ShoppingCart,
  Tag,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type NavItem = {
  href: string
  label: string
  icon: string
  badge?: number
  /** Funcionalidade ainda não liberada — item aparece desabilitado/em itálico. */
  comingSoon?: boolean
}

export type NavSection = {
  label: string
  items: NavItem[]
}

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  propostas: FileText,
  vendas: ShoppingCart,
  clientes: Users,
  receber: Wallet,
  pagar: Receipt,
  caixa: TrendingUp,
  faturados: Building2,
  cartoes: CreditCard,
  fornecedores: Package,
  agenda: CalendarDays,
  usuarios: UserCog,
  perfis: Shield,
  comissoes: Percent,
  origens: Tag,
  tipos_produto: Boxes,
  faturas: ScrollText,
  relatorios: FileBarChart,
  auditoria: History,
}

type Props = {
  sections: NavSection[]
}

export function SidebarNav({ sections }: Props) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-5 px-3">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            {section.label}
          </p>
          {section.items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard
            const ativo =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href)

            // Item de funcionalidade futura: não navega, fica em itálico
            // com cor mais apagada e sem hover/cursor.
            if (item.comingSoon) {
              return (
                <div
                  key={item.href}
                  aria-disabled="true"
                  title="Em breve"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm italic text-white/25"
                >
                  <Icon className="h-4 w-4 shrink-0 text-white/20" />
                  <span className="truncate">{item.label}</span>
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                  ativo
                    ? "bg-nexus-bright/15 text-white shadow-[inset_0_0_0_1px_rgba(20,152,213,0.25)]"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    ativo
                      ? "text-nexus-bright"
                      : "text-white/50 group-hover:text-white/80",
                  )}
                />
                <span className="truncate">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span
                    title={`${item.badge} venda${item.badge > 1 ? "s" : ""} aguardando aprovação`}
                    className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold tabular-nums text-amber-300 ring-1 ring-amber-400/30"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
