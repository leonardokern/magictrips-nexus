"use client"

import { useState } from "react"
import { Paperclip, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { obterUrlAnexoLancamento } from "@/app/(dashboard)/financeiro/actions"

type Anexo = { id: string; nome_arquivo: string }

export function AnexoChip({ anexos }: { anexos: Anexo[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (!anexos || anexos.length === 0) return null

  async function abrir(anexo: Anexo) {
    setLoadingId(anexo.id)
    const r = await obterUrlAnexoLancamento(anexo.id)
    setLoadingId(null)
    if (!r.ok) { toast.error(r.error ?? "Erro ao abrir anexo."); return }
    window.open(r.data!.url, "_blank", "noopener,noreferrer")
  }

  // Até 3 chips individuais; acima disso mostra "N Anexos" abrindo o primeiro
  if (anexos.length <= 3) {
    return (
      <div className="flex flex-wrap gap-1">
        {anexos.map((a) => (
          <button
            key={a.id}
            onClick={() => abrir(a)}
            disabled={!!loadingId}
            title={a.nome_arquivo}
            className="inline-flex items-center gap-1 rounded border border-nexus-bright/20 bg-nexus-bright/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-nexus-bright transition-colors hover:border-nexus-bright/40 hover:bg-nexus-bright/[0.12] disabled:opacity-50"
          >
            {loadingId === a.id
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Paperclip className="h-3 w-3" />}
            Anexo
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => anexos[0] && abrir(anexos[0])}
      disabled={!!loadingId}
      className="inline-flex items-center gap-1 rounded border border-nexus-bright/20 bg-nexus-bright/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-nexus-bright transition-colors hover:border-nexus-bright/40 hover:bg-nexus-bright/[0.12] disabled:opacity-50"
    >
      {loadingId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
      {anexos.length} Anexos
    </button>
  )
}
