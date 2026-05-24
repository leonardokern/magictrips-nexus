"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

type Props = {
  /** UF selecionada — alimenta a lista de cidades via IBGE. */
  uf: string | undefined
  /** Cidade atual (texto). */
  value: string
  onChange: (cidade: string) => void
  disabled?: boolean
  placeholder?: string
  /** Mostra placeholder de "Selecione um estado antes" quando uf vazio. */
  semUfMsg?: string
}

/**
 * Combobox de cidades. Quando o `uf` muda, busca a lista de municípios do
 * IBGE (cacheada em-memória no componente). Mostra um input de busca dentro
 * do dropdown que filtra a lista por substring (insensível a acentos).
 *
 * Sem dependência de cmdk/popover — implementado com state + click-outside.
 */
export function CidadeCombobox({
  uf,
  value,
  onChange,
  disabled,
  placeholder = "Selecione a cidade",
  semUfMsg = "Selecione um estado antes",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [cidades, setCidades] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Busca cidades quando UF muda
  useEffect(() => {
    if (!uf) {
      setCidades([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    )
      .then((r) => r.json())
      .then((data: Array<{ nome: string }>) => {
        if (cancelled) return
        setCidades(data.map((c) => c.nome))
      })
      .catch(() => {
        if (!cancelled) setCidades([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [uf])

  // Click-outside fecha o dropdown
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  // Filtra por query (case-insensitive, sem acentos)
  const filtradas = (() => {
    const q = normalizar(query)
    if (!q) return cidades
    return cidades.filter((c) => normalizar(c).includes(q))
  })()

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((s) => !s)}
        disabled={disabled || !uf}
        data-placeholder={!value ? "" : undefined}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        )}
      >
        <span className="truncate">
          {value || (uf ? placeholder : semUfMsg)}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && uf && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cidade…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Spinner size="xs" />
                <span>Carregando cidades…</span>
              </div>
            ) : filtradas.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {query ? "Nenhuma cidade encontrada." : "Sem dados."}
              </p>
            ) : (
              filtradas.slice(0, 200).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange(c)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">{c}</span>
                  {c === value && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-nexus-bright" />
                  )}
                </button>
              ))
            )}
            {!loading && filtradas.length > 200 && (
              <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">
                Mostrando 200 de {filtradas.length}. Refine a busca.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}
