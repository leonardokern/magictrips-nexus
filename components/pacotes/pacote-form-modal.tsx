"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Package, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { LoaderButton } from "@/components/ui/loader-button"
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
import { DateInput } from "@/components/ui/date-input"
import { CurrencyInput, formatBRL, parseBRL } from "@/components/ui/currency-input"
import {
  CampoDinamicoInput,
  colSpanCampoDinamico,
  type CampoDinamico,
} from "@/components/shared/campo-dinamico-input"
import {
  TIPOS_PACOTE,
  TIPO_PACOTE_LABEL,
  type TipoPacote,
} from "@/lib/schemas/pacote"
import { createPacote, updatePacote } from "@/app/(dashboard)/pacotes/actions"
import { cn } from "@/lib/utils"

export type TipoProdutoOpcao = {
  id: string
  nome: string
  icone: string | null
  campos: { campo_id: string; obrigatorio: boolean; ordem: number }[]
}

export type FornecedorOpcao = {
  id: string
  nome: string
  tipos_produto_ids: string[]
}

type ItemFornecedorState = {
  fornecedor_id: string
  valor_custo: string // BRL display
  ordem: number
}

type ItemState = {
  tipo_produto_id: string
  descricao: string
  valores_extras: Record<string, string>
  fornecedores: ItemFornecedorState[]
  ordem: number
}

type FormState = {
  nome: string
  descricao: string
  tipo_pacote: TipoPacote
  data_inicio_viagem: string
  data_fim_viagem: string
  tipo_produto_id: string
  fornecedor_id: string
  valor_custo_total: string // BRL display
  valores_extras: Record<string, string>
  itens: ItemState[]
}

const EMPTY: FormState = {
  nome: "",
  descricao: "",
  tipo_pacote: "unica_operadora",
  data_inicio_viagem: "",
  data_fim_viagem: "",
  tipo_produto_id: "",
  fornecedor_id: "",
  valor_custo_total: "",
  valores_extras: {},
  itens: [],
}

type ModeProps =
  | { mode: "create" }
  | {
      mode: "edit"
      id: string
      initial: {
        nome: string
        descricao: string | null
        tipo_pacote: TipoPacote
        data_inicio_viagem: string
        data_fim_viagem: string
        tipo_produto_id: string | null
        fornecedor_id: string | null
        valor_custo_total: number | null
        valores_extras: Record<string, string>
        itens: {
          tipo_produto_id: string
          descricao: string | null
          valores_extras: Record<string, string>
          ordem: number
          fornecedores: { fornecedor_id: string; valor_custo: number; ordem: number }[]
        }[]
      }
    }

type Props = ModeProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  tiposProduto: TipoProdutoOpcao[]
  fornecedores: FornecedorOpcao[]
  camposExtra: CampoDinamico[]
  empresaId: string
  readOnly?: boolean
}

