"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  CreditCard,
  Wallet,
  TrendingUp,
  Receipt,
  Building2,
  UserCog,
  Shield,
  History,
  Package,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type NavItem = {
  href: string
  label: string
  icon: string
}

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  vendas: ShoppingCart,
  clientes: Users,
  receber: Wallet,
  pagar: Receipt,
  caixa: TrendingUp,
  faturados: Building2,
  cartoes: CreditCard,
  fornecedores: Package,
  usuarios: UserCog,
  perfis: Shield,
  auditoria: History,
}

type Props = {
  items: NavItem[]
}

export function SidebarNav({ items }: Props) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard
        const ativo =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              ativo
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
