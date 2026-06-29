"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RotateCcw,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  getAgendaPageData,
  listarEventosAgenda,
  type AgendaEvento,
} from "@/app/(dashboard)/agenda/actions"
import { EventoDetalhePopover } from "@/components/agenda/evento-detalhe-popover"
import { EventoFormModal } from "@/components/agenda/evento-form-modal"

type Props = {
  /** Resolvido no server pra evitar fetch desnecessário quando a flag está off. */
  agendaFlag: boolean
  /** ID da empresa padrão do usuário — usado pra criar eventos inline. */
  empresaPadrao?: string | null
  /** Quando true, mostra os botões "Adicionar"/"Ver todos" em cada dia. */
  podeCriar?: boolean
}

/**
 * Card "Esta semana" — janela de 7 dias com navegação por semana.
 * Cliente component: gerencia offset semanal, fetch via server action e
 * abre o modal de detalhe do evento ao clicar em qualquer item.
 *
 * Mostra ambos layouts (mobile/desktop) via classes responsivas.
 */
export function AgendaProximosDias({
  agendaFlag,
  empresaPadrao: empresaPadraoProp,
  podeCriar = true,
}: Props) {
  // Quando o parent não passa empresaPadrao explícito, busca via server
  // action — assim o widget funciona em qualquer dashboard sem precisar
  // plumbar a prop em vários níveis.
  const [empresaPadraoFetched, setEmpresaPadraoFetched] = useState<
    string | null
  >(null)
  useEffect(() => {
    if (empresaPadraoProp !== undefined) return
    let cancelado = false
    getAgendaPageData().then((r) => {
      if (cancelado) return
      if (r.ok && r.data) setEmpresaPadraoFetched(r.data.empresaPadrao)
    })
    return () => {
      cancelado = true
    }
  }, [empresaPadraoProp])
  const empresaPadrao = empresaPadraoProp ?? empresaPadraoFetched
  // Offset em "semanas" calendário (domingo→sábado). 0 = semana atual,
  // +1 = próxima, -1 = anterior. A janela SEMPRE começa no domingo daquela
  // semana — não em "hoje" — pra acompanhar o calendário convencional.
  const [weekOffset, setWeekOffset] = useState(0)
  const [eventos, setEventos] = useState<AgendaEvento[]>([])
  const [eventoSelecionado, setEventoSelecionado] =
    useState<AgendaEvento | null>(null)
  // Modal "Adicionar" — abre o EventoFormModal com data pré-preenchida
  const [novoEventoData, setNovoEventoData] = useState<string | null>(null)
  // Modal "Ver todos" — abre listagem dos eventos do dia clicável
  const [verTodosData, setVerTodosData] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dias = useMemo(() => {
    const hoje = new Date()
    const inicioSemana = addDias(hoje, -hoje.getDay()) // domingo desta semana
    const base = addDias(inicioSemana, weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => addDias(base, i))
  }, [weekOffset])

  const hojeIso = useMemo(() => toISODate(new Date()), [])
  const amanhaIso = useMemo(() => toISODate(addDias(new Date(), 1)), [])

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

  function renderDayCol(dia: Date, _idx: number, variant: "desktop" | "mobile") {
    const iso = toISODate(dia)
    const eventosDoDia = eventosPorDia.get(iso) ?? []
    const isHoje = iso === hojeIso
    const isAmanha = iso === amanhaIso
    // Labels relativos quando aplicável; senão usa dia da semana (sempre na
    // mesma coluna porque a semana é alinhada por calendário).
    const label = isHoje
      ? "Hoje"
      : isAmanha
        ? "Amanhã"
        : DIAS_SEMANA_CURTO[dia.getDay()]
    const maxItens = variant === "desktop" ? 4 : 3
    const temMais = eventosDoDia.length > maxItens
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
          </ul>
        )}

        {/* Rodapé do dia: Ver todos (quando há mais que o limite) + Adicionar */}
        {(podeCriar || temMais) && (
          <div className="mt-auto flex items-center justify-between gap-1 border-t border-white/[0.04] pt-1.5">
            {temMais ? (
              <button
                type="button"
                onClick={() => setVerTodosData(iso)}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-white/55 hover:text-white"
                title={`Ver todos (${eventosDoDia.length})`}
              >
                <List className="h-3 w-3" />
                Ver todos ({eventosDoDia.length})
              </button>
            ) : (
              <span />
            )}
            {podeCriar && (
              <button
                type="button"
                onClick={() => setNovoEventoData(iso)}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-nexus-bright hover:text-nexus-bright-soft"
                title="Adicionar evento"
              >
                <Plus className="h-3 w-3" />
                Adicionar
              </button>
            )}
          </div>
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
          <p className="text-sm font-semibold text-white">Esta semana</p>
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
                Esta semana
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

      {/* Adicionar evento — reaproveita o mesmo modal do /agenda */}
      {podeCriar && empresaPadrao && (
        <EventoFormModal
          open={novoEventoData !== null}
          onOpenChange={(o) => !o && setNovoEventoData(null)}
          empresaId={empresaPadrao}
          dataPadrao={novoEventoData}
          onSaved={() => {
            setNovoEventoData(null)
            carregar()
          }}
        />
      )}

      {/* Ver todos os eventos do dia — modal com lista clicável */}
      <Dialog
        open={verTodosData !== null}
        onOpenChange={(o) => !o && setVerTodosData(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {verTodosData
                ? `Eventos · ${formatDiaCompleto(parseISODate(verTodosData))}`
                : "Eventos do dia"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Lista de todos os eventos do dia. Clique em um pra ver detalhes.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {(verTodosData
              ? eventosPorDia.get(verTodosData) ?? []
              : []
            ).map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEventoSelecionado(ev)
                    setVerTodosData(null)
                  }}
                  className="flex w-full items-start gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.cor }}
                  />
                  <div className="min-w-0 flex-1">
                    {ev.horaInicio && (
                      <span className="mr-2 text-xs tabular-nums text-white/55">
                        {ev.horaInicio}
                      </span>
                    )}
                    <span
                      className="text-sm font-medium"
                      style={{ color: ev.cor }}
                    >
                      {ev.titulo}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

function formatDiaCompleto(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0")
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const ano = d.getFullYear()
  return `${DIAS_SEMANA_CURTO[d.getDay()]} ${dia}/${mes}/${ano}`
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
