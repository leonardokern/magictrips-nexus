"use client"

import { Minus, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateInput } from "@/components/ui/date-input"
import { CurrencyInput } from "@/components/ui/currency-input"

export type CampoDinamico = {
  id: string
  nome: string
  tipo_campo: string
  placeholder: string | null
  opcoes: { valor: string }[]
}

type FornecedorOpcao = { id: string; nome: string }

/**
 * Control de um campo dinâmico (campos_extra), sem o wrapper de label/erro —
 * cada consumidor (venda-wizard, pacote-form-modal) envolve com seu próprio
 * `Field`. Mantém o switch por `tipo_campo` num único lugar.
 */
export function CampoDinamicoInput({
  campo,
  value,
  onChange,
  fornecedores = [],
}: {
  campo: CampoDinamico
  value: string
  onChange: (value: string) => void
  fornecedores?: FornecedorOpcao[]
}) {
  if (campo.tipo_campo === "fornecedor") {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={campo.placeholder ?? "Selecione o fornecedor"} />
        </SelectTrigger>
        <SelectContent>
          {fornecedores.map((f) => (
            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (campo.tipo_campo === "dropdown") {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={campo.placeholder ?? "Selecione"} />
        </SelectTrigger>
        <SelectContent>
          {campo.opcoes
            .slice()
            .sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR", { sensitivity: "base" }))
            .map((o) => (
              <SelectItem key={o.valor} value={o.valor}>{o.valor}</SelectItem>
            ))}
        </SelectContent>
      </Select>
    )
  }

  if (campo.tipo_campo === "data") {
    return <DateInput value={value} onChange={onChange} />
  }

  if (campo.tipo_campo === "numero") {
    const n = Math.max(0, parseInt(String(value), 10) || 0)
    const setN = (next: number) => onChange(String(Math.max(0, next)))
    return (
      <div className="flex h-10 w-full items-stretch overflow-hidden rounded-md border border-input bg-background">
        <button
          type="button"
          onClick={() => setN(n - 1)}
          disabled={n <= 0}
          aria-label="Diminuir"
          className="flex w-8 shrink-0 items-center justify-center border-r border-input text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value || "0"}
          onChange={(ev) => onChange(ev.target.value.replace(/[^\d]/g, ""))}
          onFocus={(ev) => ev.target.select()}
          className="min-w-0 flex-1 bg-transparent px-1 text-center text-sm tabular-nums text-white outline-none"
        />
        <button
          type="button"
          onClick={() => setN(n + 1)}
          aria-label="Aumentar"
          className="flex w-8 shrink-0 items-center justify-center border-l border-input text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (campo.tipo_campo === "sim_nao") {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sim">Sim</SelectItem>
          <SelectItem value="nao">Não</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (campo.tipo_campo === "valor") {
    return (
      <CurrencyInput
        value={value}
        placeholder={campo.placeholder ?? "0,00"}
        onChange={onChange}
      />
    )
  }

  return (
    <Input
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      placeholder={campo.placeholder ?? ""}
    />
  )
}

/** Largura semântica (grid-cols-12) por tipo de campo — mesma régua do Passo 2 da venda. */
export function colSpanCampoDinamico(tipoCampo: string): string {
  if (tipoCampo === "numero" || tipoCampo === "sim_nao") return "col-span-6 sm:col-span-2"
  if (tipoCampo === "valor" || tipoCampo === "data") return "col-span-6 sm:col-span-3"
  if (tipoCampo === "texto_curto") return "col-span-6 sm:col-span-2"
  if (tipoCampo === "texto") return "col-span-12 sm:col-span-6"
  return "col-span-12 sm:col-span-4"
}
