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

type Perfil = { id: string; nome: string }
type Empresa = { id: string; nome: string }

type Props = {
  q?: string
  perfilId?: string
  status?: string
  empresaId?: string
  perfis: Perfil[]
  empresas?: Empresa[]
  showEmpresaFilter?: boolean
}

export function UsuariosFilters({
  q,
  perfilId,
  status,
  empresaId,
  perfis,
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
    next.delete("page")
    startTransition(() => router.push(`/usuarios?${next.toString()}`))
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Buscar por nome ou e-mail..."
        defaultValue={q ?? ""}
        onChange={(e) => {
          const value = e.target.value
          window.clearTimeout((window as unknown as { __qDebounce?: number }).__qDebounce)
          ;(window as unknown as { __qDebounce?: number }).__qDebounce =
            window.setTimeout(() => updateParam("q", value), 300)
        }}
        className="max-w-sm"
      />

      <Select
        value={perfilId ?? "todos"}
        onValueChange={(v) => updateParam("perfil", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Perfil" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os perfis</SelectItem>
          {perfis.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome}
            </SelectItem>
          ))}
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
  )
}
