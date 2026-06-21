"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Input } from "@/components/ui/input"

type Props = {
  q?: string
}

export function ClientesFilters({ q }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (!value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    next.delete("page")
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
          window.clearTimeout((window as unknown as { __qDebounce?: number }).__qDebounce)
          ;(window as unknown as { __qDebounce?: number }).__qDebounce =
            window.setTimeout(() => updateParam("q", value), 300)
        }}
        className="max-w-sm"
      />
    </div>
  )
}
