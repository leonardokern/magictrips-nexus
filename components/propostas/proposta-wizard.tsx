"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateInput } from "@/components/ui/date-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoaderButton } from "@/components/ui/loader-button"
import { CurrencyInput, parseBRL as parseBRLCurrency } from "@/components/ui/currency-input"
import { formatTelefonePartial, onlyDigits } from "@/lib/utils/formatters"
import { emailValido } from "@/lib/utils/validators"
import { criarProposta, editarProposta } from "@/app/(dashboard)/propostas/actions"
import type { DadosNovaProposta, CriarPropostaPayload } from "@/app/(dashboard)/propostas/actions"
import { CotacaoUploader } from "@/components/propostas/cotacao-uploader"
import type { CotacaoExtraida } from "@/app/(dashboard)/propostas/cotacoes-actions"

// ─── Tipos internos ───────────────────────────────────────────────────────────

type ProdutoLocal = {
  _key: string
  tipoProdutoId: string
  tipoProdutoNome: string
  fornecedorId: string
  fornecedorNome: string
  descricao: string
  destino: string
  dataInicioIso: string   // ISO YYYY-MM-DD ou ""
  dataFimIso: string
  pax: number
  valorVendaStr: string
  observacoes: string
}

export type PropostaWizardData = {
  step: 1 | 2
  empresaId: string
  // Step 1 — cliente
  clienteId: string
  clienteNome: string
  clienteEmail: string
  clienteTelefone: string  // armazenado com máscara, salvo só dígitos
  // Step 1 — proposta
  dataPropostaIso: string  // ISO YYYY-MM-DD
  validadeIso: string      // ISO YYYY-MM-DD ou ""
  origem: string
  destino: string
  observacoes: string
  // Step 2
  produtos: ProdutoLocal[]
}

