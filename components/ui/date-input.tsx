"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { Input } from "./input"
import { cn } from "@/lib/utils"

type Props = {
  value: string // ISO YYYY-MM-DD ou ""
  onChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Data mínima permitida (ISO). Datas anteriores ficam desabilitadas no calendário. */
  min?: string
  /** Data máxima permitida (ISO). Datas posteriores ficam desabilitadas no calendário. */
  max?: string
}

/** Converte ISO (YYYY-MM-DD) → display (DD/MM/AAAA). */
function isoToDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return ""
  return `${d}/${m}/${y}`
}

/** Converte display completo (DD/MM/YYYY) → ISO, ou null se inválido. */
function displayToIso(display: string): string | null {
  if (display.length !== 10) return null
  const [d, m, y] = display.split("/")
  if (!d || !m || !y || y.length !== 4) return null
  const nd = Number(d), nm = Number(m), ny = Number(y)
  if (!nd || !nm || !ny) return null
  // Valida via Date para pegar casos como 31/02
  const date = new Date(ny, nm - 1, nd)
  if (
    date.getFullYear() !== ny ||
    date.getMonth() + 1 !== nm ||
    date.getDate() !== nd
  ) return null
  return `${y}-${m}-${d}`
}

/** Converte ISO → Date local (evita shift de timezone). */
function isoToDate(iso: string): Date | null {
  if (!iso || iso.length !== 10) return null
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Date → ISO YYYY-MM-DD em horário local. */
function dateToIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Aplica máscara DD/MM/AAAA a partir do que o usuário digitou. */
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled,
  className,
  min,
  max,
}: Props) {
  const [display, setDisplay] = useState(() => isoToDisplay(value))
  const [open, setOpen] = useState(false)
  const minDate = useMemo(() => (min ? isoToDate(min) : null), [min])
  const maxDate = useMemo(() => (max ? isoToDate(max) : null), [max])
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = isoToDate(value) ?? (min ? isoToDate(min) : null)
    return d ?? startOfToday()
  })
  const prevIso = useRef(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // O popover é portaled pra document.body, então não está dentro do
  // wrapperRef. Compartilhamos esse ref pra que o handler de clique fora
  // reconheça cliques dentro do calendário como "internos".
  const popoverRef = useRef<HTMLDivElement>(null)

  // Sincroniza quando o prop muda externamente (ex: reset do form)
  useEffect(() => {
    if (value !== prevIso.current) {
      prevIso.current = value
      setDisplay(isoToDisplay(value))
      const d = isoToDate(value)
      if (d) setViewMonth(d)
    }
  }, [value])

  // Fecha ao clicar fora ou Esc
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onClick)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onClick)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Quando abre, posiciona viewMonth no mês do valor atual.
  // Fallback: data mínima (se houver) > hoje.
  useLayoutEffect(() => {
    if (!open) return
    const d = isoToDate(value) ?? minDate ?? null
    setViewMonth(d ?? startOfToday())
  }, [open, value, minDate])

  function isOutOfRange(d: Date): boolean {
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value)
    setDisplay(masked)
    const iso = displayToIso(masked) ?? ""
    // Se a data digitada caiu fora do range, propaga vazio (parent valida e
    // mostra erro). Mantém o display do que foi digitado pra feedback visual.
    const parsed = iso ? isoToDate(iso) : null
    const ok = !parsed || !isOutOfRange(parsed)
    prevIso.current = ok ? iso : ""
    onChange(ok ? iso : "")
  }

  function handlePickDay(day: Date) {
    if (isOutOfRange(day)) return
    const iso = dateToIso(day)
    prevIso.current = iso
    setDisplay(isoToDisplay(iso))
    onChange(iso)
    setOpen(false)
  }

  const selectedDate = useMemo(() => isoToDate(value), [value])
  const today = useMemo(() => startOfToday(), [])

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={() => !disabled && setOpen(true)}
        onClick={() => !disabled && setOpen(true)}
        placeholder={placeholder}
        maxLength={10}
        disabled={disabled}
        className="tabular-nums pr-9"
      />
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Abrir calendário"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CalendarIcon className="h-4 w-4" />
      </button>

      {open && !disabled && (
        <CalendarPopover
          anchorRef={wrapperRef}
          popoverRef={popoverRef}
          viewMonth={viewMonth}
          onChangeViewMonth={setViewMonth}
          selectedDate={selectedDate}
          today={today}
          onPick={handlePickDay}
          isDisabled={isOutOfRange}
        />
      )}
    </div>
  )
}

// ─── Calendar popover ────────────────────────────────────────────────────────

