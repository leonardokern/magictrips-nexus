"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatBRL } from "@/lib/utils/sum-parser"

export type FluxoPonto = {
  /** ISO YYYY-MM-DD */
  data: string
  entradas: number
  saidas: number
  saldoAcumulado: number
}

/**
 * Linha de saldo acumulado + barras invisíveis de entradas/saídas (no
 * tooltip). Usa Recharts pra consistência com os dashboards existentes.
 */
export function FluxoCaixaChart({ pontos }: { pontos: FluxoPonto[] }) {
  if (pontos.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center text-sm text-white/55">
        Sem dados no período selecionado.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={pontos}
            margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
          >
            <defs>
              <linearGradient id="grad-saldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1498D5" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#1498D5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="data"
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
              tickFormatter={(iso: string) => {
                const [, m, d] = iso.split("-")
                return `${d}/${m}`
              }}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
              width={50}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#0b1424",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(iso) => {
                if (typeof iso !== "string") return ""
                const [y, m, d] = iso.split("-")
                return `${d}/${m}/${y}`
              }}
              formatter={(value, key) => {
                const v = Number(value ?? 0)
                if (key === "saldoAcumulado") return [formatBRL(v), "Saldo"]
                if (key === "entradas") return [formatBRL(v), "Entradas"]
                if (key === "saidas") return [formatBRL(v), "Saídas"]
                return [formatBRL(v), String(key ?? "")]
              }}
            />
            <Area
              type="monotone"
              dataKey="saldoAcumulado"
              stroke="#1498D5"
              strokeWidth={2}
              fill="url(#grad-saldo)"
              dot={false}
            />
            {/* Linhas auxiliares pra que o tooltip mostre entradas/saídas */}
            <Area
              type="monotone"
              dataKey="entradas"
              stroke="transparent"
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="saidas"
              stroke="transparent"
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
