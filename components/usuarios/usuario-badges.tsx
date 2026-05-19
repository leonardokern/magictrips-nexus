import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const PERFIL_STYLES: Record<string, string> = {
  Administrador: "border-rose-500/30 bg-rose-500/15 text-rose-300",
  Gerente: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  Agente: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
}

export function PerfilUsuarioBadge({ nome }: { nome: string }) {
  const cls =
    PERFIL_STYLES[nome] ??
    "border-violet-500/30 bg-violet-500/15 text-violet-300"
  return (
    <Badge variant="outline" className={cn(cls)}>
      {nome}
    </Badge>
  )
}

export function UsuarioAtivoBadge({ ativo }: { ativo: boolean }) {
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
