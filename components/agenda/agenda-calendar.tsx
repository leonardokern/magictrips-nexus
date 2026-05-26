"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Banknote,
  CreditCard,
  Plane,
  Bell,
  StickyNote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { formatBRL } from "@/lib/utils/sum-parser"
import { listarEventosAgenda, type AgendaEvento } from "@/app/(dashboard)/agenda/actions"
import { EventoFormModal } from "./evento-form-modal"
import { EventoDetalhePopover } from "./evento-detalhe-popover"

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

type Categoria = {
  key: AgendaEvento["tipo"] | "viagem"
  label: string
  cor: string
  icon: typeof CalendarIcon
}

// Categorias visíveis pra Admin/Gerente
const CATEGORIAS_OPERACAO: Categoria[] = [
  { key: "conta_receber", label: "Contas a receber", cor: "#fbbf24", icon: Banknote },
  { key: "cartao_fechamento", label: "Cartões — fechamento", cor: "#60a5fa", icon: CreditCard },
  { key: "cartao_vencimento", label: "Cartões — vencimento", cor: "#1498D5", icon: CreditCard },
  { key: "viagem_inicio", label: "Viagens", cor: "#c084fc", icon: Plane },
]

// Categorias visíveis pra todos
const CATEGORIAS_PESSOAIS: Categoria[] = [
  { key: "lembrete", label: "Lembretes do sistema", cor: "#fb923c", icon: Bell },
  { key: "nota", label: "Notas", cor: "#1498D5", icon: StickyNote },
  { key: "reuniao", label: "Reuniões", cor: "#a855f7", icon: CalendarIcon },
  { key: "tarefa", label: "Tarefas", cor: "#10b981", icon: CalendarIcon },
]

type Props = {
  empresas: { id: string; nome: string }[]
  empresaPadrao: string | null
  podeCriar: boolean
  podeVerOperacao: boolean
}

