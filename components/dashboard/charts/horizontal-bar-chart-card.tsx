"use client"

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatBRL } from "@/lib/utils/sum-parser"

type Point = {
  label: string
  value: number
  /** Cor sobrescrita por barra (opcional). */
  color?: string
}

type Props = {
  data: Point[]
  primaryColor?: string
  /** Se true, usa formatBRL no tooltip. Default true. Ignorado se suffix definido. */
  currency?: boolean
  /**
   * Sufixo aplicado ao valor (ex: "%", " min", " un"). Quando definido, formata
   * como `valor.toFixed(decimals)` (com vírgula PT-BR) + sufixo, e desativa o
   * fallback de BRL. Primitive on purpose — não pode passar fn Server → Client.
   */
  suffix?: string
  /** Casas decimais usadas quando `suffix` está definido. Default 1. */
  decimals?: number
}

/**
 * Bar chart horizontal — ideal pra rankings (TOP 5, classificações).
 * Cada barra com label à esquerda e valor à direita.
 */
export function HorizontalBarChartCard({
  data,
  primaryColor = "#1498D5",
  currency = true,
  suffix,
  decimals = 1,
}: Props) {
  const fmt = (n: number): string => {
    if (typeof suffix === "string") {
      return `${n.toFixed(decimals).replace(".", ",")}${suffix}`
    }
    return currency ? formatBRL(n) : n.toString()
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 64, left: 4, bottom: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          dataKey="label"
          type="category"
          tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "rgba(20,20,24,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "white",
            fontSize: 12,
            padding: "6px 10px",
          }}
          formatter={(value) => [fmt(Number(value)), ""]}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          label={{
            position: "right",
            fill: "rgba(255,255,255,0.85)",
            fontSize: 11,
            formatter: (value: unknown) => fmt(Number(value)),
          }}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? primaryColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
