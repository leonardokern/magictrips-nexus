import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TIPO_PACOTE_LABEL, type TipoPacote } from "@/lib/schemas/pacote"

const TIPO_STYLES: Record<TipoPacote, string> = {
  unica_operadora: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  multi_operadora: "border-violet-500/30 bg-violet-500/15 text-violet-300",
}

export function TipoPacoteBadge({ tipo }: { tipo: TipoPacote }) {
  return (
    <Badge variant="outline" className={cn(TIPO_STYLES[tipo])}>
      {TIPO_PACOTE_LABEL[tipo]}
    </Badge>
  )
}

export function PacoteAtivoBadge({ ativo }: { ativo: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        ativo
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
          : "border-white/10 bg-white/[0.06] text-white/45",
      )}
    >
      {ativo ? "Ativo" : "Inativo"}
    </Badge>
  )
}
