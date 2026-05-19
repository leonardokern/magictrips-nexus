import { redirect } from "next/navigation"
import { Compass } from "lucide-react"
import { getCurrentUser } from "@/lib/hooks/use-current-user"
import { buildPermissions } from "@/lib/hooks/use-permissions"
import { SidebarNav, type NavItem } from "@/components/dashboard/sidebar-nav"
import { UserMenu } from "@/components/dashboard/user-menu"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const perms = buildPermissions(user)

  // Itens da sidebar — filtrados por permissão
  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Início", icon: "dashboard" },
    ...(perms.can("vendas", "ler")
      ? [{ href: "/vendas", label: "Vendas", icon: "vendas" }]
      : []),
    ...(perms.can("clientes", "ler")
      ? [{ href: "/clientes", label: "Clientes", icon: "clientes" }]
      : []),
    ...(perms.can("financeiro", "ler")
      ? [
          { href: "/financeiro/receber", label: "Contas a Receber", icon: "receber" },
          { href: "/financeiro/pagar", label: "Contas a Pagar", icon: "pagar" },
          { href: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: "caixa" },
          { href: "/clientes-faturados", label: "Clientes Faturados", icon: "faturados" },
        ]
      : []),
    ...(perms.can("cartoes", "ler")
      ? [{ href: "/cartoes", label: "Cartões da Agência", icon: "cartoes" }]
      : []),
    ...(perms.can("fornecedores", "ler")
      ? [{ href: "/fornecedores", label: "Fornecedores", icon: "fornecedores" }]
      : []),
    ...(perms.can("usuarios", "ler")
      ? [{ href: "/usuarios", label: "Usuários", icon: "usuarios" }]
      : []),
    ...(perms.can("perfis", "ler")
      ? [{ href: "/perfis", label: "Perfis de Acesso", icon: "perfis" }]
      : []),
    ...(perms.can("auditoria", "ler")
      ? [{ href: "/auditoria", label: "Auditoria", icon: "auditoria" }]
      : []),
  ]

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Compass className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">Compass</span>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto py-4">
          <SidebarNav items={navItems} />
        </div>

        {user.empresa && (
          <div className="border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">Empresa</p>
            <p className="text-sm font-medium">{user.empresa.nome}</p>
          </div>
        )}
        {!user.empresa && (
          <div className="border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">Acesso</p>
            <p className="text-sm font-medium">Todas as empresas</p>
          </div>
        )}
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            {user.empresa?.nome ?? "Administração geral"}
          </h1>
          <UserMenu
            nome={user.nome}
            iniciais={user.iniciais}
            email={user.email}
            perfil={user.perfil.nome}
          />
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
