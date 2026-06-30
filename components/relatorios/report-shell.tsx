"use client"

import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

type Props = {
  icon: LucideIcon
  titulo: string
  descricao: string
  /** Controles de filtro (lado esquerdo da barra). */
  filtros: ReactNode
  /** Botões de exportação (lado direito da barra). */
  acoes: ReactNode
  /** Prévia visual / conteúdo do relatório. */
  children: ReactNode
}

/**
 * Layout padrão de uma tela de relatório: header com voltar + identidade,
 * barra de filtros (filtros à esquerda, ações à direita) e área de prévia.
 */
export function ReportShell({ icon: Icon, titulo, descricao, filtros, acoes, children }: Props) {
  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <Link
          href="/relatorios"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">{titulo}</h2>
            <p className="mt-0.5 text-sm text-white/55">{descricao}</p>
          </div>
        </div>
      </div>

      {/* ── Barra de filtros + ações ───────────────────────────── */}
      <div className="sticky top-2 z-10 rounded-xl border border-white/[0.06] bg-card/80 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">{filtros}</div>
          <div className="flex shrink-0 items-center gap-2">{acoes}</div>
        </div>
      </div>

      {/* ── Prévia ─────────────────────────────────────────────── */}
      <div>{children}</div>
    </div>
  )
}
