"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  listarEventosAgenda,
  type AgendaEvento,
} from "@/app/(dashboard)/agenda/actions"
import { EventoDetalhePopover } from "@/components/agenda/evento-detalhe-popover"

type Props = {
  /** Resolvido no server pra evitar fetch desnecessário quando a flag está off. */
  agendaFlag: boolean
}

/**
 * Card "Próximos 7 dias" — janela de 7 dias com navegação por semana.
 * Cliente component: gerencia offset semanal, fetch via server action e
 * abre o modal de detalhe do evento ao clicar em qualquer item.
 *
 * Mostra ambos layouts (mobile/desktop) via classes responsivas.
 */
export function AgendaProximosDias({ agendaFlag }: Props) {
  // Offset em "semanas" relativo ao dia inicial padrão (hoje). 0 = janela
  // começa hoje; +1 = começa daqui a 7 dias; -1 = começou 7 dias atrás.
  const [weekOffset, setWeekOffset] = useState(0)
  const [eventos, setEventos] = useState<AgendaEvento[]>([])
  const [eventoSelecionado, setEventoSelecionado] =
    useState<AgendaEvento | null>(null)
  const [isPending, startTransition] = useTransition()

  const dias = useMemo(() => {
    const base = addDias(new Date(), weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => addDias(base, i))
  }, [weekOffset])

  const rangeInicio = useMemo(() => toISODate(dias[0]!), [dias])
  const rangeFim = useMemo(() => toISODate(dias[6]!), [dias])

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, AgendaEvento[]>()
    for (const ev of eventos) {
      const arr = map.get(ev.dia) ?? []
      arr.push(ev)
      map.set(ev.dia, arr)
    }
    return map
  }, [eventos])

  const carregar = useCallback(() => {
    if (!agendaFlag) return
    startTransition(async () => {
      const r = await listarEventosAgenda(rangeInicio, rangeFim)
      if (r.ok && r.data) setEventos(r.data)
    })
  }, [agendaFlag, rangeInicio, rangeFim])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!agendaFlag) return null

  const semanaCorrente = weekOffset === 0
  const labelRange = `${formatDiaCurto(dias[0]!)} – ${formatDiaCurto(dias[6]!)}`

  function renderDayCol(dia: Date, idx: number, variant: "desktop" | "mobile") {
    const iso = toISODate(dia)
    const eventosDoDia = eventosPorDia.get(iso) ?? []
    const isHoje = iso === toISODate(new Date())
    const label =
      weekOffset === 0 && idx === 0
        ? "Hoje"
        : weekOffset === 0 && idx === 1
          ? "Amanhã"
          : DIAS_SEMANA_CURTO[dia.getDay()]
    const maxItens = variant === "desktop" ? 6 : 3
    return (
      <div
        key={iso}
        className={cn(
          variant === "desktop"
            ? "flex min-h-[160px] flex-col rounded-lg border bg-white/[0.02] p-3"
            : "flex w-32 shrink-0 flex-col rounded-2xl border bg-white/[0.02] p-2.5",
          isHoje
            ? "border-nexus-bright/40 bg-nexus-bright/[0.04]"
            : "border-white/[0.06]",
        )}
      >
        <div
          className={cn(
            "mb-2 flex items-baseline justify-between",
            isHoje && "text-nexus-bright",
          )}
        >
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              isHoje ? "text-nexus-bright" : "text-white/70",
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "text-[10px] tabular-nums",
              isHoje ? "text-nexus-bright/80" : "text-white/35",
            )}
          >
            {formatDiaCurto(dia)}
          </span>
        </div>
        {eventosDoDia.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-2">
            <span className="flex items-center gap-1.5 text-[10px] text-white/25">
              <CalendarDays className="h-3 w-3" />
              Livre
            </span>
          </div>
        ) : (
          <ul className="space-y-1">
            {eventosDoDia.slice(0, maxItens).map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => setEventoSelecionado(ev)}
                  className="flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left transition-opacity hover:opacity-80"
                  style={{ backgroundColor: ev.cor + "1a" }}
                  title={ev.titulo}
                >
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.cor }}
                  />
                  <div
                    className="min-w-0 flex-1 text-[11px] leading-snug"
                    style={{ color: ev.cor }}
                  >
                    {ev.horaInicio && (
                      <span className="mr-1 tabular-nums opacity-80">
                        {ev.horaInicio}
                      </span>
                    )}
                    <span className="line-clamp-2 font-medium">
                      {ev.titulo}
                    </span>
                  </div>
                </button>
              </li>
            ))}
            {eventosDoDia.length > maxItens && (
              <li className="px-1.5 text-[10px] text-white/40">
                +{eventosDoDia.length - maxItens} mais
              </li>
            )}
          </ul>
        )}
      </div>
    )
  }

  const headerControls = (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-xs text-white/45 tabular-nums sm:inline">
        {labelRange}
      </span>
      <button
        type="button"
        onClick={() => setWeekOffset((o) => o - 1)}
        title="Semana anterior"
        aria-label="Semana anterior"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {!semanaCorrente && (
        <button
          type="button"
          onClick={() => setWeekOffset(0)}
          title="Voltar pra hoje"
          aria-label="Voltar pra hoje"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] px-2 text-[11px] font-medium text-nexus-bright transition-colors hover:bg-nexus-bright/15"
        >
          <RotateCcw className="h-3 w-3" />
          Hoje
        </button>
      )}
      <button
        type="button"
        onClick={() => setWeekOffset((o) => o + 1)}
        title="Próxima semana"
        aria-label="Próxima semana"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <Link
        href="/agenda"
        className="ml-1 text-xs text-nexus-bright hover:text-nexus-bright-soft"
      >
        Ver agenda →
      </Link>
    </div>
  )

  return (
    <>
      {/* ── Mobile (scroll horizontal de cards estreitos) ────────────────── */}
      <div className="md:hidden">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Próximos 7 dias</p>
          {headerControls}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dias.map((dia, i) => renderDayCol(dia, i, "mobile"))}
        </div>
      </div>

      {/* ── Desktop (Card com grid 7 colunas) ────────────────────────────── */}
      <Card className="hidden border-white/[0.06] bg-white/[0.02] md:block">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-white">
                Próximos 7 dias
              </CardTitle>
              <p className="mt-0.5 text-xs text-white/45">
                {isPending ? "Carregando…" : `Eventos da agenda · ${labelRange}`}
              </p>
            </div>
            {headerControls}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {isPending && eventos.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner className="text-white/40" />
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {dias.map((dia, i) => renderDayCol(dia, i, "desktop"))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EventoDetalhePopover
        evento={eventoSelecionado}
        onClose={() => setEventoSelecionado(null)}
        onDeleted={carregar}
      />
    </>
  )
}

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDias(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function formatDiaCurto(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0")
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${day}/${m}`
}
