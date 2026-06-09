"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Empresa = { id: string; nome: string }

type Props = {
  q?: string
  tipo?: string
  status?: string
  empresaId?: string
  empresas?: Empresa[]
  showEmpresaFilter?: boolean
}

export function ClientesFilters({
  q,
  tipo,
  status,
  empresaId,
  empresas,
  showEmpresaFilter,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === "todos") {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    next.delete("page") // reset paginação ao filtrar
    startTransition(() => {
      router.push(`/clientes?${next.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Buscar por nome, CPF, CNPJ, passaporte ou e-mail..."
        defaultValue={q ?? ""}
        onChange={(e) => {
          const value = e.target.value
          // debounce simples — substituir por hook próprio depois se virar repetitivo
          window.clearTimeout((window as unknown as { __qDebounce?: number }).__qDebounce)
          ;(window as unknown as { __qDebounce?: number }).__qDebounce =
            window.setTimeout(() => updateParam("q", value), 300)
        }}
        className="max-w-sm"
      />

      <div className="hidden md:contents">
        <Select
          value={tipo ?? "todos"}
          onValueChange={(v) => updateParam("tipo", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="faturado">Faturado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={status ?? "todos"}
          onValueChange={(v) => updateParam("status", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>

        {showEmpresaFilter && empresas && empresas.length > 0 && (
          <Select
            value={empresaId ?? "todas"}
            onValueChange={(v) => updateParam("empresa", v === "todas" ? null : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
