"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Calendar, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const PERIODOS_PRESET = [
  { value: "mes-atual", label: "Mês atual" },
  { value: "mes-passado", label: "Mês passado" },
  { value: "ultimos-3m", label: "Últimos 3 meses" },
  { value: "ano-atual", label: "Ano atual" },
  { value: "todos", label: "Todos os tempos" },
] as const

export type PeriodoValue =
  | (typeof PERIODOS_PRESET)[number]["value"]
  | "custom"

const MESES_PT_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
]

type Props = {
  current: PeriodoValue
  from?: string
  to?: string
}

export function DashboardPeriodoFilter({ current, from, to }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(from ?? "")
  const [customTo, setCustomTo] = useState(to ?? "")
  const containerRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora do popover.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  function applyPreset(value: Exclude<PeriodoValue, "custom">) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "mes-atual") {
      params.delete("periodo")
    } else {
      params.set("periodo", value)
    }
    params.delete("from")
    params.delete("to")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
    setOpen(false)
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("periodo", "custom")
    params.set("from", customFrom)
    params.set("to", customTo)
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  const currentLabel = labelFromCurrent(current, from, to)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white/85 transition-colors hover:bg-white/[0.07]",
        )}
      >
        <Calendar className="h-4 w-4 text-white/55" />
        <span className="whitespace-nowrap">{currentLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/45" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-11 z-50 w-[320px] overflow-hidden rounded-xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
        {/* Lista de presets */}
        <div className="p-2">
          <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            Período
          </p>
          <ul className="space-y-0.5">
            {PERIODOS_PRESET.map((p) => {
              const selected = current === p.value
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => applyPreset(p.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                      selected
                        ? "bg-nexus-bright/15 text-nexus-bright"
                        : "text-white/75 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    <span>{p.label}</span>
                    {selected && <Check className="h-4 w-4" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Separador + Range customizado */}
        <div className="border-t border-white/[0.06] p-3">
          <p className="pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            Período personalizado
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/55">
                De
              </Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo || undefined}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/55">
                Até
              </Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom || undefined}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={applyCustom}
            disabled={!customFrom || !customTo || customFrom > customTo}
            className="mt-3 w-full bg-nexus-bright text-white hover:bg-nexus-bright/90"
          >
            Aplicar período
          </Button>
        </div>
        </div>
      )}
    </div>
  )
}

function labelFromCurrent(
  current: PeriodoValue,
  from?: string,
  to?: string,
): string {
  if (current === "custom" && from && to) {
    return `${formatIsoCurto(from)} → ${formatIsoCurto(to)}`
  }
  const preset = PERIODOS_PRESET.find((p) => p.value === current)
  return preset?.label ?? "Mês atual"
}

function formatIsoCurto(iso: string): string {
  // YYYY-MM-DD → DD/MMM
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, "0")}/${MESES_PT_CURTO[m - 1] ?? "?"}`
}
