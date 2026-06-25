import { cn } from "@/lib/utils"

/**
 * Chip de status da parcela. O status "atrasado" é DERIVADO no app
 * (vencimento < hoje && pendente) — o banco só guarda pendente/pago/cancelado.
 */
export type ParcelaStatus = "pendente" | "pago" | "pago_atraso" | "atrasado" | "cancelado"

const STYLES: Record<ParcelaStatus, string> = {
  pendente: "border-white/15 bg-white/[0.06] text-white/75",
  pago: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  pago_atraso: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  atrasado: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  cancelado: "border-white/10 bg-white/[0.03] text-white/40 line-through",
}

const LABELS: Record<ParcelaStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  pago_atraso: "Pago c/ Atraso",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
}

export function ParcelaStatusBadge({ status }: { status: ParcelaStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  )
}
