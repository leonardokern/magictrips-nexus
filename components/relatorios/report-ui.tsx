"use client"

import { type LucideIcon, FileSearch, Inbox } from "lucide-react"
import { LottieLoader } from "@/components/ui/lottie-loader"

export type KpiTone = "neutral" | "deep" | "green" | "blue" | "amber"

const TONE: Record<KpiTone, string> = {
  neutral: "text-white",
  deep: "text-nexus-bright",
  green: "text-emerald-400",
  blue: "text-sky-400",
  amber: "text-amber-400",
}

export type Kpi = { label: string; value: string; tone?: KpiTone }

/** Linha de KPIs do relatório (cards no tema dark). */
export function ReportKpis({ items }: { items: Kpi[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((k) => (
        <div
          key={k.label}
          className="min-w-[150px] flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">
            {k.label}
          </p>
          <p className={`mt-1.5 text-lg font-semibold tabular-nums ${TONE[k.tone ?? "neutral"]}`}>
            {k.value}
          </p>
        </div>
      ))}
    </div>
  )
}

/** Estado base (ícone + título + texto) usado por idle/empty. */
function EstadoBase({
  icon: Icon,
  titulo,
  texto,
}: {
  icon: LucideIcon
  titulo: string
  texto: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-16 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-white/40">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-white/80">{titulo}</p>
        <p className="mt-1 max-w-sm text-xs text-white/45">{texto}</p>
      </div>
    </div>
  )
}

/** Sem filtro suficiente ainda. */
export function ReportIdle({ texto }: { texto: string }) {
  return (
    <EstadoBase
      icon={FileSearch}
      titulo="Configure os filtros"
      texto={texto}
    />
  )
}

/** Filtros válidos, mas sem resultados. */
export function ReportEmpty({ texto }: { texto: string }) {
  return <EstadoBase icon={Inbox} titulo="Nenhum resultado" texto={texto} />
}

/** Carregando a prévia. */
export function ReportLoading() {
  return (
    <div
      className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
      role="status"
      aria-live="polite"
    >
      <LottieLoader className="h-16 w-16" />
      <span className="text-xs text-white/50">Carregando prévia…</span>
    </div>
  )
}
