"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { DDI_LIST, DDI_DEFAULT, getDDI, normalizarBusca } from "@/lib/constants/ddi"
import { formatTelefonePartial } from "@/lib/utils/formatters"

type PhoneInputProps = {
  /** Código DDI selecionado, ex: "+55" */
  ddi: string
  onDdiChange: (ddi: string) => void
  /** Número de telefone (sem o DDI) */
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  required?: boolean
  /** Placeholder do campo de número */
  placeholder?: string
  /** Classe extra para o wrapper */
  className?: string
}

/**
 * Campo de telefone com seletor de DDI (prefixo internacional).
 *
 * - Seletor: dropdown pesquisável, seguindo o padrão CidadeCombobox.
 * - Brasil (+55): aplica máscara progressiva "(11) 91234-5678".
 * - Internacional: aceita texto livre (dígitos, espaços, hifens).
 * - Sem dependências externas — state + click-outside.
 */
export function PhoneInput({
  ddi,
  onDdiChange,
  value,
  onChange,
  disabled,
  required,
  placeholder,
  className,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = getDDI(ddi || DDI_DEFAULT)
  const isBR = ddi === "+55"

  // Filtra DDIs pela query
  const filtrados = (() => {
    const q = normalizarBusca(query)
    if (!q) return DDI_LIST
    return DDI_LIST.filter(
      (d) =>
        normalizarBusca(d.country).includes(q) ||
        d.code.includes(q),
    )
  })()

  // Click-outside fecha o dropdown
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  function handlePhoneChange(raw: string) {
    // Remove qualquer char fora do conjunto permitido: dígitos, espaço, (, ), -
    const sanitized = raw.replace(/[^0-9 ()\-]/g, "")
    if (isBR) {
      onChange(formatTelefonePartial(sanitized))
    } else {
      onChange(sanitized.slice(0, 20))
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative flex", className)}>
      {/* ── Trigger DDI ─────────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "flex h-10 shrink-0 items-center gap-1.5 rounded-l-md rounded-r-none border border-r-0 border-input bg-background px-2.5 text-sm ring-offset-background transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-2 ring-ring ring-offset-2",
        )}
        aria-label="Selecionar DDI"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {selected.code}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* ── Campo número ─────────────────────────────────────────────────── */}
      <input
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => handlePhoneChange(e.target.value)}
        placeholder={placeholder ?? (isBR ? "(11) 91234-5678" : "Número")}
        maxLength={isBR ? 15 : 20}
        required={required}
        disabled={disabled}
        className={cn(
          "flex h-10 min-w-0 flex-1 rounded-l-none rounded-r-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-72 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {/* Busca */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país ou código…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Lista */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhum país encontrado.
              </p>
            ) : (
              filtrados.map((d) => (
                <button
                  key={`${d.code}-${d.country}`}
                  type="button"
                  onClick={() => {
                    onDdiChange(d.code)
                    // Se mudou de BR pra internacional ou vice-versa, limpa o número
                    if ((d.code === "+55") !== isBR) onChange("")
                    setOpen(false)
                    setQuery("")
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <span className="text-base leading-none">{d.flag}</span>
                  <span className="flex-1 truncate">{d.country}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {d.code}
                  </span>
                  {d.code === ddi && d.country === selected.country && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-nexus-bright" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
