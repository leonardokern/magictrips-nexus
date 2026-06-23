"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Preset = { label: string; status: string; mes?: string }

/**
 * Barra de filtros das telas financeiras. Mantém estado na URL pra que
 * o server component refaça a query a cada mudança. Inclui presets de
 * período (este mês, próximos 30, atrasados) pra reduzir cliques.
 *
 * Props:
 * - `placeholderBusca`: placeholder do input de busca (cliente/fornecedor).
 * - `presets`: pílulas de filtro rápido. Cada uma seta {status, mes} na URL.
 */
export function FinanceFilters({
  placeholderBusca,
  presets,
}: {
  placeholderBusca: string
  presets: Preset[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(sp.get("q") ?? "")

  function navigate(params: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === "" || v === "all") next.delete(k)
      else next.set(k, v)
    }
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false })
    })
  }

  function applyPreset(p: Preset) {
    navigate({ status: p.status, mes: p.mes ?? null })
  }

  function isActive(p: Preset): boolean {
    const status = sp.get("status") ?? ""
    const mes = sp.get("mes") ?? ""
    return status === p.status && (p.mes ?? "") === mes
  }

  function limpar() {
    setQ("")
    startTransition(() => router.push("?", { scroll: false }))
  }

  const status = sp.get("status") ?? ""
  const mes = sp.get("mes") ?? ""
  const algumFiltro =
    sp.get("q") || sp.get("status") || sp.get("mes")

  return (
    <div className="space-y-3">
      {/* Linha 1: busca + selects */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => navigate({ q: q.trim() || null })}
            onKeyDown={(e) => {
              if (e.key === "Enter") navigate({ q: q.trim() || null })
            }}
            placeholder={placeholderBusca}
            className="h-9 border-white/10 bg-white/[0.04] pl-9 text-sm"
          />
        </div>

        <div className="hidden md:contents">
          <Select
            value={status || "all"}
            onValueChange={(v) => navigate({ status: v })}
          >
            <SelectTrigger className="h-9 w-[160px] border-white/10 bg-white/[0.04] text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="month"
            value={mes}
            onChange={(e) => navigate({ mes: e.target.value || null })}
            className="h-9 w-[160px] border-white/10 bg-white/[0.04] text-sm tabular-nums"
          />
        </div>

        {algumFiltro && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={limpar}
            disabled={pending}
            className="text-white/55 hover:text-white"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Linha 2: presets rápidos */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              isActive(p)
                ? "border-nexus-bright/60 bg-nexus-bright/15 text-nexus-bright"
                : "border-white/15 bg-white/[0.03] text-white/65 hover:border-white/30 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
