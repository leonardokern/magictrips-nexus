"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type OpcaoUsuario = {
  id: string
  nome: string
  perfilNome: string
}

type Props = {
  opcoes: OpcaoUsuario[]
  /** IDs selecionados. */
  value: string[]
  onChange: (ids: string[]) => void
  /** Texto do campo quando nada está selecionado. */
  placeholder?: string
  /** Texto exibido quando a lista de opções está vazia. */
  emptyMessage?: string
  disabled?: boolean
}

/**
 * Multi-select estilo combobox com busca embarcada e chips removíveis.
 *
 * Padrões de UX:
 *  - Click no campo abre dropdown + dá foco no input de busca.
 *  - Esc / click fora fecha. Backspace com query vazia remove a última chip.
 *  - Setas ↑ ↓ navegam, Enter seleciona o destacado.
 *  - Itens já selecionados aparecem com check + opacidade reduzida (sem somem).
 *  - Hover/foco do item destaca em azul Nexus.
 */
export function UsuariosMultiSelect({
  opcoes,
  value,
  onChange,
  placeholder = "Buscar usuário…",
  emptyMessage = "Nenhum usuário disponível.",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Click fora fecha
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  // Quando abre, foca no input
  useEffect(() => {
    if (open) {
      // pequeno timeout pra esperar render do dropdown
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
    setQuery("")
    setHighlight(0)
  }, [open])

  const selecionados = useMemo(
    () => opcoes.filter((o) => value.includes(o.id)),
    [opcoes, value],
  )

  const filtradas = useMemo(() => {
    const q = norm(query)
    if (!q) return opcoes
    return opcoes.filter((o) => norm(o.nome).includes(q) || norm(o.perfilNome).includes(q))
  }, [opcoes, query])

  // Reset highlight quando filtro muda
  useEffect(() => {
    setHighlight(0)
  }, [query])

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  function remover(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    onChange(value.filter((v) => v !== id))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === "Backspace" && query === "" && selecionados.length > 0) {
      const ultimo = selecionados[selecionados.length - 1]
      if (ultimo) remover(ultimo.id)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtradas.length - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const op = filtradas[highlight]
      if (op) toggle(op.id)
      return
    }
  }

  const semOpcoes = opcoes.length === 0

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger / box com chips */}
      <button
        type="button"
        disabled={disabled || semOpcoes}
        onClick={() => !disabled && !semOpcoes && setOpen((s) => !s)}
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-left text-sm transition-colors",
          "hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-bright/40",
          (disabled || semOpcoes) && "cursor-not-allowed opacity-60",
        )}
      >
        {selecionados.length === 0 ? (
          <span className="flex-1 px-1 text-sm text-white/40">
            {semOpcoes ? emptyMessage : placeholder}
          </span>
        ) : (
          <>
            {selecionados.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-md border border-nexus-bright/30 bg-nexus-bright/[0.12] px-2 py-0.5 text-xs text-nexus-bright"
              >
                <span className="max-w-[140px] truncate">{u.nome}</span>
                <span
                  role="button"
                  aria-label={`Remover ${u.nome}`}
                  tabIndex={-1}
                  onClick={(ev) => remover(u.id, ev)}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-nexus-bright/70 transition-colors hover:bg-nexus-bright/20 hover:text-nexus-bright"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/40" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar por nome ou perfil…"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-sm p-0.5 text-white/40 hover:bg-white/[0.06] hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lista */}
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
            onMouseLeave={() => setHighlight(-1)}
          >
            {filtradas.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-white/40">
                Nenhum resultado.
              </li>
            ) : (
              filtradas.map((u, i) => {
                const selecionado = value.includes(u.id)
                const destacado = i === highlight
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selecionado}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => toggle(u.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                        destacado
                          ? "bg-nexus-bright/15 text-white"
                          : "text-white/85 hover:bg-white/[0.04]",
                        selecionado && !destacado && "text-white/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                          selecionado
                            ? "border-nexus-bright bg-nexus-bright text-white"
                            : "border-white/20",
                        )}
                      >
                        {selecionado && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="flex-1 truncate">{u.nome}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/35">
                        {u.perfilNome}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          {/* Rodapé com contador */}
          {value.length > 0 && (
            <div className="border-t border-white/[0.06] px-3 py-1.5 text-[10px] text-white/45">
              {value.length} selecionado(s)
              <button
                type="button"
                onClick={() => onChange([])}
                className="ml-3 text-nexus-bright hover:text-nexus-bright-soft"
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helper ────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}