type Props = {
  dados: DadosNovaProposta
  propostaId?: string
  initialData?: PropostaWizardData
  onSuccess: (identificador: string) => void
  onCancel: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _keyCounter = 0
function newKey() { return `prod-${++_keyCounter}` }

function emptyProduto(): ProdutoLocal {
  return {
    _key: newKey(),
    tipoProdutoId: "",
    tipoProdutoNome: "",
    fornecedorId: "",
    fornecedorNome: "",
    descricao: "",
    destino: "",
    dataInicioIso: "",
    dataFimIso: "",
    pax: 1,
    valorVendaStr: "",
    observacoes: "",
  }
}

const parseBRL = parseBRLCurrency

function todayIso(): string {
  return new Date().toISOString().split("T")[0] as string
}

/** DD/MM/AAAA → YYYY-MM-DD. Retorna "" se inválido. */
function ddmmyyyyToIso(s: string | null | undefined): string {
  if (!s) return ""
  const parts = s.split("/")
  if (parts.length !== 3) return ""
  const [d, m, y] = parts
  if (!d || !m || !y || y.length !== 4) return ""
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

/** Match case-insensitive entre nome extraído pelo Claude e tipos cadastrados. */
function matchTipoProduto(
  nome: string,
  tipos: { id: string; nome: string }[],
): { id: string; nome: string } | undefined {
  const lower = nome.toLowerCase()
  return (
    tipos.find((t) => t.nome.toLowerCase() === lower) ??
    tipos.find(
      (t) =>
        t.nome.toLowerCase().includes(lower) || lower.includes(t.nome.toLowerCase()),
    )
  )
}

function buildPayload(data: PropostaWizardData): CriarPropostaPayload {
  const isProspect = !data.clienteId || data.clienteId === ""
  return {
    empresaId: data.empresaId,
    clienteId: !isProspect ? data.clienteId : null,
    clienteNome: isProspect ? data.clienteNome || null : null,
    clienteEmail: isProspect ? data.clienteEmail || null : null,
    clienteTelefone: isProspect ? onlyDigits(data.clienteTelefone) || null : null,
    dataProposta: data.dataPropostaIso || todayIso(),
    validade: data.validadeIso || null,
    origem: data.origem || null,
    destino: data.destino || null,
    observacoes: data.observacoes || null,
    produtos: data.produtos.map((p, i) => ({
      ordem: i + 1,
      tipoProdutoId: p.tipoProdutoId || null,
      tipoProdutoNome: p.tipoProdutoNome,
      fornecedorId: p.fornecedorId || null,
      fornecedorNome: p.fornecedorNome || null,
      descricao: p.descricao || null,
      destino: p.destino || null,
      dataInicio: p.dataInicioIso || null,
      dataFim: p.dataFimIso || null,
      pax: p.pax,
      valorVenda: parseBRL(p.valorVendaStr),
      observacoes: p.observacoes || null,
    })),
  }
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export function PropostaWizard({ dados, propostaId, initialData, onSuccess, onCancel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const defaultEmpresaId = dados.empresas[0]?.id ?? ""

  const [data, setData] = useState<PropostaWizardData>(
    initialData ?? {
      step: 1,
      empresaId: defaultEmpresaId,
      clienteId: "",
      clienteNome: "",
      clienteEmail: "",
      clienteTelefone: "",
      dataPropostaIso: todayIso(),
      validadeIso: "",
      origem: "",
      destino: "",
      observacoes: "",
      produtos: [emptyProduto()],
    },
  )

  // Erros inline do step 1
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  const step = data.step
  const isEdit = !!propostaId

  function update(patch: Partial<PropostaWizardData>) {
    setData((prev) => ({ ...prev, ...patch }))
  }

  function clearError(field: string) {
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function setFieldError(field: string, msg: string) {
    setErrors((prev) => ({ ...prev, [field]: msg }))
  }

  // ── Produto helpers ───────────────────────────────────────────────────────

  function updateProduto(key: string, patch: Partial<ProdutoLocal>) {
    setData((prev) => ({
      ...prev,
      produtos: prev.produtos.map((p) => (p._key === key ? { ...p, ...patch } : p)),
    }))
  }

  function addProduto() {
    setData((prev) => ({ ...prev, produtos: [...prev.produtos, emptyProduto()] }))
  }

  function removeProduto(key: string) {
    setData((prev) => ({ ...prev, produtos: prev.produtos.filter((p) => p._key !== key) }))
  }

  // ── Navegação ─────────────────────────────────────────────────────────────

  function goNext() {
    const newErrors: Record<string, string> = {}
    const isProspect = !data.clienteId

    if (isProspect && !data.clienteNome.trim()) {
      newErrors.clienteNome = "Nome é obrigatório."
    }
    if (isProspect && data.clienteEmail && !emailValido(data.clienteEmail)) {
      newErrors.clienteEmail = "E-mail inválido."
    }
    if (!data.dataPropostaIso) {
      newErrors.dataProposta = "Data da proposta é obrigatória."
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    update({ step: 2 })
  }

  function goBack() {
    update({ step: 1 })
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    const produtosValidos = data.produtos.filter((p) => p.tipoProdutoNome.trim())
    if (produtosValidos.length === 0) {
      toast.error("Adicione ao menos um produto à proposta.")
      return
    }

    const payload = buildPayload(data)

    startTransition(async () => {
      const result = isEdit
        ? await editarProposta(propostaId!, payload)
        : await criarProposta(payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(isEdit ? "Proposta atualizada." : "Proposta criada com sucesso!")
      router.refresh()
      onSuccess(isEdit ? "" : (result.data as { identificador: string }).identificador)
    })
  }

  // ── Aplicar cotação extraída ──────────────────────────────────────────────

  function handleAplicarCotacao(cotacao: CotacaoExtraida) {
    const patch: Partial<PropostaWizardData> = {}

    if (cotacao.clienteNome) patch.clienteNome = cotacao.clienteNome
    if (cotacao.clienteEmail) patch.clienteEmail = cotacao.clienteEmail
    if (cotacao.clienteTelefone) {
      patch.clienteTelefone = formatTelefonePartial(cotacao.clienteTelefone)
    }
    if (cotacao.origem) patch.origem = cotacao.origem
    if (cotacao.destino) patch.destino = cotacao.destino
    if (cotacao.validadeStr) patch.validadeIso = ddmmyyyyToIso(cotacao.validadeStr)
    if (cotacao.observacoes) patch.observacoes = cotacao.observacoes

    if (cotacao.produtos.length > 0) {
      patch.produtos = cotacao.produtos.map((p) => {
        const tipo = matchTipoProduto(p.tipoProdutoNome, dados.tiposProduto)
        return {
          _key: newKey(),
          tipoProdutoId: tipo?.id ?? "",
          tipoProdutoNome: tipo?.nome ?? p.tipoProdutoNome,
          fornecedorId: "",
          fornecedorNome: "",
          descricao: p.descricao ?? "",
          destino: "",
          dataInicioIso: ddmmyyyyToIso(p.dataInicioStr),
          dataFimIso: ddmmyyyyToIso(p.dataFimStr),
          pax: p.pax || 1,
          valorVendaStr: p.valorVendaStr ?? "",
          observacoes: p.observacoes ?? "",
        }
      })
    }

    update(patch)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedCliente = dados.clientes.find((c) => c.id === data.clienteId)
  const isProspect = !data.clienteId || (!selectedCliente && data.clienteId === "")
  const totalValor = data.produtos.reduce((sum, p) => sum + parseBRL(p.valorVendaStr), 0)

  return (
    <div className="flex flex-col gap-0">
      {/* Step indicator */}
      <div className="flex items-center gap-0 border-b border-white/[0.06] px-6 py-4">
        <StepIndicator num={1} label="Cliente e proposta" active={step === 1} done={step > 1} />
        <div className="mx-3 h-px w-8 bg-white/[0.08]" />
        <StepIndicator num={2} label="Produtos" active={step === 2} done={false} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {step === 1 && (
          <Step1
            data={data}
            errors={errors}
            update={update}
            clearError={clearError}
            setFieldError={setFieldError}
            clientes={dados.clientes}
            empresas={dados.empresas}
            isProspect={isProspect}
            selectedCliente={selectedCliente}
            onAplicarCotacao={handleAplicarCotacao}
          />
        )}
        {step === 2 && (
          <Step2
            produtos={data.produtos}
            tiposProduto={dados.tiposProduto}
            updateProduto={updateProduto}
            addProduto={addProduto}
            removeProduto={removeProduto}
            totalValor={totalValor}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.06] bg-card/95 px-6 py-4 backdrop-blur">
        <Button variant="ghost" onClick={step === 1 ? onCancel : goBack} disabled={isPending}>
          {step === 1 ? "Cancelar" : (
            <><ChevronLeft className="mr-1 h-4 w-4" />Voltar</>
          )}
        </Button>
        <div className="flex items-center gap-3">
          {step === 1 && (
            <Button onClick={goNext}>
              Próximo<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <LoaderButton loading={isPending} onClick={handleSubmit}>
              <Check className="mr-1.5 h-4 w-4" />
              {isEdit ? "Salvar alterações" : "Criar proposta"}
            </LoaderButton>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ num, label, active, done }: {
  num: number; label: string; active: boolean; done: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
        done ? "bg-emerald-500/20 text-emerald-300" :
        active ? "bg-nexus-bright/20 text-nexus-bright" :
        "bg-white/[0.06] text-white/35",
      )}>
        {done ? <Check className="h-3 w-3" /> : num}
      </span>
      <span className={cn("text-sm", active ? "text-white" : done ? "text-white/55" : "text-white/30")}>
        {label}
      </span>
    </div>
  )
}

// ─── FieldError ───────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-rose-400">{msg}</p>
}

// ─── Step 1: Cliente + dados gerais ──────────────────────────────────────────

type ClienteOption = { id: string; nome: string; email: string; empresa_id: string }

function Step1({
  data, errors, update, clearError, setFieldError, clientes, empresas, isProspect, selectedCliente,
  onAplicarCotacao,
}: {
  data: PropostaWizardData
  errors: Partial<Record<string, string>>
  update: (patch: Partial<PropostaWizardData>) => void
  clearError: (field: string) => void
  setFieldError: (field: string, msg: string) => void
  clientes: ClienteOption[]
  empresas: { id: string; nome: string; slug: string }[]
  isProspect: boolean
  selectedCliente: ClienteOption | undefined
  onAplicarCotacao: (dados: CotacaoExtraida) => void
}) {
  const clientesFiltrados = data.empresaId
    ? clientes.filter((c) => c.empresa_id === data.empresaId)
    : clientes

  return (
    <div className="space-y-6">
      {/* Importar cotação via IA */}
      <CotacaoUploader onAplicar={onAplicarCotacao} />

      {/* Empresa */}
      {empresas.length > 1 && (
        <div className="space-y-1.5">
          <Label>Empresa</Label>
          <Select value={data.empresaId} onValueChange={(v) => update({ empresaId: v, clienteId: "" })}>
            <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Seção cliente */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-nexus-bright" />
          <h3 className="text-sm font-semibold text-white">Dados do cliente</h3>
        </div>

        <div className="space-y-1.5">
          <Label>Cliente cadastrado</Label>
          <Select
            value={data.clienteId || "prospect"}
            onValueChange={(v) => update({ clienteId: v === "prospect" ? "" : v })}
          >
            <SelectTrigger><SelectValue placeholder="Selecionar cliente existente..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prospect">Prospect / Sem cadastro</SelectItem>
              {clientesFiltrados.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}{c.email ? ` · ${c.email}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-white/40">
            Selecione um cliente existente ou preencha os dados abaixo para um prospect.
          </p>
        </div>

        {/* Prospect: campos inline */}
        {isProspect && (
          <div className="grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-2">
            {/* Nome */}
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome <span className="text-rose-400">*</span></Label>
              <Input
                value={data.clienteNome}
                onChange={(e) => { update({ clienteNome: e.target.value }); clearError("clienteNome") }}
                placeholder="Nome completo do cliente"
                className={errors.clienteNome ? "border-rose-500/60" : ""}
              />
              <FieldError msg={errors.clienteNome} />
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={data.clienteEmail}
                onChange={(e) => { update({ clienteEmail: e.target.value }); clearError("clienteEmail") }}
                onBlur={(e) => {
                  const val = e.target.value
                  if (val && !emailValido(val)) {
                    setFieldError("clienteEmail", "E-mail inválido.")
                  }
                }}
                placeholder="email@exemplo.com"
                className={errors.clienteEmail ? "border-rose-500/60" : ""}
              />
              <FieldError msg={errors.clienteEmail} />
            </div>

            {/* Telefone com máscara */}
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                type="tel"
                inputMode="numeric"
                value={data.clienteTelefone}
                onChange={(e) => update({ clienteTelefone: formatTelefonePartial(e.target.value) })}
                placeholder="(11) 99999-9999"
                maxLength={16}
              />
            </div>
          </div>
        )}

        {/* Cliente selecionado: preview */}
        {!isProspect && selectedCliente && (
          <div className="rounded-lg border border-nexus-bright/20 bg-nexus-bright/[0.04] px-4 py-3">
            <p className="text-sm font-medium text-white">{selectedCliente.nome}</p>
            {selectedCliente.email && (
              <p className="mt-0.5 text-xs text-white/50">{selectedCliente.email}</p>
            )}
          </div>
        )}
      </div>

      {/* Seção proposta */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Dados da proposta</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Data da proposta */}
          <div className="space-y-1">
            <Label>Data da proposta <span className="text-rose-400">*</span></Label>
            <DateInput
              value={data.dataPropostaIso}
              onChange={(iso) => { update({ dataPropostaIso: iso }); clearError("dataProposta") }}
            />
            <FieldError msg={errors.dataProposta} />
          </div>

          {/* Validade */}
          <div className="space-y-1.5">
            <Label>Validade da proposta</Label>
            <DateInput
              value={data.validadeIso}
              onChange={(iso) => update({ validadeIso: iso })}
              placeholder="DD/MM/AAAA"
            />
          </div>
        </div>

        {/* Origem + Destino */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Input
              value={data.origem}
              onChange={(e) => update({ origem: e.target.value })}
              placeholder="Ex: São Paulo, SP"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Input
              value={data.destino}
              onChange={(e) => update({ destino: e.target.value })}
              placeholder="Ex: Maldivas"
            />
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea
            value={data.observacoes}
            onChange={(e) => update({ observacoes: e.target.value })}
            placeholder="Notas que aparecerão no PDF..."
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Produtos ─────────────────────────────────────────────────────────

function Step2({
  produtos, tiposProduto, updateProduto, addProduto, removeProduto, totalValor,
}: {
  produtos: ProdutoLocal[]
  tiposProduto: { id: string; nome: string }[]
  updateProduto: (key: string, patch: Partial<ProdutoLocal>) => void
  addProduto: () => void
  removeProduto: (key: string) => void
  totalValor: number
}) {
  function formatBRL(value: number): string {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-nexus-bright" />
        <h3 className="text-sm font-semibold text-white">Produtos da proposta</h3>
        <span className="ml-auto text-xs text-white/40">
          {produtos.length} item{produtos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {produtos.map((produto, index) => (
        <ProdutoCard
          key={produto._key}
          produto={produto}
          index={index}
          tiposProduto={tiposProduto}
          onChange={(patch) => updateProduto(produto._key, patch)}
          onRemove={produtos.length > 1 ? () => removeProduto(produto._key) : undefined}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addProduto}
        className="w-full border-dashed border-white/20 text-white/55 hover:border-white/40 hover:text-white"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Adicionar produto
      </Button>

      {totalValor > 0 && (
        <div className="flex items-center justify-end rounded-lg border border-nexus-bright/20 bg-nexus-bright/[0.04] px-4 py-3">
          <span className="text-sm text-white/55">Total da proposta:</span>
          <span className="ml-3 text-lg font-semibold tabular-nums text-white">
            {formatBRL(totalValor)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Card de produto ──────────────────────────────────────────────────────────

function ProdutoCard({ produto, index, tiposProduto, onChange, onRemove }: {
  produto: ProdutoLocal
  index: number
  tiposProduto: { id: string; nome: string }[]
  onChange: (patch: Partial<ProdutoLocal>) => void
  onRemove?: () => void
}) {
  function handleTipoProduto(id: string) {
    const tipo = tiposProduto.find((t) => t.id === id)
    onChange({ tipoProdutoId: id, tipoProdutoNome: tipo?.nome ?? "" })
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Produto {index + 1}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/[0.06] text-rose-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/15"
            aria-label="Remover produto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Tipo */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Tipo de produto <span className="text-rose-400">*</span></Label>
          <Select value={produto.tipoProdutoId || ""} onValueChange={handleTipoProduto}>
            <SelectTrigger><SelectValue placeholder="Selecionar tipo..." /></SelectTrigger>
            <SelectContent>
              {tiposProduto.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* PAX */}
        <div className="space-y-1.5">
          <Label>PAX</Label>
          <Input
            type="number"
            min={1}
            value={produto.pax}
            onChange={(e) => onChange({ pax: parseInt(e.target.value) || 1 })}
          />
        </div>

        {/* Data início */}
        <div className="space-y-1.5">
          <Label>Data de início</Label>
          <DateInput
            value={produto.dataInicioIso}
            onChange={(iso) => onChange({ dataInicioIso: iso })}
          />
        </div>

        {/* Data fim */}
        <div className="space-y-1.5">
          <Label>Data de fim</Label>
          <DateInput
            value={produto.dataFimIso}
            onChange={(iso) => onChange({ dataFimIso: iso })}
          />
        </div>

        {/* Valor */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Valor (R$) <span className="text-rose-400">*</span></Label>
          <CurrencyInput
            value={produto.valorVendaStr}
            onChange={(v) => onChange({ valorVendaStr: v })}
          />
        </div>

        {/* Descrição */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Descrição / Detalhes</Label>
          <Textarea
            value={produto.descricao}
            onChange={(e) => onChange({ descricao: e.target.value })}
            placeholder="Detalhes do produto para aparecer na proposta..."
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}