function CalendarPopover({
  anchorRef,
  popoverRef,
  viewMonth,
  onChangeViewMonth,
  selectedDate,
  today,
  onPick,
  isDisabled,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>
  popoverRef: React.RefObject<HTMLDivElement | null>
  viewMonth: Date
  onChangeViewMonth: (d: Date) => void
  selectedDate: Date | null
  today: Date
  onPick: (d: Date) => void
  isDisabled: (d: Date) => boolean
}) {
  // Posicionamento via portal — escapa qualquer overflow:hidden/auto do
  // contêiner pai (ex.: modal scrollável do wizard). Mede o anchor a cada
  // open/scroll/resize e decide se abre pra baixo ou pra cima.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const POPOVER_W = 260
  const POPOVER_H_APROX = 290 // height estimada do calendário

  useLayoutEffect(() => {
    function compute() {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Espaço disponível abaixo do input — se não cabe, abre pra cima.
      const espacoAbaixo = window.innerHeight - r.bottom
      const abrirPraCima = espacoAbaixo < POPOVER_H_APROX + 12 && r.top > POPOVER_H_APROX
      const top = abrirPraCima ? r.top - POPOVER_H_APROX - 4 : r.bottom + 4
      // Alinha à direita se transbordaria o lado direito da viewport.
      let left = r.left
      const overflowDir = r.left + POPOVER_W - window.innerWidth
      if (overflowDir > 0) left = Math.max(8, r.left - overflowDir - 8)
      setPos({ top, left })
    }
    compute()
    window.addEventListener("resize", compute)
    window.addEventListener("scroll", compute, true)
    return () => {
      window.removeEventListener("resize", compute)
      window.removeEventListener("scroll", compute, true)
    }
  }, [anchorRef])

  // Eventos React em conteúdo portaled propagam pela árvore virtual do
  // React — não pela árvore DOM. Mas o DismissableLayer do Radix Dialog
  // escuta `pointerdown` nativo em document, e como o popover (em body)
  // é DOM-ancestral de document, o evento nativo bubble até lá e o Radix
  // entende como "click outside" → fecha/bloqueia. Anexamos um listener
  // nativo direto no popover pra parar a propagação DOM antes de atingir
  // document. Isso preserva o click no botão (target phase) e bloqueia o
  // Radix simultaneamente.
  useEffect(() => {
    const el = popoverRef.current
    if (!el) return
    const stop = (e: Event) => e.stopPropagation()
    el.addEventListener("pointerdown", stop)
    el.addEventListener("mousedown", stop)
    return () => {
      el.removeEventListener("pointerdown", stop)
      el.removeEventListener("mousedown", stop)
    }
  }, [popoverRef, pos])
  // Grade: 6 linhas x 7 colunas, começando no domingo (locale ptBR)
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { locale: ptBR })
    const end = endOfWeek(endOfMonth(viewMonth), { locale: ptBR })
    const result: Date[] = []
    let cur = start
    while (cur <= end) {
      result.push(cur)
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
    }
    // Garante 42 (6 semanas) — preenche se faltar
    while (result.length < 42) {
      const last = result[result.length - 1]!
      result.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))
    }
    return result.slice(0, 42)
  }, [viewMonth])

  const weekdayLabels = useMemo(() => {
    const base = startOfWeek(new Date(), { locale: ptBR })
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
      return format(d, "EEEEE", { locale: ptBR }).toUpperCase()
    })
  }, [])

  function go(delta: number) {
    onChangeViewMonth(delta < 0 ? subMonths(viewMonth, -delta) : addMonths(viewMonth, delta))
  }

  if (typeof document === "undefined" || !pos) return null

  return createPortal(
    <div
      ref={popoverRef as React.RefObject<HTMLDivElement>}
      role="dialog"
      // pointer-events: auto cobre o caso do Radix Dialog setar
      // pointer-events: none no body quando o modal está aberto — sem isso
      // o calendário renderiza mas não recebe cliques.
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: POPOVER_W,
        pointerEvents: "auto",
      }}
      className="z-[60] rounded-md border border-white/10 bg-[#0b1424] p-3 shadow-xl shadow-black/40"
    >
      {/* Header: navegação por mês + ano */}
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => go(-12)}
          aria-label="Ano anterior"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <ChevronLeft className="h-3.5 w-3.5 -ml-2" />
        </button>
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Mês anterior"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-xs font-medium uppercase tracking-wider text-white/80">
          {format(viewMonth, "MMMM yyyy", { locale: ptBR })}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Próximo mês"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => go(12)}
          aria-label="Próximo ano"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          <ChevronRight className="h-3.5 w-3.5 -ml-2" />
        </button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="flex h-6 items-center justify-center text-[10px] font-semibold text-white/35"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, viewMonth)
          const isToday = isSameDay(d, today)
          const isSelected = selectedDate ? isSameDay(d, selectedDate) : false
          const disabled = isDisabled(d)
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onPick(d)}
              disabled={disabled}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded text-xs tabular-nums transition-colors",
                inMonth ? "text-white/85" : "text-white/25",
                !isSelected && !disabled && "hover:bg-white/[0.08]",
                isToday && !isSelected && "ring-1 ring-inset ring-white/15",
                isSelected &&
                  "bg-nexus-bright text-white hover:bg-nexus-bright/90",
                disabled &&
                  "cursor-not-allowed text-white/15 line-through hover:bg-transparent",
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      {/* Atalho hoje */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => !isDisabled(today) && onPick(today)}
          disabled={isDisabled(today)}
          className="text-[11px] text-nexus-bright/80 hover:text-nexus-bright disabled:cursor-not-allowed disabled:text-white/25"
        >
          Hoje
        </button>
      </div>
    </div>,
    document.body,
  )
}
