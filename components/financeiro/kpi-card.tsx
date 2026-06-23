import { cn } from "@/lib/utils"

type Tone = "neutral" | "danger" | "success" | "info" | "warning"

const TONE_BORDER: Record<Tone, string> = {
  neutral: "border-white/[0.06]",
  danger: "border-rose-500/25",
  success: "border-emerald-500/25",
  info: "border-nexus-bright/25",
  warning: "border-amber-500/25",
}
const TONE_BG: Record<Tone, string> = {
  neutral: "bg-white/[0.02]",
  danger: "bg-rose-500/[0.04]",
  success: "bg-emerald-500/[0.04]",
  info: "bg-nexus-bright/[0.04]",
  warning: "bg-amber-500/[0.04]",
}
const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-white",
  danger: "text-rose-300",
  success: "text-emerald-300",
  info: "text-white",
  warning: "text-amber-300",
}

/**
 * KPI compacto pro topo das telas financeiras. Usa o tom semântico pra
 * dar leitura imediata (atrasado=rose, pago=emerald, em aberto=info).
 */
export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string
  value: string
  hint?: string
  tone?: Tone
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", TONE_BORDER[tone], TONE_BG[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", TONE_VALUE[tone])}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-white/45">{hint}</p>}
    </div>
  )
}
