"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TIPOS_FORNECEDOR_OPCOES,
  type TipoFornecedor,
} from "@/lib/schemas/fornecedor"
import { formatCnpjPartial, onlyDigits } from "@/lib/utils/formatters"
import {
  createFornecedor,
  updateFornecedor,
} from "@/app/(dashboard)/fornecedores/actions"

type Props =
  | { mode: "create" }
  | {
      mode: "edit"
      id: string
      initial: {
        nome: string
        cnpj: string
        tipo: TipoFornecedor | null
      }
    }

type FormState = {
  nome: string
  cnpj: string
  tipo: TipoFornecedor | ""
}

export function FornecedorForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isCreate = props.mode === "create"
  const initial = isCreate ? null : props.initial

  const [v, setV] = useState<FormState>({
    nome: initial?.nome ?? "",
    cnpj: initial?.cnpj ?? "",
    tipo: initial?.tipo ?? "",
  })

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }))
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    startTransition(async () => {
      const payload = {
        nome: v.nome,
        cnpj: onlyDigits(v.cnpj),
        tipo: v.tipo || undefined,
      }

      if (isCreate) {
        const result = await createFornecedor(payload)
        if (!result.ok) {
          if (result.fieldErrors) setErrors(result.fieldErrors)
          toast.error(result.error)
          return
        }
        toast.success("Fornecedor criado.")
        if (result.data?.id) router.push(`/fornecedores/${result.data.id}`)
        else router.push("/fornecedores")
        return
      }

      // Edit
      const result = await updateFornecedor(props.id, payload)
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        toast.error(result.error)
        return
      }
      toast.success("Fornecedor atualizado.")
      router.push(`/fornecedores/${props.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Dados do fornecedor
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nome *" error={errors.nome} className="md:col-span-2">
            <Input
              value={v.nome}
              onChange={(e) => update("nome", e.target.value)}
              required
              placeholder="ex: OTT Viagens"
            />
          </Field>

          <Field label="CNPJ *" error={errors.cnpj}>
            <Input
              value={formatCnpjPartial(v.cnpj)}
              onChange={(e) => update("cnpj", onlyDigits(e.target.value))}
              maxLength={18}
              required
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              className="font-mono"
            />
          </Field>

          <Field label="Tipo" error={errors.tipo}>
            <Select
              value={v.tipo || undefined}
              onValueChange={(val) => update("tipo", val as TipoFornecedor)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FORNECEDOR_OPCOES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Separator className="bg-white/[0.06]" />

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
          className="text-white/70 hover:bg-white/[0.04] hover:text-white"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-indigo-500 text-white hover:bg-indigo-400"
        >
          {isPending
            ? "Salvando..."
            : isCreate
              ? "Criar fornecedor"
              : "Salvar alterações"}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/55">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
