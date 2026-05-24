"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Calendar } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const PERIODOS = [
  { value: "mes-atual", label: "Mês atual" },
  { value: "ultimos-3m", label: "Últimos 3 meses" },
  { value: "ano-atual", label: "Ano atual" },
  { value: "todos", label: "Todos os tempos" },
] as const

export type PeriodoValue = (typeof PERIODOS)[number]["value"]

type Props = {
  current: PeriodoValue
}

export function DashboardPeriodoFilter({ current }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "mes-atual") {
      // Default — não polui URL
      params.delete("periodo")
    } else {
      params.set("periodo", value)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-white/45" />
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[200px] border-white/10 bg-white/[0.04] text-white/85">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODOS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
