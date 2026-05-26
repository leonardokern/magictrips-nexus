import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { getAgendaPageData } from "./actions"
import { AgendaCalendar } from "@/components/agenda/agenda-calendar"

export const metadata: Metadata = { title: "Agenda" }

export default async function AgendaPage() {
  // Feature flag — quando OFF, rota retorna 404 (não dá pra acessar via URL direta)
  if (!(await isFeatureEnabled("agenda"))) notFound()

  const user = await requireCurrentUser()
  const podeVer = can(user, "agenda", "ler") || can(user, "agenda", "criar")

  if (!podeVer) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver a agenda.
      </div>
    )
  }

  const dataRes = await getAgendaPageData()
  if (!dataRes.ok || !dataRes.data) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Não foi possível carregar dados da agenda.
      </div>
    )
  }

  const podeCriar = can(user, "agenda", "criar")
  const verAdm = can(user, "agenda", "ler")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Agenda
        </h2>
        <p className="mt-1 text-sm text-white/55">
          {verAdm
            ? "Calendário unificado da operação — contas a receber, cartões, viagens, lembretes e notas."
            : "Seus lembretes e notas pessoais."}
        </p>
      </div>

      <AgendaCalendar
        empresas={dataRes.data.empresas}
        empresaPadrao={dataRes.data.empresaPadrao}
        podeCriar={podeCriar}
        podeVerOperacao={verAdm}
      />
    </div>
  )
}
