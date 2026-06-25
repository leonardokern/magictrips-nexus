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
import { BottomNav } from "@/components/dashboard/bottom-nav"
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

  // Todas as queries independentes em paralelo — vendas, lembretes e feature flags
  // não dependem entre si, apenas de user.id e perms (já resolvidos acima).
  const [vendasResult, { data: lembretes }, [agendaFlag, propostasFlag]] =
    await Promise.all([
      perms.can("vendas", "aprovar")
        ? supabase
            .from("vendas")
            .select("id", { count: "exact", head: true })
            .eq("status", "pendente_validacao")
        : Promise.resolve({ count: 0, data: null, error: null }),
      supabase
        .from("lembretes")
        .select("id, tipo, mensagem, referencia_tipo, referencia_id, data_lembrete")
        .eq("destinatario_id", user.id)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(20),
      Promise.all([isFeatureEnabled("agenda"), isFeatureEnabled("propostas")]),
    ])

  const vendasPendentesCount = vendasResult?.count ?? 0

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
        ...(propostasFlag && perms.can("propostas", "ler")
          ? [{ href: "/propostas", label: "Propostas", icon: "propostas" } as NavItem]
          : []),
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
        ...(perms.can("relatorios", "ver")
          ? [{ href: "/relatorios", label: "Relatórios", icon: "relatorios" } as NavItem]
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
              } as NavItem,
              {
                href: "/financeiro/pagar",
                label: "Contas a Pagar",
                icon: "pagar",
              } as NavItem,
              {
                href: "/fluxo-de-caixa",
                label: "Fluxo de Caixa",
                icon: "caixa",
              } as NavItem,
              {
                href: "/faturas",
                label: "Faturas",
                icon: "faturas",
              } as NavItem,
            ]
          : []),
        ...(perms.can("cartoes", "ler")
          ? [{ href: "/cartoes", label: "Cartões e Caixas", icon: "cartoes" } as NavItem]
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
              // "Comissões" foi escondida da nav porque ficou ambígua com
              // "Origens de venda" — a regra de comissão é cadastrada por
              // origem, então a UX consolidada vive em /origens. A rota
              // /comissoes continua acessível por URL direta (não removida)
              // e os Server Actions seguem ativos pra retrocompat.
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

        {/* Coluna direita */}
        <div className="flex flex-1 flex-col md:p-3 md:pl-0">
          {/* Header: app bar nativo no mobile, card flutuante no desktop */}
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] bg-card/90 px-4 backdrop-blur-xl md:top-3 md:rounded-2xl md:border md:border-white/[0.06] md:bg-card/60 md:h-20 md:px-6">

            {/* ── Mobile: logo + marca (esquerda) ─────────────── */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 md:hidden"
            >
              <Image
                src="/brand/nexus-icon.png"
                alt="Nexus"
                width={36}
                height={36}
                className="h-9 w-9 select-none object-contain [filter:brightness(0)_invert(1)]"
                priority
              />
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-tight text-white">
                  Nexus
                </span>
                <span className="text-[9px] uppercase tracking-[0.15em] text-white/40">
                  Magic Trips
                </span>
              </div>
            </Link>

            {/* ── Spacer desktop (empurra controles pra direita) ── */}
            <div className="hidden flex-1 md:block" />

            {/* ── Direita: notificações + usuário (sempre) ─────── */}
            <div className="flex items-center gap-1.5 md:gap-3">
              <UserMenu
                userId={user.id}
                nome={user.nome}
                iniciais={user.iniciais}
                foto_url={user.foto_url}
                email={user.email}
                perfil={user.perfil.nome}
              />
              <NotificationsButton lembretes={lembretes ?? []} userId={user.id} />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 pb-28 md:mt-3 md:rounded-2xl md:px-8 md:py-8 md:pb-8">
            {children}
          </main>

          {/* ── Bottom nav — só mobile ───────────────────────── */}
          <BottomNav
            sections={sections}
            version={APP_VERSION}
            signOut={signOutAction}
          />
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