export function AgendaCalendar({ empresaPadrao, podeCriar, podeVerOperacao }: Props) {
  const hoje = useMemo(() => new Date(), [])
  const [mesAtual, setMesAtual] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [eventos, setEventos] = useState<AgendaEvento[]>([])
  const [filtrosAtivos, setFiltrosAtivos] = useState<Set<string>>(
    () => new Set([
      ...CATEGORIAS_OPERACAO.map((c) => c.key),
      ...CATEGORIAS_PESSOAIS.map((c) => c.key),
    ]),
  )
  const [loading, startLoading] = useTransition()
  const [criarOpen, setCriarOpen] = useState(false)
  const [diaSelecionadoParaCriar, setDiaSelecionadoParaCriar] = useState<string | null>(null)
  const [eventoDetalhe, setEventoDetalhe] = useState<AgendaEvento | null>(null)

  // Range do mês visível (com padding para semanas)
  const { rangeInicio, rangeFim, semanas } = useMemo(() => {
    const primeiroDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
    const ultimoDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0)
    // Calendário começa no domingo da primeira semana
    const inicioGrid = new Date(primeiroDia)
    inicioGrid.setDate(inicioGrid.getDate() - inicioGrid.getDay())
    // Calendário termina no sábado da última semana
    const fimGrid = new Date(ultimoDia)
    fimGrid.setDate(fimGrid.getDate() + (6 - fimGrid.getDay()))

    const dias: Date[] = []
    const cur = new Date(inicioGrid)
    while (cur <= fimGrid) {
      dias.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    // Quebra em semanas de 7
    const semanasArr: Date[][] = []
    for (let i = 0; i < dias.length; i += 7) {
      semanasArr.push(dias.slice(i, i + 7))
    }

    return {
      rangeInicio: toISODate(inicioGrid),
      rangeFim: toISODate(fimGrid),
      semanas: semanasArr,
    }
  }, [mesAtual])

  // Carrega eventos quando muda o mês
  useEffect(() => {
    startLoading(async () => {
      const r = await listarEventosAgenda(rangeInicio, rangeFim)
      if (r.ok && r.data) setEventos(r.data)
      else if (!r.ok) setEventos([])
    })
  }, [rangeInicio, rangeFim])

  // Abre popover automaticamente quando navegar com ?evento=<id>
  // (ex: clique em notificação "Evento compartilhado com você").
  const searchParams = useSearchParams()
  useEffect(() => {
    const eventoId = searchParams.get("evento")
    if (!eventoId || eventos.length === 0) return
    // Eventos da agenda manual têm id "ag-<uuid>". Casamos pela parte do UUID.
    const alvo = eventos.find(
      (e) => e.referenciaTipo === "agenda" && e.referenciaId === eventoId,
    )
    if (alvo) {
      setEventoDetalhe(alvo)
      // Garante que o mês exibido contém a data do evento
      const [y, m] = alvo.dia.split("-").map(Number)
      if (y && m && (y !== mesAtual.getFullYear() || m - 1 !== mesAtual.getMonth())) {
        setMesAtual(new Date(y, m - 1, 1))
      }
    }
  }, [searchParams, eventos, mesAtual])

  // Mapa dia → eventos filtrados
  const eventosPorDia = useMemo(() => {
    const map = new Map<string, AgendaEvento[]>()
    for (const e of eventos) {
      if (!filtrosAtivos.has(e.tipo)) continue
      const arr = map.get(e.dia) ?? []
      arr.push(e)
      map.set(e.dia, arr)
    }
    // Ordena por horário (eventos com hora antes), depois título
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.horaInicio && b.horaInicio) return a.horaInicio.localeCompare(b.horaInicio)
        if (a.horaInicio && !b.horaInicio) return -1
        if (!a.horaInicio && b.horaInicio) return 1
        return a.titulo.localeCompare(b.titulo)
      })
    }
    return map
  }, [eventos, filtrosAtivos])

  // Contagens por categoria
  const contagens = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of eventos) {
      c[e.tipo] = (c[e.tipo] ?? 0) + 1
    }
    return c
  }, [eventos])

  function navegar(delta: number) {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1))
  }

  function irParaHoje() {
    setMesAtual(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  }

  function toggleFiltro(key: string) {
    const novo = new Set(filtrosAtivos)
    if (novo.has(key)) novo.delete(key)
    else novo.add(key)
    setFiltrosAtivos(novo)
  }

  function abrirCriarEvento(dia?: string) {
    setDiaSelecionadoParaCriar(dia ?? toISODate(hoje))
    setCriarOpen(true)
  }

  async function recarregar() {
    startLoading(async () => {
      const r = await listarEventosAgenda(rangeInicio, rangeFim)
      if (r.ok && r.data) setEventos(r.data)
    })
  }

  const categoriasVisiveis = podeVerOperacao
    ? [...CATEGORIAS_OPERACAO, ...CATEGORIAS_PESSOAIS]
    : CATEGORIAS_PESSOAIS

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      {/* ── Sidebar: filtros ──────────────────────────────────────── */}
      <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
        {podeCriar && (
          <Button
            onClick={() => abrirCriarEvento()}
            className="w-full bg-nexus-bright hover:bg-nexus-bright-soft"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo evento
          </Button>
        )}

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            Categorias
          </p>
          <ul className="space-y-0.5">
            {categoriasVisiveis.map((cat) => {
              const ativo = filtrosAtivos.has(cat.key)
              const Icon = cat.icon
              const count = contagens[cat.key] ?? 0
              return (
                <li key={cat.key}>
                  <button
                    type="button"
                    onClick={() => toggleFiltro(cat.key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.04]"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        ativo ? "border-white/30" : "border-white/15",
                      )}
                      style={ativo ? { backgroundColor: cat.cor } : undefined}
                    >
                      {ativo && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
                          <path
                            d="M2 6.5l2.5 2.5L10 3.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    <span className={cn("flex-1 truncate", ativo ? "text-white/85" : "text-white/45")}>
                      {cat.label}
                    </span>
                    {count > 0 && (
                      <span className="shrink-0 text-[10px] tabular-nums text-white/35">
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      {/* ── Calendário ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        {/* Header de navegação */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={irParaHoje} className="h-8">
              Hoje
            </Button>
            <button
              type="button"
              onClick={() => navegar(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/70 hover:bg-white/[0.04] hover:text-white"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navegar(1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/70 hover:bg-white/[0.04] hover:text-white"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <h3 className="ml-2 text-base font-semibold tracking-tight text-white">
              {MESES_PT[mesAtual.getMonth()]} de {mesAtual.getFullYear()}
            </h3>
          </div>
          {loading && <Spinner size="sm" className="text-nexus-bright" />}
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.015]">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-white/45"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid de semanas */}
        <div className="divide-y divide-white/[0.04]">
          {semanas.map((semana, i) => (
            <div key={i} className="grid grid-cols-7 divide-x divide-white/[0.04]">
              {semana.map((dia) => {
                const iso = toISODate(dia)
                const evs = eventosPorDia.get(iso) ?? []
                const noMes = dia.getMonth() === mesAtual.getMonth()
                const ehHoje = sameDay(dia, hoje)
                const visiveis = evs.slice(0, 3)
                const restantes = evs.length - visiveis.length

                return (
                  <div
                    key={iso}
                    className={cn(
                      "group relative min-h-[110px] cursor-pointer p-1.5 transition-colors hover:bg-white/[0.02]",
                      !noMes && "bg-white/[0.01] opacity-50",
                    )}
                    onClick={(e) => {
                      // Só abre o criar evento se for clique no fundo do dia, não nos chips
                      if ((e.target as HTMLElement).closest("[data-evento-chip]")) return
                      if (podeCriar) abrirCriarEvento(iso)
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center text-xs tabular-nums",
                          ehHoje
                            ? "rounded-full bg-nexus-bright font-semibold text-white"
                            : noMes
                              ? "text-white/85"
                              : "text-white/35",
                        )}
                      >
                        {dia.getDate()}
                      </span>
                    </div>

                    <ul className="space-y-0.5">
                      {visiveis.map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            data-evento-chip
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setEventoDetalhe(e)
                            }}
                            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] transition-opacity hover:opacity-90"
                            style={{ backgroundColor: e.cor + "22", color: e.cor }}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: e.cor }}
                            />
                            {e.horaInicio && (
                              <span className="shrink-0 tabular-nums opacity-80">
                                {e.horaInicio}
                              </span>
                            )}
                            <span className="truncate font-medium">
                              {e.titulo}
                            </span>
                          </button>
                        </li>
                      ))}
                      {restantes > 0 && (
                        <li className="px-1 text-[10px] text-white/45">
                          +{restantes} mais
                        </li>
                      )}
                    </ul>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Modais ────────────────────────────────────────────────── */}
      {podeCriar && (
        <EventoFormModal
          open={criarOpen}
          onOpenChange={setCriarOpen}
          empresaId={empresaPadrao ?? ""}
          dataPadrao={diaSelecionadoParaCriar}
          onSaved={() => {
            setCriarOpen(false)
            recarregar()
          }}
        />
      )}

      <EventoDetalhePopover
        evento={eventoDetalhe}
        onClose={() => setEventoDetalhe(null)}
        onDeleted={recarregar}
      />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// formatBRL importado mas não usado aqui — fica para o popover/modal
void formatBRL
