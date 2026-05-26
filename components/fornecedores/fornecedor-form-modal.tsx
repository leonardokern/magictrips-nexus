"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Building2, Hash, Layers, Package, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type TipoProduto = { id: string; nome: string; icone: string | null }

type ModeProps =
  | { mode: "create" }
  | {
      mode: "edit"
      id: string
      initial: {
        nome: string
        cnpj: string
        tipo: TipoFornecedor | null
        tiposProdutoIds: string[]
        modoComissionado: boolean
        modoComissionadoDia: number | null
        modoNet: boolean
      }
    }

type Props = ModeProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  tiposProduto: TipoProduto[]
  /** Modo somente leitura: todos os campos desabilitados, footer só tem "Fechar". */
  readOnly?: boolean
}

type FormState = {
  nome: string
  cnpj: string
  tipo: TipoFornecedor | ""
  tiposProdutoIds: string[]
  modoComissionado: boolean
  modoComissionadoDia: string // string para o input, parseado no submit
  modoNet: boolean
}

const EMPTY: FormState = {
  nome: "",
  cnpj: "",
  tipo: "",
  tiposProdutoIds: [],
  modoComissionado: false,
  modoComissionadoDia: "",
  modoNet: false,
}

export function FornecedorFormModal(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<FormState>(EMPTY)

  const isCreate = props.mode === "create"
  const readOnly = props.readOnly ?? false

  useEffect(() => {
    if (!props.open) return
    setErrors({})
    if (props.mode === "edit") {
      setV({
        nome: props.initial.nome,
        cnpj: props.initial.cnpj,
        tipo: props.initial.tipo ?? "",
        tiposProdutoIds: props.initial.tiposProdutoIds,
        modoComissionado: props.initial.modoComissionado,
        modoComissionadoDia: props.initial.modoComissionadoDia?.toString() ?? "",
        modoNet: props.initial.modoNet,
      })
    } else {
      setV(EMPTY)
    }
  }, [props.open, props.mode])

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }))
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  function toggleTipoProduto(id: string) {
    setV((s) => ({
      ...s,
      tiposProdutoIds: s.tiposProdutoIds.includes(id)
        ? s.tiposProdutoIds.filter((x) => x !== id)
        : [...s.tiposProdutoIds, id],
    }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    // Valida dia quando modo comissionado está ativo
    if (v.modoComissionado && v.modoComissionadoDia) {
      const dia = parseInt(v.modoComissionadoDia, 10)
      if (isNaN(dia) || dia < 1 || dia > 31) {
        setErrors({ modoComissionadoDia: "Dia deve ser entre 1 e 31." })
        return
      }
    }

    const diaParsed = v.modoComissionado && v.modoComissionadoDia
      ? parseInt(v.modoComissionadoDia, 10) || null
      : null

    const payload = {
      nome: v.nome,
      cnpj: onlyDigits(v.cnpj),
      tipo: v.tipo || undefined,
      tipos_produto_ids: v.tiposProdutoIds,
      modo_comissionado: v.modoComissionado,
      modo_comissionado_dia_pagamento: diaParsed,
      modo_net: v.modoNet,
    }

    startTransition(async () => {
      if (isCreate) {
        const r = await createFornecedor(payload)
        if (!r.ok) {
          if (r.fieldErrors) setErrors(r.fieldErrors)
          toast.error(r.error)
          return
        }
        toast.success("Fornecedor criado.")
        props.onOpenChange(false)
        router.refresh()
        return
      }
      const r = await updateFornecedor(props.id, payload)
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success("Fornecedor atualizado.")
      props.onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) setErrors({})
        props.onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-nexus-bright" />
            {readOnly ? "Detalhes do fornecedor" : isCreate ? "Novo fornecedor" : "Editar fornecedor"}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Informações cadastradas para este fornecedor."
              : "Cadastre o fornecedor com CNPJ único para usar nas vendas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Nome */}
          <Field label="Nome" icon={<Building2 className="h-3.5 w-3.5" />} error={errors.nome}>
            <Input
              value={v.nome}
              onChange={(e) => update("nome", e.target.value)}
              placeholder="ex: OTT Viagens"
              required
              disabled={readOnly}
            />
          </Field>

          {/* CNPJ */}
          <Field label="CNPJ" icon={<Hash className="h-3.5 w-3.5" />} error={errors.cnpj}>
            <Input
              value={formatCnpjPartial(v.cnpj)}
              onChange={(e) => update("cnpj", onlyDigits(e.target.value))}
              maxLength={18}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              className="font-mono"
              required
              disabled={readOnly}
            />
          </Field>

          {/* Tipo */}
          <Field label="Tipo" icon={<Layers className="h-3.5 w-3.5" />} error={errors.tipo}>
            <Select
              value={v.tipo || undefined}
              onValueChange={(val) => update("tipo", val as TipoFornecedor)}
              disabled={readOnly}
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

          {/* Tipos de produto atendidos */}
          {props.tiposProduto.length > 0 && (
            <div>
              <Label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
                <Package className="h-3.5 w-3.5" />
                Tipos de produto atendidos
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {props.tiposProduto.map((tp) => {
                  const checked = v.tiposProdutoIds.includes(tp.id)
                  return (
                    <label
                      key={tp.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05] has-[:checked]:border-nexus-bright/30 has-[:checked]:bg-nexus-bright/[0.06]"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => !readOnly && toggleTipoProduto(tp.id)}
                        disabled={readOnly}
                        className="shrink-0"
                      />
                      {tp.icone && (
                        <span className="relative block h-4 w-4 shrink-0">
                          <Image
                            src={`/icons/tipos-produto/${tp.icone}.png`}
                            alt={tp.nome}
                            fill
                            className="object-contain"
                            style={{
                              filter: checked
                                ? "brightness(0) saturate(100%) invert(55%) sepia(90%) saturate(400%) hue-rotate(175deg)"
                                : "brightness(0) invert(1)",
                              opacity: checked ? 1 : 0.45,
                            }}
                          />
                        </span>
                      )}
                      <span className="text-sm text-white/80">{tp.nome}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Modo de pagamento */}
          <div>
            <Label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
              <CreditCard className="h-3.5 w-3.5" />
              Modo de pagamento aceito
            </Label>
            <div className="space-y-2">
              {/* Comissionado */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5">
                  <Checkbox
                    checked={v.modoComissionado}
                    onCheckedChange={(c) => {
                      if (readOnly) return
                      update("modoComissionado", !!c)
                      if (!c) update("modoComissionadoDia", "")
                    }}
                    disabled={readOnly}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-white/80">Comissionado</span>
                    <p className="text-[11px] text-white/40">
                      Fornecedor paga o valor cheio e repassa o RAV extra na data combinada.
                    </p>
                  </div>
                </label>

                {v.modoComissionado && (
                  <div className="border-t border-white/[0.06] px-3 pb-3 pt-2.5">
                    <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/40">
                      Dia do repasse (todo mês)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={v.modoComissionadoDia}
                        onChange={(e) => update("modoComissionadoDia", e.target.value)}
                        placeholder="ex: 15"
                        className="w-24 font-mono"
                        disabled={readOnly}
                      />
                      <span className="text-xs text-white/40">de cada mês</span>
                    </div>
                    {errors.modoComissionadoDia && (
                      <p className="mt-1 text-[11px] text-destructive">
                        {errors.modoComissionadoDia}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* NET */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05] has-[:checked]:border-nexus-bright/30 has-[:checked]:bg-nexus-bright/[0.06]">
                <Checkbox
                  checked={v.modoNet}
                  onCheckedChange={(c) => !readOnly && update("modoNet", !!c)}
                  disabled={readOnly}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-white/80">Líquido (NET)</span>
                  <p className="text-[11px] text-white/40">
                    RAV extra descontado na hora do pagamento. Sem lançamento separado.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter>
            {readOnly ? (
              <DialogClose asChild>
                <Button type="button" variant="ghost">Fechar</Button>
              </DialogClose>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => props.onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
                >
                  {isPending ? "Salvando…" : isCreate ? "Criar fornecedor" : "Salvar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string
  icon?: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
        {icon}
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
