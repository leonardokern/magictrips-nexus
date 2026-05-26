import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getCurrentUser } from "@/lib/hooks/use-current-user"
import { buildPermissions } from "@/lib/hooks/use-permissions"
import { SidebarNav, type NavItem, type NavSection } from "@/components/dashboard/sidebar-nav"
import { LogoutButton } from "@/components/dashboard/logout-button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { UserMenu } from "@/components/dashboard/user-menu"
import { NotificationsButton } from "@/components/dashboard/notifications-button"
import { MobileNav } from "@/components/dashboard/mobile-nav"
import { APP_VERSION } from "@/lib/version"
import { signOutAction } from "@/app/(dashboard)/actions"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const perms = buildPermissions(user)

  const supabase = await createClient()

  // Vendas pendentes de aprovação — só para quem pode aprovar (Admin/Gerente)
  let vendasPendentesCount = 0
  if (perms.can("vendas", "aprovar")) {
    const { count } = await supabase
      .from("vendas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente_validacao")
    vendasPendentesCount = count ?? 0
  }

  // Lembretes pendentes do usuário logado pro bell do header
  const { data: lembretes } = await supabase
    .from("lembretes")
    .select("id, tipo, mensagem, referencia_tipo, referencia_id, data_lembrete")
    .eq("destinatario_id", user.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(20)

  // Navigation organizada em seções — facilita escalar quando entrar mais módulos
  const agendaFlag = await isFeatureEnabled("agenda")

  const sections: NavSection[] = [
    {
      label: "Visão geral",
      items: [
        { href: "/dashboard", label: "Início", icon: "dashboard" },
        ...(agendaFlag && (perms.can("agenda", "ler") || perms.can("agenda", "criar"))
          ? [{ href: "/agenda", label: "Agenda", icon: "agenda" } as NavItem]
          : []),
      ],
    },
    {
      label: "Operação",
      items: [
        ...(perms.can("vendas", "ler")
          ? [{ href: "/vendas", label: "Vendas", icon: "vendas", badge: vendasPendentesCount || undefined } as NavItem]
          : []),
        ...(perms.can("clientes", "ler")
          ? [{ href: "/clientes", label: "Clientes", icon: "clientes" } as NavItem]
          : []),
        ...(perms.can("fornecedores", "ler")
          ? [
              {
                href: "/fornecedores",
                label: "Fornecedores",
                icon: "fornecedores",
              } as NavItem,
            ]
          : []),
      ],
    },
    {
      label: "Financeiro",
      items: [
        ...(perms.can("financeiro", "ler")
          ? [
              {
                href: "/financeiro/receber",
                label: "Contas a Receber",
                icon: "receber",
                comingSoon: true,
              } as NavItem,
              {
                href: "/financeiro/pagar",
                label: "Contas a Pagar",
                icon: "pagar",
                comingSoon: true,
              } as NavItem,
              {
                href: "/fluxo-de-caixa",
                label: "Fluxo de Caixa",
                icon: "caixa",
                comingSoon: true,
              } as NavItem,
            ]
          : []),
        ...(perms.can("cartoes", "ler")
          ? [{ href: "/cartoes", label: "Cartões da Agência", icon: "cartoes" } as NavItem]
          : []),
      ],
    },
    {
      label: "Administração",
      items: [
        ...(perms.can("usuarios", "ler")
          ? [{ href: "/usuarios", label: "Usuários", icon: "usuarios" } as NavItem]
          : []),
        ...(perms.can("perfis", "ler")
          ? [{ href: "/perfis", label: "Perfis de Acesso", icon: "perfis" } as NavItem]
          : []),
        ...(perms.can("comissoes", "ler")
          ? [
              { href: "/comissoes", label: "Comissões", icon: "comissoes" } as NavItem,
              { href: "/origens", label: "Origens de venda", icon: "origens" } as NavItem,
            ]
          : []),
        ...(perms.can("tipos_produto", "ler")
          ? [
              {
                href: "/tipos-produto",
                label: "Tipos de Produto",
                icon: "tipos_produto",
              } as NavItem,
            ]
          : []),
      ],
    },
  ].filter((s) => s.items.length > 0)

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
    <div className="min-h-screen bg-background text-foreground">
      {/* Halo radial — duas cores da marca Nexus se mesclando */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 25% -15%, rgba(20,152,213,0.18), transparent 60%), " +
            "radial-gradient(ellipse 70% 45% at 90% -10%, rgba(0,78,90,0.28), transparent 65%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar flutuante */}
        <div className="hidden p-3 md:flex">
          <aside className="sticky top-3 flex h-[calc(100vh-1.5rem)] w-64 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-xl">
            {/* Brand */}
            <Link
              href="/dashboard"
              className="flex h-20 items-center gap-2 border-b border-white/[0.06] px-3"
            >
              <Image
                src="/brand/nexus-icon.png"
                alt="Nexus"
                width={72}
                height={72}
                className="h-16 w-16 select-none object-contain [filter:brightness(0)_invert(1)]"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-base font-semibold tracking-tight text-white">
                  Nexus
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Magic Trips
                </span>
                <span className="mt-0.5 text-[10px] font-mono text-white/35">
                  v{APP_VERSION}
                </span>
              </div>
            </Link>

            {/* Nav */}
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
              <SidebarNav sections={sections} />
            </div>

            {/* Footer — botão de logout */}
            <div className="border-t border-white/[0.06] p-3">
              <form action={signOutAction}>
                <LogoutButton />
              </form>
            </div>
          </aside>
        </div>

        {/* Coluna direita — mesmo gutter (p-3) do sidebar pra o header
            flutuar como um card alinhado em altura/border com a marca. */}
        <div className="flex flex-1 flex-col p-3 md:pl-0">
          {/* Header flutuante */}
          <header className="sticky top-3 z-20 flex h-20 shrink-0 items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-card/60 px-4 backdrop-blur-xl md:px-6">

            {/* ── Mobile: hamburguer (esquerda) ────────────────── */}
            <div className="md:hidden">
              <MobileNav
                sections={sections}
                version={APP_VERSION}
                signOut={signOutAction}
              />
            </div>

            {/* ── Mobile: logo centralizada ────────────────────── */}
            <div className="flex flex-1 justify-center md:hidden">
              <Link href="/dashboard">
                <Image
                  src="/brand/nexus-logo-nome-transparent.png"
                  alt="Nexus Magic Trips"
                  width={110}
                  height={55}
                  className="h-8 w-auto select-none"
                  priority
                />
              </Link>
            </div>

            {/* ── Spacer desktop (empurra controles pra direita) ── */}
            <div className="hidden flex-1 md:block" />

            {/* ── Direita: notificações + usuário (sempre) ─────── */}
            <div className="flex items-center gap-2 md:gap-3">
              <NotificationsButton lembretes={lembretes ?? []} userId={user.id} />
              <UserMenu
                nome={user.nome}
                iniciais={user.iniciais}
                foto_url={user.foto_url}
                email={user.email}
                perfil={user.perfil.nome}
              />
            </div>
          </header>

          <main className="mt-3 flex-1 overflow-y-auto rounded-2xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
