"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type CartaoOption = {
  id: string
  nome: string
  dia_vencimento: number
}

type Props = {
  cartoes: CartaoOption[]
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Combobox de cartão da agência. Busca por nome — facilita encontrar entre
 * vários cartões cadastrados sem ter que rolar a lista inteira.
 *
 * Mesmo padrão visual do `ClienteCombobox`: dropdown com search bar no
 * topo, lista virtualizada, click-outside pra fechar.
 */
export function CartaoCombobox({
  cartoes,
  value,
  onChange,
  disabled,
  placeholder = "Selecione o cartão",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const selecionado = useMemo(
    () => (value ? cartoes.find((c) => c.id === value) ?? null : null),
    [value, cartoes],
  )

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cartoes
    return cartoes.filter((c) => c.nome.toLowerCase().includes(q))
  }, [query, cartoes])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
    setQuery("")
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((s) => !s)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm",
          "transition-colors hover:bg-white/[0.06]",
          disabled && "cursor-not-allowed opacity-60",
          !selecionado && "text-white/40",
        )}
      >
        {selecionado ? (
          <span className="flex flex-1 items-center gap-2 truncate text-white">
            <span className="truncate">{selecionado.nome}</span>
            <span className="shrink-0 text-xs text-white/45">
              (venc. {selecionado.dia_vencimento})
            </span>
          </span>
        ) : (
          <span>{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-white/40" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-12 z-30 max-h-80 overflow-hidden rounded-xl border border-white/[0.08] bg-card/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/[0.06] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cartão por nome…"
                className="h-9 border-white/10 bg-white/[0.04] pl-8 text-sm"
              />
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <li className="px-4 py-3 text-center text-xs text-white/40">
                Nenhum cartão encontrado.
              </li>
            ) : (
              filtrados.map((c) => {
                const ativo = c.id === value
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                        ativo
                          ? "bg-nexus-bright/15 text-nexus-bright"
                          : "text-white/85 hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      <span className="flex flex-1 items-center gap-2 truncate">
                        <span className="truncate">{c.nome}</span>
                        <span className="shrink-0 text-xs text-white/45">
                          venc. {c.dia_vencimento}
                        </span>
                      </span>
                      {ativo && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
