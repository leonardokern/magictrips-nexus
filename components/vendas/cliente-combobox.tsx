"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Search, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatCpf } from "@/lib/utils/formatters"

export type ClienteOption = {
  id: string
  nome: string
  cpf: string
  email: string
  empresa_id: string
  /** Usados no Step 4 ao pré-preencher passageiro com dados do cliente. */
  data_nascimento?: string | null
  passaporte?: string | null
}

type Props = {
  /** Lista pra escolher (filtrada pela empresa selecionada no wizard). */
  clientes: ClienteOption[]
  /** id do cliente selecionado, "novo" para cadastrar novo, ou null. */
  value: string | "novo" | null
  onChange: (value: string | "novo" | null) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Combobox de cliente com busca local por nome/CPF/email.
 * Sempre mostra a opção "Outro / Cadastrar novo" no topo (mesmo com filtro).
 */
export function ClienteCombobox({
  clientes,
  value,
  onChange,
  disabled,
  placeholder = "Buscar cliente por nome, CPF ou e-mail",
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

  const selecionado = useMemo(() => {
    if (value === "novo") return { tipo: "novo" as const }
    if (value) {
      const c = clientes.find((x) => x.id === value)
      if (c) return { tipo: "existente" as const, cliente: c }
    }
    return null
  }, [value, clientes])

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clientes.slice(0, 20)
    return clientes
      .filter((c) => {
        const haystack = `${c.nome} ${c.cpf} ${c.email}`.toLowerCase()
        return haystack.includes(q) || c.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      })
      .slice(0, 30)
  }, [query, clientes])

  function pick(id: string | "novo") {
    onChange(id)
    setOpen(false)
    setQuery("")
  }

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Trigger / display */}
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm",
          "transition-colors hover:bg-white/[0.06]",
          disabled && "cursor-not-allowed opacity-60",
          !selecionado && "text-white/40",
        )}
      >
        {selecionado?.tipo === "novo" ? (
          <span className="flex items-center gap-2 text-nexus-bright">
            <UserPlus className="h-4 w-4" />
            Cadastrar novo cliente
          </span>
        ) : selecionado?.tipo === "existente" ? (
          <span className="flex flex-1 items-center gap-3 truncate text-white">
            <span className="truncate">{selecionado.cliente.nome}</span>
            <span className="shrink-0 font-mono text-xs text-white/45">
              {formatCpf(selecionado.cliente.cpf)}
            </span>
          </span>
        ) : (
          <span>Selecione o cliente</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-white/40" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-12 z-30 max-h-80 overflow-hidden rounded-xl border border-white/[0.08] bg-card/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/[0.06] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="h-8 border-white/10 bg-white/[0.04] pl-8 text-sm"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {/* Opção "Outro" sempre no topo */}
            <button
              type="button"
              onClick={() => pick("novo")}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                value === "novo"
                  ? "bg-nexus-bright/10 text-nexus-bright"
                  : "text-white/85 hover:bg-white/[0.04]",
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-nexus-bright/30 bg-nexus-bright/10">
                <UserPlus className="h-3.5 w-3.5 text-nexus-bright" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Cadastrar novo cliente</p>
                <p className="text-[11px] text-white/45">
                  Preenche os dados básicos no próximo passo
                </p>
              </div>
              {value === "novo" && <Check className="h-4 w-4 text-nexus-bright" />}
            </button>

            {filtrados.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-white/45">
                Nenhum cliente encontrado.
              </p>
            ) : (
              filtrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    value === c.id
                      ? "bg-white/[0.06] text-white"
                      : "text-white/85 hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-medium text-white/70">
                    {iniciais(c.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.nome}</p>
                    <p className="truncate text-[11px] text-white/45">
                      {formatCpf(c.cpf)} · {c.email || "sem e-mail"}
                    </p>
                  </div>
                  {value === c.id && (
                    <Check className="h-4 w-4 text-nexus-bright" />
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

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}