export function PacoteFormModal(props: Props) {
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
      const init = props.initial
      setV({
        nome: init.nome,
        descricao: init.descricao ?? "",
        tipo_pacote: init.tipo_pacote,
        data_inicio_viagem: init.data_inicio_viagem,
        data_fim_viagem: init.data_fim_viagem,
        tipo_produto_id: init.tipo_produto_id ?? "",
        fornecedor_id: init.fornecedor_id ?? "",
        valor_custo_total: init.valor_custo_total ? formatBRL(init.valor_custo_total) : "",
        valores_extras: init.valores_extras ?? {},
        itens: init.itens
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((it, idx) => ({
            tipo_produto_id: it.tipo_produto_id,
            descricao: it.descricao ?? "",
            valores_extras: it.valores_extras ?? {},
            ordem: idx,
            fornecedores: it.fornecedores
              .slice()
              .sort((a, b) => a.ordem - b.ordem)
              .map((f, fi) => ({
                fornecedor_id: f.fornecedor_id,
                valor_custo: formatBRL(f.valor_custo),
                ordem: fi,
              })),
          })),
      })
    } else {
      setV(EMPTY)
    }
  }, [props.open, props.mode])

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }))
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  // ── Itens (checklist única operadora / itens financeiros multi operadora) ──

  function addItem() {
    setV((s) => ({
      ...s,
      itens: [
        ...s.itens,
        { tipo_produto_id: "", descricao: "", valores_extras: {}, fornecedores: [], ordem: s.itens.length },
      ],
    }))
  }

  function removeItem(idx: number) {
    setV((s) => ({
      ...s,
      itens: s.itens.filter((_, i) => i !== idx).map((it, i) => ({ ...it, ordem: i })),
    }))
  }

  function updateItem<K extends keyof ItemState>(idx: number, k: K, val: ItemState[K]) {
    setV((s) => ({
      ...s,
      itens: s.itens.map((it, i) => (i === idx ? { ...it, [k]: val } : it)),
    }))
  }

  function setItemValorExtra(idx: number, campoId: string, valor: string) {
    setV((s) => ({
      ...s,
      itens: s.itens.map((it, i) =>
        i === idx ? { ...it, valores_extras: { ...it.valores_extras, [campoId]: valor } } : it,
      ),
    }))
  }

  function addItemFornecedor(idx: number) {
    setV((s) => ({
      ...s,
      itens: s.itens.map((it, i) =>
        i === idx
          ? {
              ...it,
              fornecedores: [
                ...it.fornecedores,
                { fornecedor_id: "", valor_custo: "", ordem: it.fornecedores.length },
              ],
            }
          : it,
      ),
    }))
  }

  function removeItemFornecedor(idx: number, fIdx: number) {
    setV((s) => ({
      ...s,
      itens: s.itens.map((it, i) =>
        i === idx
          ? {
              ...it,
              fornecedores: it.fornecedores
                .filter((_, fi) => fi !== fIdx)
                .map((f, fi) => ({ ...f, ordem: fi })),
            }
          : it,
      ),
    }))
  }

  function updateItemFornecedor(
    idx: number,
    fIdx: number,
    k: keyof ItemFornecedorState,
    val: string,
  ) {
    setV((s) => ({
      ...s,
      itens: s.itens.map((it, i) =>
        i === idx
          ? {
              ...it,
              fornecedores: it.fornecedores.map((f, fi) =>
                fi === fIdx ? { ...f, [k]: val } : f,
              ),
            }
          : it,
      ),
    }))
  }

  function camposDoTipo(tipoProdutoId: string): CampoDinamico[] {
    const tp = props.tiposProduto.find((t) => t.id === tipoProdutoId)
    return (tp?.campos ?? [])
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((c) => props.camposExtra.find((ce) => ce.id === c.campo_id))
      .filter((c): c is CampoDinamico => !!c)
  }

  function fornecedoresDoTipo(tipoProdutoId: string): FornecedorOpcao[] {
    return props.fornecedores.filter((f) => f.tipos_produto_ids.includes(tipoProdutoId))
  }

  // Única operadora: os produtos inclusos ficam restritos ao que o
  // fornecedor escolhido efetivamente atende.
  const fornecedorUnicoSelecionado = props.fornecedores.find((f) => f.id === v.fornecedor_id)
  const tiposDoFornecedorUnico = fornecedorUnicoSelecionado
    ? props.tiposProduto.filter((t) => fornecedorUnicoSelecionado.tipos_produto_ids.includes(t.id))
    : []

  // Validação visual: cada item de multi_operadora precisa de >= 1 fornecedor
  const itensSemFornecedor =
    v.tipo_pacote === "multi_operadora"
      ? v.itens.filter((it) => it.fornecedores.length === 0)
      : []

  // Botão de salvar só libera quando o formulário está completo — evita
  // criar/editar um pacote com item multi-operadora sem fornecedor, por ex.
  const formInvalido = Object.keys(validarLocal()).length > 0

  function validarLocal(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!v.nome.trim()) errs.nome = "Nome obrigatório."
    if (!v.data_inicio_viagem) errs.data_inicio_viagem = "Data de início obrigatória."
    if (!v.data_fim_viagem) errs.data_fim_viagem = "Data de fim obrigatória."
    if (
      v.data_inicio_viagem &&
      v.data_fim_viagem &&
      v.data_fim_viagem <= v.data_inicio_viagem
    ) {
      errs.data_fim_viagem = "Data de fim precisa ser depois da data de início."
    }
    if (v.tipo_pacote === "unica_operadora") {
      if (!v.fornecedor_id) errs.fornecedor_id = "Operadora obrigatória."
      if (!parseBRL(v.valor_custo_total)) errs.valor_custo_total = "Custo total obrigatório."
    }
    if (v.itens.length < 2) {
      errs.itens = "Adicione ao menos 2 produtos para formar um pacote."
    } else if (
      v.tipo_pacote === "multi_operadora" &&
      v.itens.some((it) => it.fornecedores.length === 0)
    ) {
      errs.itens = "Cada item precisa de ao menos um fornecedor com custo definido."
    }
    return errs
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const localErrors = validarLocal()
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors)
      toast.error("Verifique os campos obrigatórios.")
      return
    }

    const payload = {
      empresa_id: props.empresaId,
      nome: v.nome,
      descricao: v.descricao || undefined,
      tipo_pacote: v.tipo_pacote,
      data_inicio_viagem: v.data_inicio_viagem,
      data_fim_viagem: v.data_fim_viagem,
      // Não há mais seletor de "tipo de produto único" no header — a linha
      // colapsada da venda usa o tipo do primeiro produto incluso na lista.
      tipo_produto_id:
        v.tipo_pacote === "unica_operadora" ? v.itens[0]?.tipo_produto_id || undefined : undefined,
      fornecedor_id: v.tipo_pacote === "unica_operadora" ? v.fornecedor_id || undefined : undefined,
      valor_custo_total:
        v.tipo_pacote === "unica_operadora" ? parseBRL(v.valor_custo_total) || undefined : undefined,
      // Única operadora colapsa em 1 linha na venda — os campos dinâmicos
      // preenchidos em cada produto incluso são mesclados num só objeto
      // (chaves são ids de campo_extra, únicos globalmente, sem colisão).
      valores_extras:
        v.tipo_pacote === "unica_operadora"
          ? v.itens.reduce((acc, it) => ({ ...acc, ...it.valores_extras }), {} as Record<string, string>)
          : {},
      itens: v.itens.map((it) => ({
        ordem: it.ordem,
        tipo_produto_id: it.tipo_produto_id,
        descricao: it.descricao || undefined,
        valores_extras: it.valores_extras,
        fornecedores:
          v.tipo_pacote === "multi_operadora"
            ? it.fornecedores.map((f) => ({
                fornecedor_id: f.fornecedor_id,
                valor_custo: parseBRL(f.valor_custo),
                ordem: f.ordem,
              }))
            : [],
      })),
    }

    startTransition(async () => {
      if (isCreate) {
        const r = await createPacote(payload)
        if (!r.ok) {
          if (r.fieldErrors) setErrors(r.fieldErrors)
          toast.error(r.error)
          return
        }
        toast.success("Pacote criado.")
        props.onOpenChange(false)
        router.refresh()
        return
      }
      const r = await updatePacote(props.id, payload)
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success("Pacote atualizado.")
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
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-nexus-bright" />
            {readOnly ? "Detalhes do pacote" : isCreate ? "Novo pacote" : "Editar pacote"}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Informações cadastradas para este pacote."
              : "Um pacote é um template reutilizável de produto(s) para acelerar o registro de vendas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Header: nome, descrição, tipo, vigência */}
            <div className="grid grid-cols-12 gap-4">
              <Field label="Nome *" error={errors.nome} className="col-span-12 sm:col-span-6">
                <Input
                  value={v.nome}
                  onChange={(e) => update("nome", e.target.value)}
                  placeholder="ex: Pacote Cancún 7 noites"
                  disabled={readOnly}
                />
              </Field>

              <Field label="Tipo de pacote" error={errors.tipo_pacote} className="col-span-12 sm:col-span-6">
                <Select
                  value={v.tipo_pacote}
                  onValueChange={(val) => update("tipo_pacote", val as TipoPacote)}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_PACOTE.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_PACOTE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Descrição" error={errors.descricao} className="col-span-12">
                <Textarea
                  value={v.descricao}
                  onChange={(e) => update("descricao", e.target.value)}
                  placeholder="Detalhes visíveis para quem for usar este pacote na venda (opcional)"
                  disabled={readOnly}
                  rows={2}
                />
              </Field>

              <Field label="Início da viagem *" error={errors.data_inicio_viagem} className="col-span-6 sm:col-span-3">
                <DateInput
                  value={v.data_inicio_viagem}
                  onChange={(iso) => update("data_inicio_viagem", iso)}
                  disabled={readOnly}
                  openOnFocus={false}
                />
              </Field>

              <Field label="Fim da viagem *" error={errors.data_fim_viagem} className="col-span-6 sm:col-span-3">
                <DateInput
                  value={v.data_fim_viagem}
                  onChange={(iso) => update("data_fim_viagem", iso)}
                  disabled={readOnly}
                  openOnFocus={false}
                />
              </Field>
            </div>

            {v.tipo_pacote === "unica_operadora" ? (
              <div className="space-y-6">
                {/* 1. Escolha a operadora */}
                <Field label="Operadora (fornecedor) *" error={errors.fornecedor_id} className="max-w-md">
                  <Select
                    value={v.fornecedor_id || undefined}
                    onValueChange={(val) => {
                      update("fornecedor_id", val)
                      // Trocar de operadora invalida os produtos já escolhidos
                      // que ela não atende — evita inconsistência silenciosa.
                      const forn = props.fornecedores.find((f) => f.id === val)
                      if (forn) {
                        setV((s) => ({
                          ...s,
                          itens: s.itens.filter((it) => forn.tipos_produto_ids.includes(it.tipo_produto_id)),
                        }))
                      }
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a operadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* 2. Inclua os produtos que essa operadora atende */}
                {!v.fornecedor_id ? (
                  <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-4 text-center text-sm text-white/40">
                    Selecione a operadora acima para incluir os produtos dela no pacote.
                  </p>
                ) : (
                  <ItensChecklist
                    itens={v.itens}
                    tiposProduto={tiposDoFornecedorUnico}
                    readOnly={readOnly}
                    onAdd={addItem}
                    onRemove={removeItem}
                    onUpdate={updateItem}
                    camposDoTipo={camposDoTipo}
                    onValorExtraChange={setItemValorExtra}
                    fornecedores={props.fornecedores}
                  />
                )}
                {errors.itens && <p className="text-[11px] text-destructive">{errors.itens}</p>}

                {/* 3. Preço fechado do pacote inteiro com essa operadora */}
                <div className="flex justify-end">
                  <Field
                    label="Custo total (contratando tudo com essa operadora) *"
                    error={errors.valor_custo_total}
                    className="w-full max-w-xs text-right"
                  >
                    <CurrencyInput
                      value={v.valor_custo_total}
                      onChange={(val) => update("valor_custo_total", val)}
                      disabled={readOnly}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/55">
                    Itens do pacote
                  </h3>
                  {!readOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Adicionar item
                    </Button>
                  )}
                </div>

                {errors.itens && <p className="text-[11px] text-destructive">{errors.itens}</p>}

                {v.itens.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-6 text-center text-sm text-white/40">
                    Nenhum item adicionado ainda.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {v.itens.map((it, idx) => {
                      const camposItem = camposDoTipo(it.tipo_produto_id)
                      const fornecedoresItem = fornecedoresDoTipo(it.tipo_produto_id)
                      const semFornecedor = it.fornecedores.length === 0

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "relative rounded-xl border bg-white/[0.02] p-4",
                            semFornecedor ? "border-amber-500/30" : "border-white/[0.06]",
                          )}
                        >
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              aria-label="Remover item"
                              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/55 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <div className="grid grid-cols-12 gap-4 pr-8">
                            <Field label="Tipo de produto" className="col-span-12">
                              <Select
                                value={it.tipo_produto_id || undefined}
                                onValueChange={(val) => {
                                  updateItem(idx, "tipo_produto_id", val)
                                  updateItem(idx, "valores_extras", {})
                                  updateItem(idx, "fornecedores", [])
                                }}
                                disabled={readOnly}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {props.tiposProduto.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      <span className="flex items-center gap-2">
                                        <TipoProdutoIcon icone={t.icone} />
                                        {t.nome}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>

                          <div className="mt-4 border-t border-white/[0.06] pt-4">
                            <div className="mb-2 flex items-center justify-between">
                              <Label className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                Fornecedores deste item
                              </Label>
                              {!readOnly && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addItemFornecedor(idx)}
                                  disabled={!it.tipo_produto_id}
                                >
                                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                                  Adicionar fornecedor
                                </Button>
                              )}
                            </div>

                            {semFornecedor ? (
                              <p className="text-[11px] text-amber-300">
                                Adicione ao menos um fornecedor com custo para este item.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {it.fornecedores.map((f, fIdx) => (
                                  <div key={fIdx} className="flex items-center gap-2">
                                    <Select
                                      value={f.fornecedor_id || undefined}
                                      onValueChange={(val) =>
                                        updateItemFornecedor(idx, fIdx, "fornecedor_id", val)
                                      }
                                      disabled={readOnly}
                                    >
                                      <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Fornecedor" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {fornecedoresItem.map((fo) => (
                                          <SelectItem key={fo.id} value={fo.id}>
                                            {fo.nome}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <div className="w-40">
                                      <CurrencyInput
                                        value={f.valor_custo}
                                        onChange={(val) =>
                                          updateItemFornecedor(idx, fIdx, "valor_custo", val)
                                        }
                                        disabled={readOnly}
                                      />
                                    </div>
                                    {!readOnly && (
                                      <button
                                        type="button"
                                        onClick={() => removeItemFornecedor(idx, fIdx)}
                                        aria-label="Remover fornecedor"
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/55 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {camposItem.length > 0 && (
                            <div className="mt-4 border-t border-white/[0.06] pt-4">
                              <Label className="block text-[11px] font-medium uppercase tracking-wider text-white/55">
                                Atributos do Produto
                              </Label>
                              <p className="mb-2 mt-0.5 text-[11px] normal-case tracking-normal text-white/35">
                                Poderá ser alterado pelo agente ao cadastrar a venda
                              </p>
                              <div className="grid grid-cols-12 gap-4">
                                {camposItem.map((campo) => (
                                  <Field
                                    key={campo.id}
                                    label={campo.nome}
                                    className={colSpanCampoDinamico(campo.tipo_campo)}
                                  >
                                    <CampoDinamicoInput
                                      campo={campo}
                                      value={it.valores_extras[campo.id] ?? ""}
                                      onChange={(val) => setItemValorExtra(idx, campo.id, val)}
                                      fornecedores={props.fornecedores}
                                    />
                                  </Field>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!readOnly && itensSemFornecedor.length > 0 && v.itens.length > 0 && (
                  <p className="text-[11px] text-amber-300">
                    {itensSemFornecedor.length === 1
                      ? "Há 1 item sem fornecedor definido."
                      : `Há ${itensSemFornecedor.length} itens sem fornecedor definido.`}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-white/[0.06] bg-card/95 px-6 py-4 backdrop-blur">
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
                <LoaderButton
                  type="submit"
                  loading={isPending}
                  disabled={formInvalido}
                  className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
                >
                  {isCreate ? "Criar pacote" : "Salvar"}
                </LoaderButton>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ItensChecklist({
  itens,
  tiposProduto,
  readOnly,
  onAdd,
  onRemove,
  onUpdate,
  camposDoTipo,
  onValorExtraChange,
  fornecedores,
}: {
  itens: ItemState[]
  tiposProduto: TipoProdutoOpcao[]
  readOnly: boolean
  onAdd: () => void
  onRemove: (idx: number) => void
  onUpdate: <K extends keyof ItemState>(idx: number, k: K, val: ItemState[K]) => void
  camposDoTipo: (tipoProdutoId: string) => CampoDinamico[]
  onValorExtraChange: (idx: number, campoId: string, valor: string) => void
  fornecedores: FornecedorOpcao[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-white/55">
          Produtos inclusos
        </h3>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar produto
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-4 text-center text-sm text-white/40">
          Nenhum produto adicionado ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {itens.map((it, idx) => {
            const camposItem = camposDoTipo(it.tipo_produto_id)
            return (
              <div key={idx} className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    aria-label="Remover produto"
                    className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/55 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                <div className="grid grid-cols-12 gap-4 pr-8">
                  <Field label="Tipo de produto" className="col-span-12">
                    <Select
                      value={it.tipo_produto_id || undefined}
                      onValueChange={(val) => {
                        onUpdate(idx, "tipo_produto_id", val)
                        onUpdate(idx, "valores_extras", {})
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposProduto.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-2">
                              <TipoProdutoIcon icone={t.icone} />
                              {t.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {camposItem.length > 0 && (
                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <Label className="block text-[11px] font-medium uppercase tracking-wider text-white/55">
                      Atributos do Produto
                    </Label>
                    <p className="mb-2 mt-0.5 text-[11px] normal-case tracking-normal text-white/35">
                      Poderá ser alterado pelo agente ao cadastrar a venda
                    </p>
                    <div className="grid grid-cols-12 gap-4">
                      {camposItem.map((campo) => (
                        <Field
                          key={campo.id}
                          label={campo.nome}
                          className={colSpanCampoDinamico(campo.tipo_campo)}
                        >
                          <CampoDinamicoInput
                            campo={campo}
                            value={it.valores_extras[campo.id] ?? ""}
                            onChange={(val) => onValorExtraChange(idx, campo.id, val)}
                            fornecedores={fornecedores}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
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
      <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/55">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

function TipoProdutoIcon({ icone }: { icone: string | null }) {
  if (!icone) return null
  return (
    <span className="relative block h-4 w-4 shrink-0">
      <Image
        src={`/icons/tipos-produto/${icone}.png`}
        alt=""
        fill
        className="object-contain"
        style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }}
      />
    </span>
  )
}
