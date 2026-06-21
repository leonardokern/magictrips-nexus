"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { PAISES } from "@/lib/data/paises"

type Props = {
  value: string
  onChange: (codigo: string) => void
  disabled?: boolean
  placeholder?: string
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

export function PaisCombobox({
  value,
  onChange,
  disabled,
  placeholder = "Selecione o país",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = PAISES.find((p) => p.codigo === value)

  const filtrados = (() => {
    const q = normalizar(query)
    if (!q) return PAISES
    return PAISES.filter((p) => normalizar(p.nome).includes(q))
  })()

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((s) => !s)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate">{selected ? selected.nome : placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhum país encontrado.
              </p>
            ) : (
              filtrados.map((pais) => (
                <button
                  key={pais.codigo}
                  type="button"
                  onClick={() => {
                    onChange(pais.codigo)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">{pais.nome}</span>
                  {pais.codigo === value && (
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
