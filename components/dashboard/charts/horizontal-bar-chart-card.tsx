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
  /** Se true, usa formatBRL no tooltip. Default true. */
  currency?: boolean
}

/**
 * Bar chart horizontal — ideal pra rankings (TOP 5, classificações).
 * Cada barra com label à esquerda e valor à direita.
 */
export function HorizontalBarChartCard({
  data,
  primaryColor = "#1498D5",
  currency = true,
}: Props) {
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
          formatter={(value) => {
            const n = Number(value)
            return currency ? [formatBRL(n), ""] : [n.toString(), ""]
          }}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          label={{
            position: "right",
            fill: "rgba(255,255,255,0.85)",
            fontSize: 11,
            formatter: (value: unknown) => {
              const n = Number(value)
              return currency ? formatBRL(n) : n.toString()
            },
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
