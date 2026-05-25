"use client"

import Image from "next/image"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Minus,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClienteCombobox, type ClienteOption } from "./cliente-combobox"
import { criarVenda, editarEAprovarVenda, resubmeterVenda } from "@/app/(dashboard)/vendas/actions"
import { salvarRascunho, descartarRascunho } from "@/app/(dashboard)/vendas/rascunho-actions"
import {
  COBRANCA_TIPO_LABEL,
  PGTO_FORMA_LABEL,
  type CobrancaTipo,
  type PgtoForma,
} from "@/lib/schemas/venda"
import { formatBRL, parseValorComSoma } from "@/lib/utils/sum-parser"
import { DateInput } from "@/components/ui/date-input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { formatCnpj, formatCpf, formatTelefone, onlyDigits } from "@/lib/utils/formatters"
import { cnpjValido, cpfValido, emailValido } from "@/lib/utils/validators"
import {
  lookupClientePorCpf,
  lookupClientePorCnpj,
} from "@/app/(dashboard)/clientes/actions"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos das props (dados pré-carregados do server)
// ─────────────────────────────────────────────────────────────────────────────

type Empresa = { id: string; nome: string; slug: string }
type Usuario = { id: string; nome: string; perfil_id: string; comissao_percentual: number | null }
type Fornecedor = { id: string; nome: string }
type Cartao = {
  id: string
  nome: string
  banco: string | null
  empresa_id: string
  dia_vencimento: number
}
type Origem = { id: string; nome: string; comissao_percentual: number | null }

type CampoExtra = {
  id: string
  nome: string
  tipo_campo: string
  placeholder: string | null
  opcoes: { valor: string }[]
}
type TipoProduto = {
  id: string
  nome: string
  icone: string | null
  campos: { campo_id: string; obrigatorio: boolean; ordem: number }[]
}

type Props = {
  empresas: Empresa[]
  defaultEmpresaId?: string
  clientes: ClienteOption[]
  fornecedores: Fornecedor[]
  cartoes: Cartao[]
  origens: Origem[]
  tiposProduto: TipoProduto[]
  camposExtra: CampoExtra[]
  usuariosAgentes: Usuario[]
  usuarioLogadoId: string
  /** Regras padrão de comissão por empresa + origem (tabela comissoes_regras). */
  comissoesRegras: { empresa_id: string; origem_id: string; percentual: number }[]
  /** Overrides de comissão por perfil de acesso + origem (tabela perfis_comissoes). */
  perfisComissoes: { perfil_id: string; origem_id: string; percentual: number }[]
  /** Se o usuário tem permissão de aprovar (Admin/Gerente). Mostra select de vendedor. */
  podeTrocarAgente: boolean
  /** Callback opcional disparado antes do redirect — usado pra fechar o modal. */
  onSuccessClose?: () => void
  /** Estado inicial ao retomar um rascunho salvo. */
  initialDraft?: WizardDraftData | null
  /** ID do rascunho que está sendo editado (para update em vez de insert). */
  initialRascunhoId?: string | null
  /** Passo atual controlado externamente pelo modal. */
  step: 1 | 2 | 3 | 4 | 5
  /** Callback para mudar o passo (controle externo). */
  onStepChange: (step: 1 | 2 | 3 | 4 | 5) => void
  /** Passo mais avançado atingido — para salvar no rascunho e restaurar corretamente. */
  maxStep: 1 | 2 | 3 | 4 | 5
  onMaxStepChange: (step: 1 | 2 | 3 | 4 | 5) => void
  /** Modo edição por Gerente/Admin: steps 1-4 têm "Salvar e Revisar", step 5 tem "Validar Venda". */
  modoGerente?: boolean
  /** ID da venda sendo editada (obrigatório em modoGerente). */
  vendaId?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado interno do wizard
// ─────────────────────────────────────────────────────────────────────────────
// Exportado para que o NovaVendaModal possa tipá-lo ao hidratar um rascunho.
export type WizardDraftData = {
  step: 1 | 2 | 3 | 4 | 5
  /** Passo mais avançado que o usuário chegou — usado para restaurar o rascunho. */
  maxStep: 1 | 2 | 3 | 4 | 5
  empresaId: string
  dataVenda: string
  dataInicioViagem: string
  dataFimViagem: string
  clienteValue: string | "novo" | null
  clienteNovo: ClienteNovoState
  pax: number
  origem: string
  indicacao: number
  agenteId: string
  observacoesGerais: string
  produtos: ProdutoState[]
  cobrancaItens: CobrancaItemState[]
  cobrancaObs: string
  passageiros: PassageiroState[]
}

type ProdutoState = {
  id: string // local uuid pra key
  tipo_produto_id: string
  /** input livre, parseado no submit */
  valor_venda_str: string
  valor_custo_str: string
  rav_str: string
  rav_extra_cliente_str: string
  rav_extra_fornecedor_str: string
  comissao_vendedor_str: string
  valores_extras: Record<string, string>
  pgto_forma: PgtoForma | ""
  pgto_cartao_id: string
  pgto_valor_total_str: string
  pgto_entrada_str: string
  pgto_num_parcelas: number
}

type CobrancaItemState = {
  tipo: CobrancaTipo
  outro_descricao: string
  valor_total_str: string
  num_parcelas: number
  plataforma_link: string
  taxa_adquirente_str: string
  valor_liquido_str: string
  data_inicio: string
  data_primeiro_recebimento: string
  observacoes: string
}

type PassageiroState = {
  id: string
  nome: string
  cpf: string
  data_nascimento: string
  usandoDadosCliente?: boolean
}

type ClienteNovoState = {
  tipo_pessoa: "fisica" | "juridica"
  // PF
  nome: string
  cpf: string
  data_nascimento: string
  // PJ
  razao_social: string
  nome_fantasia: string
  cnpj: string
  responsavel: string
  // Comuns
  email: string
  telefone: string
  // Sempre regular no fluxo da venda — faturado vem do CRUD direto
  tipo: "regular" | "faturado"
  dia_faturamento: string
}

export const STEPS = [
  { num: 1, label: "Identificação", icon: User },
  { num: 2, label: "Produtos", icon: ShoppingCart },
  { num: 3, label: "Cobrança", icon: CreditCard },
  { num: 4, label: "Passageiros", icon: Users },
  { num: 5, label: "Revisão", icon: Check },
] as const

function novoProduto(): ProdutoState {
  return {
    id: crypto.randomUUID(),
    tipo_produto_id: "",
    valor_venda_str: "",
    valor_custo_str: "",
    rav_str: "",
    rav_extra_cliente_str: "",
    rav_extra_fornecedor_str: "",
    comissao_vendedor_str: "",
    valores_extras: {},
    pgto_forma: "cartao",
    pgto_cartao_id: "",
    pgto_valor_total_str: "",
    pgto_entrada_str: "",
    pgto_num_parcelas: 1,
  }
}

function novoPassageiro(nome = ""): PassageiroState {
  return {
    id: crypto.randomUUID(),
    nome,
    cpf: "",
    data_nascimento: "",
  }
}

function novoItemCobranca(): CobrancaItemState {
  return {
    tipo: "pix",
    outro_descricao: "",
    valor_total_str: "",
    num_parcelas: 1,
    plataforma_link: "",
    taxa_adquirente_str: "",
    valor_liquido_str: "",
    data_inicio: "",
    data_primeiro_recebimento: "",
    observacoes: "",
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function VendaWizard(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSavingDraft, setIsSavingDraft] = useTransition()

  const step = props.step
  const setStep = props.onStepChange
  const d = props.initialDraft
  const [rascunhoId, setRascunhoId] = useState<string | null>(
    props.initialRascunhoId ?? null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmValorAberto, setConfirmValorAberto] = useState(false)
  const [asyncErrors, setAsyncErrors] = useState<Record<string, string>>({})

  function setAsyncError(key: string, msg: string | null) {
    setAsyncErrors((prev) => {
      if (msg === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: msg }
    })
  }

  // Identificação
  const [empresaId, setEmpresaId] = useState(
    () => d?.empresaId ?? props.defaultEmpresaId ?? "",
  )
  const [dataVenda, setDataVenda] = useState(
    () => d?.dataVenda ?? new Date().toISOString().slice(0, 10),
  )
  const [dataInicioViagem, setDataInicioViagem] = useState(
    () => d?.dataInicioViagem ?? "",
  )
  const [dataFimViagem, setDataFimViagem] = useState(
    () => d?.dataFimViagem ?? "",
  )
  const [clienteValue, setClienteValue] = useState<string | "novo" | null>(
    () => d?.clienteValue ?? null,
  )
  const [clienteNovo, setClienteNovo] = useState<ClienteNovoState>(
    () =>
      d?.clienteNovo ?? {
        tipo_pessoa: "fisica",
        nome: "",
        cpf: "",
        data_nascimento: "",
        razao_social: "",
        nome_fantasia: "",
        cnpj: "",
        responsavel: "",
        email: "",
        telefone: "",
        tipo: "regular",
        dia_faturamento: "20",
      },
  )
  const [pax, setPax] = useState(() => d?.pax ?? 1)
  const [origem, setOrigem] = useState(() => d?.origem ?? "")
  const [agenteId, setAgenteId] = useState(
    () => d?.agenteId ?? props.usuarioLogadoId,
  )

  // Comissão do agente — hierarquia:
  // 1. usuarios.comissao_percentual (override fixo, ex: Jéssica 12%)
  // 2. perfis_comissoes (override por perfil de acesso + origem)
  // 3. comissoes_regras (regra padrão por empresa + origem)
  const { comissaoDoAgente, comissaoSource } = useMemo(() => {
    const agente = props.usuariosAgentes.find((u) => u.id === agenteId)

    if (agente?.comissao_percentual != null) {
      return { comissaoDoAgente: agente.comissao_percentual, comissaoSource: "usuario" as const }
    }

    const origemObj = props.origens.find((o) => o.nome === origem)
    if (!origemObj) return { comissaoDoAgente: null, comissaoSource: null }

    if (agente?.perfil_id) {
      const perfilOverride = props.perfisComissoes.find(
        (p) => p.perfil_id === agente.perfil_id && p.origem_id === origemObj.id,
      )
      if (perfilOverride != null) {
        return { comissaoDoAgente: perfilOverride.percentual, comissaoSource: "perfil" as const }
      }
    }

    if (empresaId) {
      const regra = props.comissoesRegras.find(
        (r) => r.empresa_id === empresaId && r.origem_id === origemObj.id,
      )
      if (regra != null) {
        return { comissaoDoAgente: regra.percentual, comissaoSource: "regra" as const }
      }
    }

    return { comissaoDoAgente: null, comissaoSource: null }
  }, [agenteId, origem, empresaId, props.usuariosAgentes, props.origens, props.perfisComissoes, props.comissoesRegras])
  const [observacoesGerais, setObservacoesGerais] = useState(
    () => d?.observacoesGerais ?? "",
  )

  // Produtos
  const [produtos, setProdutos] = useState<ProdutoState[]>(
    () => d?.produtos ?? [novoProduto()],
  )

  // Cobrança
  const [cobrancaItens, setCobrancaItens] = useState<CobrancaItemState[]>(
    () => d?.cobrancaItens ?? [novoItemCobranca()],
  )
  const [cobrancaObs, setCobrancaObs] = useState(() => d?.cobrancaObs ?? "")

  // Passageiros
  const [passageiros, setPassageiros] = useState<PassageiroState[]>(
    () => d?.passageiros ?? [],
  )

  // Cliente combobox: filtra pela empresa selecionada
  const clientesDaEmpresa = useMemo(
    () => props.clientes.filter((c) => c.empresa_id === empresaId),
    [props.clientes, empresaId],
  )

  // Cartões da empresa
  const cartoesDaEmpresa = useMemo(
    () => props.cartoes.filter((c) => c.empresa_id === empresaId),
    [props.cartoes, empresaId],
  )

  // Ao entrar no passo 4: garante que a lista tem exatamente `pax` passageiros
  // (ou mais, se o usuário já adicionou extras). Primeiro passageiro recebe o
  // nome do cliente se ainda não tiver nome.
  function sincronizarPassageiros() {
    setPassageiros((prev) => {
      const result = [...prev]
      while (result.length < pax) result.push(novoPassageiro())
      return result
    })
  }

  // Total geral da venda (soma valor_venda dos produtos)
  const totalVenda = useMemo(() => {
    return produtos.reduce(
      (acc, p) => acc + (parseValorComSoma(p.valor_venda_str) || 0),
      0,
    )
  }, [produtos])

  // ── Validação por step ────────────────────────────────────────────────────

  function validarStep1(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!empresaId) e.empresa_id = "Selecione a empresa."
    if (!dataVenda) e.data_venda = "Informe a data da venda."
    if (!dataInicioViagem) e.data_inicio_viagem = "Informe a data de início da viagem."
    if (!clienteValue) e.cliente_id = "Selecione um cliente ou cadastre um novo."
    if (clienteValue === "novo") {
      if (clienteNovo.tipo_pessoa === "fisica") {
        if (clienteNovo.nome.trim().length < 2)
          e.novo_nome = "Informe o nome do cliente."
        if (!cpfValido(clienteNovo.cpf)) e.novo_cpf = "CPF inválido."
      } else {
        if (clienteNovo.razao_social.trim().length < 2)
          e.novo_razao_social = "Razão social obrigatória."
        if (!cnpjValido(clienteNovo.cnpj)) e.novo_cnpj = "CNPJ inválido."
      }
      if (!clienteNovo.email) e.novo_email = "E-mail obrigatório."
      else if (!emailValido(clienteNovo.email)) e.novo_email = "E-mail inválido."
      if (!clienteNovo.telefone) e.novo_telefone = "Telefone obrigatório."
    }
    if (pax < 1) e.pax = "PAX precisa ser ≥ 1."
    return e
  }

  function validarStep2(): Record<string, string> {
    const e: Record<string, string> = {}
    if (produtos.length === 0) e.produtos = "Adicione ao menos um produto."
    produtos.forEach((p, i) => {
      if (!p.tipo_produto_id) e[`produto_${i}_tipo`] = "Tipo obrigatório."
      const venda = parseValorComSoma(p.valor_venda_str)
      const custo = parseValorComSoma(p.valor_custo_str)
      if (!venda || venda <= 0)
        e[`produto_${i}_valor_venda`] = "Valor de venda obrigatório."
      if (!custo || custo <= 0)
        e[`produto_${i}_valor_custo`] = "Valor de custo obrigatório."
      if (!p.pgto_forma)
        e[`produto_${i}_pgto_forma`] = "Forma de pagamento obrigatória."

      // Campos extras obrigatórios
      const tp = props.tiposProduto.find((t) => t.id === p.tipo_produto_id)
      if (tp) {
        for (const v of tp.campos) {
          if (!v.obrigatorio) continue
          const valor = p.valores_extras[v.campo_id]
          if (!valor || (typeof valor === "string" && valor.trim() === "")) {
            const campo = props.camposExtra.find((c) => c.id === v.campo_id)
            e[`produto_${i}_extra_${v.campo_id}`] = `${campo?.nome ?? "Campo"} obrigatório.`
          }
        }
      }
    })
    return e
  }

  function validarStep3(): Record<string, string> {
    const e: Record<string, string> = {}
    if (cobrancaItens.length === 0)
      e.cobranca_itens = "Adicione ao menos uma forma de cobrança."
    cobrancaItens.forEach((it, i) => {
      const v = parseValorComSoma(it.valor_total_str)
      if (!v || v <= 0) e[`cobranca_${i}_valor`] = "Valor inválido."
      if (it.tipo === "outro" && !it.outro_descricao.trim())
        e[`cobranca_${i}_outro_descricao`] = "Informe a forma de pagamento."
    })
    return e
  }

  function validarStep4(): Record<string, string> {
    const e: Record<string, string> = {}
    const cpfsVistos = new Set<string>()
    passageiros.forEach((p, i) => {
      if (!p.nome.trim()) e[`passageiro_${i}_nome`] = "Nome obrigatório."
      if (!p.cpf.trim()) {
        e[`passageiro_${i}_cpf`] = "CPF obrigatório."
      } else if (!cpfValido(p.cpf)) {
        e[`passageiro_${i}_cpf`] = "CPF inválido."
      } else {
        const digits = onlyDigits(p.cpf)
        if (cpfsVistos.has(digits)) {
          e[`passageiro_${i}_cpf`] = "CPF já informado em outro passageiro."
        } else {
          cpfsVistos.add(digits)
        }
      }
    })
    return e
  }

  function avancar() {
    let errs: Record<string, string> = {}
    if (step === 1) errs = { ...validarStep1(), ...asyncErrors }
    if (step === 2) errs = validarStep2()
    if (step === 3) errs = validarStep3()
    if (step === 4) errs = validarStep4()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const first = Object.values(errs)[0]
      if (first) toast.error(first)
      return
    }
    setErrors({})
    // Passo 3 → 4: avisa se houver valor em aberto
    if (step === 3) {
      const totalCobrado = cobrancaItens.reduce(
        (acc, it) => acc + (parseValorComSoma(it.valor_total_str) || 0), 0,
      )
      if (Math.abs(totalCobrado - totalVenda) >= 0.01) {
        setConfirmValorAberto(true)
        return
      }
      sincronizarPassageiros()
    }
    if (step < 5) {
      const next = (step + 1) as 1 | 2 | 3 | 4 | 5
      setStep(next)
      props.onMaxStepChange(Math.max(props.maxStep, next) as 1 | 2 | 3 | 4 | 5)
    }
  }

  function confirmarAvancoComValorAberto() {
    setConfirmValorAberto(false)
    sincronizarPassageiros()
    setStep(4)
  }

  function voltar() {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5)
  }

  // ── Avançar direto para revisão (modo Gerente) ────────────────────────────

  function avancarParaRevisao() {
    let errs: Record<string, string> = {}
    if (step === 1) errs = { ...validarStep1(), ...asyncErrors }
    if (step === 2) errs = validarStep2()
    if (step === 3) errs = validarStep3()
    if (step === 4) errs = validarStep4()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const first = Object.values(errs)[0]
      if (first) toast.error(first)
      return
    }
    setErrors({})
    if (step === 3) {
      const totalCobrado = cobrancaItens.reduce(
        (acc, it) => acc + (parseValorComSoma(it.valor_total_str) || 0), 0,
      )
      if (Math.abs(totalCobrado - totalVenda) >= 0.01) {
        setConfirmValorAberto(true)
        return
      }
      sincronizarPassageiros()
    }
    setStep(5)
    props.onMaxStepChange(5)
  }

  // ── Submit modo Gerente: edita + aprova ───────────────────────────────────

  function onSubmitGerente() {
    const errs = { ...validarStep1(), ...asyncErrors, ...validarStep2(), ...validarStep3(), ...validarStep4() }
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const first = Object.values(errs)[0]
      if (first) toast.error(first)
      return
    }
    if (!props.vendaId) return
    const payload = construirPayload()
    startTransition(async () => {
      const r = await editarEAprovarVenda(props.vendaId!, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Venda editada e aprovada com sucesso.")
      props.onSuccessClose?.()
      router.refresh()
    })
  }

  // ── Agente resubmete venda em_revisao ─────────────────────────────────────

  function onSubmitAgente() {
    const errs = { ...validarStep1(), ...asyncErrors, ...validarStep2(), ...validarStep3(), ...validarStep4() }
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const first = Object.values(errs)[0]
      if (first) toast.error(first)
      return
    }
    if (!props.vendaId) return
    const payload = construirPayload()
    startTransition(async () => {
      const r = await resubmeterVenda(props.vendaId!, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Venda enviada para validação.")
      props.onSuccessClose?.()
      router.refresh()
    })
  }

  // ── Salvar rascunho ───────────────────────────────────────────────────────

  function coletarEstadoAtual(): WizardDraftData {
    return {
      step,
      maxStep: props.maxStep,
      empresaId,
      dataVenda,
      dataInicioViagem,
      dataFimViagem,
      clienteValue,
      clienteNovo,
      pax,
      origem,
      indicacao: comissaoDoAgente ?? 0,
      agenteId,
      observacoesGerais,
      produtos,
      cobrancaItens,
      cobrancaObs,
      passageiros,
    }
  }

  function gerarTituloRascunho(): string {
    const nomeCliente =
      clienteValue === "novo"
        ? clienteNovo.nome.trim() || "Novo cliente"
        : (props.clientes.find((c) => c.id === clienteValue)?.nome ?? "Sem cliente")
    const data = formatDateBR(dataVenda)
    return `${nomeCliente} · ${data}`
  }

  function handleSalvarRascunho() {
    setIsSavingDraft(async () => {
      const r = await salvarRascunho(
        rascunhoId,
        gerarTituloRascunho(),
        step,
        empresaId || null,
        coletarEstadoAtual() as unknown as Record<string, unknown>,
      )
      if (r.ok && r.data) {
        setRascunhoId(r.data.id)
        toast.success("Rascunho salvo.")
      } else if (!r.ok) {
        toast.error(r.error ?? "Erro ao salvar rascunho.")
      }
    })
  }

  // ── Submit final ──────────────────────────────────────────────────────────

  function onSubmit() {
    // valida todos
    const errs = { ...validarStep1(), ...asyncErrors, ...validarStep2(), ...validarStep3(), ...validarStep4() }
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const first = Object.values(errs)[0]
      if (first) toast.error(first)
      return
    }

    const payload = construirPayload()

    startTransition(async () => {
      const r = await criarVenda(payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      // Descarta o rascunho após aprovação bem-sucedida (silencioso)
      if (rascunhoId) {
        await descartarRascunho(rascunhoId).catch(() => null)
      }
      toast.success("Venda enviada para aprovação.")
      props.onSuccessClose?.()
      router.push(`/vendas/${r.data?.id}`)
    })
  }

  function construirPayload() {
    const produtosPayload = produtos.map((p, i) => {
      // Extrai fornecedor do campo dinâmico de tipo 'fornecedor', se existir
      const tp = props.tiposProduto.find((t) => t.id === p.tipo_produto_id)
      let fornecedor_id: string | null = null
      let fornecedor_nome = ""
      if (tp) {
        for (const vinculo of tp.campos) {
          const ce = props.camposExtra.find((c) => c.id === vinculo.campo_id)
          if (ce?.tipo_campo === "fornecedor") {
            const fid = p.valores_extras[ce.id]
            if (fid) {
              fornecedor_id = fid
              fornecedor_nome = props.fornecedores.find((f) => f.id === fid)?.nome ?? ""
              break
            }
          }
        }
      }
      return {
      ordem: i + 1,
      tipo_produto_id: p.tipo_produto_id,
      fornecedor_id,
      fornecedor_nome,
      localizador: null,
      localizador_fornecedor: null,
      destino: null,
      data_inicio_viagem: dataInicioViagem || null,
      data_fim_viagem: dataFimViagem || null,
      valores_extras: p.valores_extras,
      valor_venda: parseValorComSoma(p.valor_venda_str),
      valor_custo: parseValorComSoma(p.valor_custo_str),
      rav: p.rav_str ? parseValorComSoma(p.rav_str) : null,
      rav_extra_cliente: parseValorComSoma(p.rav_extra_cliente_str) || 0,
      rav_extra_fornecedor: parseValorComSoma(p.rav_extra_fornecedor_str) || 0,
      comissao_vendedor: p.comissao_vendedor_str
        ? parseValorComSoma(p.comissao_vendedor_str)
        : null,
      pgto_forma: p.pgto_forma || null,
      pgto_cartao_id: p.pgto_cartao_id || null,
      pgto_valor_total: (() => {
        const userVal = parseValorComSoma(p.pgto_valor_total_str)
        if (userVal > 0) return userVal
        const t =
          parseValorComSoma(p.valor_custo_str) +
          parseValorComSoma(p.rav_extra_fornecedor_str)
        return t > 0 ? t : null
      })(),
      pgto_entrada: p.pgto_forma === "pix" ? 0 : parseValorComSoma(p.pgto_entrada_str) || 0,
      pgto_num_parcelas: p.pgto_forma === "pix" ? 1 : p.pgto_num_parcelas,
      pgto_valor_parcela: p.pgto_forma === "pix" ? null : (() => {
        const userVal = parseValorComSoma(p.pgto_valor_total_str)
        const total = userVal > 0
          ? userVal
          : parseValorComSoma(p.valor_custo_str) + parseValorComSoma(p.rav_extra_fornecedor_str)
        const entrada = parseValorComSoma(p.pgto_entrada_str) || 0
        const n = p.pgto_num_parcelas || 1
        const v = (total - entrada) / n
        return v > 0 ? v : null
      })(),
      pgto_data_debito: null,
      }
    })

    const semParcelas = (tipo: CobrancaTipo) => tipo === "pix" || tipo === "outro"
    const itensCobranca = cobrancaItens.map((it) => ({
      tipo: it.tipo,
      valor_total: parseValorComSoma(it.valor_total_str),
      num_parcelas: semParcelas(it.tipo) ? 1 : it.num_parcelas,
      valor_parcela: semParcelas(it.tipo) ? null : (() => {
        const total = parseValorComSoma(it.valor_total_str) || 0
        const n = it.num_parcelas || 1
        return total > 0 ? total / n : null
      })(),
      plataforma_link: it.plataforma_link || null,
      taxa_adquirente: it.taxa_adquirente_str
        ? parseValorComSoma(it.taxa_adquirente_str)
        : null,
      valor_liquido: it.valor_liquido_str
        ? parseValorComSoma(it.valor_liquido_str)
        : null,
      data_inicio: it.data_inicio || null,
      data_primeiro_recebimento: it.data_primeiro_recebimento || null,
      observacoes: it.tipo === "outro" ? it.outro_descricao || null : null,
    }))

    const cobrancaTotal = itensCobranca.reduce(
      (acc, it) => acc + (it.valor_total || 0),
      0,
    )

    return {
      empresa_id: empresaId,
      data_venda: dataVenda,
      cliente_id: clienteValue !== "novo" ? clienteValue : null,
      cliente_novo:
        clienteValue === "novo"
          ? clienteNovo.tipo_pessoa === "fisica"
            ? {
                tipo_pessoa: "fisica" as const,
                nome: clienteNovo.nome.trim(),
                email: clienteNovo.email.trim().toLowerCase(),
                telefone: onlyDigits(clienteNovo.telefone),
                cpf: onlyDigits(clienteNovo.cpf),
                data_nascimento: clienteNovo.data_nascimento || null,
                tipo: clienteNovo.tipo,
                dia_faturamento:
                  clienteNovo.tipo === "faturado"
                    ? Number(clienteNovo.dia_faturamento)
                    : null,
              }
            : {
                tipo_pessoa: "juridica" as const,
                // O `nome` da tabela recebe fantasia (fallback razão social) —
                // padrão acordado com o CRUD direto pra unificar display.
                nome:
                  clienteNovo.nome_fantasia.trim() ||
                  clienteNovo.razao_social.trim(),
                razao_social: clienteNovo.razao_social.trim(),
                nome_fantasia: clienteNovo.nome_fantasia.trim() || null,
                cnpj: onlyDigits(clienteNovo.cnpj),
                responsavel: clienteNovo.responsavel.trim() || null,
                email: clienteNovo.email.trim().toLowerCase(),
                telefone: onlyDigits(clienteNovo.telefone),
                tipo: clienteNovo.tipo,
                dia_faturamento:
                  clienteNovo.tipo === "faturado"
                    ? Number(clienteNovo.dia_faturamento)
                    : null,
              }
          : null,
      pax,
      origem: origem || null,
      indicacao_percentual: comissaoDoAgente ?? 0,
      comissao_percentual: comissaoDoAgente ?? null,
      observacoes: observacoesGerais || null,
      usuario_id: agenteId,
      produtos: produtosPayload,
      passageiros: passageiros
        .filter((p) => p.nome.trim().length >= 1)
        .map((p, i) => ({
          ordem: i + 1,
          nome: p.nome,
          cpf: p.cpf ? onlyDigits(p.cpf) : null,
          data_nascimento: p.data_nascimento || null,
        })),
      cobranca: {
        valor_total: cobrancaTotal,
        observacoes: cobrancaObs || null,
        itens: itensCobranca,
      },
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Conteúdo do passo */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        {step === 1 && (
          <Step1
            empresas={props.empresas}
            empresaId={empresaId}
            setEmpresaId={(id) => {
              setEmpresaId(id)
              setClienteValue(null)
              setAsyncErrors({})
            }}
            dataVenda={dataVenda}
            setDataVenda={setDataVenda}
            dataInicioViagem={dataInicioViagem}
            setDataInicioViagem={setDataInicioViagem}
            dataFimViagem={dataFimViagem}
            setDataFimViagem={setDataFimViagem}
            clientes={clientesDaEmpresa}
            clienteValue={clienteValue}
            setClienteValue={(v) => {
              setClienteValue(v)
              if (v !== "novo") setAsyncErrors({})
            }}
            clienteNovo={clienteNovo}
            setClienteNovo={setClienteNovo}
            setAsyncError={setAsyncError}
            pax={pax}
            setPax={setPax}
            origens={props.origens}
            origem={origem}
            setOrigem={setOrigem}
            agentes={props.usuariosAgentes}
            agenteId={agenteId}
            setAgenteId={setAgenteId}
            comissao={comissaoDoAgente}
            comissaoSource={comissaoSource}
            podeTrocarAgente={props.podeTrocarAgente}
            observacoes={observacoesGerais}
            setObservacoes={setObservacoesGerais}
            errors={errors}
          />
        )}

        {step === 2 && (
          <Step2Produtos
            produtos={produtos}
            setProdutos={setProdutos}
            tiposProduto={props.tiposProduto}
            camposExtra={props.camposExtra}
            fornecedores={props.fornecedores}
            cartoes={cartoesDaEmpresa}
            errors={errors}
            mostraComissao={props.podeTrocarAgente}
            comissaoPercentual={comissaoDoAgente}
          />
        )}

        {step === 3 && (
          <Step3Cobranca
            itens={cobrancaItens}
            setItens={setCobrancaItens}
            obs={cobrancaObs}
            setObs={setCobrancaObs}
            totalVenda={totalVenda}
            errors={errors}
          />
        )}

        {step === 4 && (
          <Step4Passageiros
            passageiros={passageiros}
            setPassageiros={setPassageiros}
            pax={pax}
            clienteNome={
              clienteValue === "novo"
                ? clienteNovo.nome
                : (props.clientes.find((x) => x.id === clienteValue)?.nome ?? "")
            }
            clienteCpf={
              clienteValue === "novo"
                ? clienteNovo.tipo_pessoa === "fisica" ? clienteNovo.cpf : ""
                : (props.clientes.find((x) => x.id === clienteValue)?.cpf ?? "")
            }
            errors={errors}
          />
        )}

        {step === 5 && (
          <Step5Revisao
            empresaNome={
              props.empresas.find((e) => e.id === empresaId)?.nome ?? "—"
            }
            dataVenda={dataVenda}
            dataInicioViagem={dataInicioViagem}
            dataFimViagem={dataFimViagem}
            cliente={
              clienteValue === "novo"
                ? clienteNovo.nome
                : props.clientes.find((c) => c.id === clienteValue)?.nome ?? "—"
            }
            clienteNovoFlag={clienteValue === "novo"}
            pax={pax}
            agenteNome={
              props.usuariosAgentes.find((u) => u.id === agenteId)?.nome ?? "—"
            }
            origem={origem}
            produtos={produtos.map((p) => {
              const tp = props.tiposProduto.find((t) => t.id === p.tipo_produto_id)
              return {
                tipoNome: tp?.nome ?? "—",
                icone: tp?.icone ?? null,
                valorVenda: parseValorComSoma(p.valor_venda_str),
                valorCusto: parseValorComSoma(p.valor_custo_str),
                comissao: p.comissao_vendedor_str
                  ? parseValorComSoma(p.comissao_vendedor_str)
                  : 0,
                rav: p.rav_str ? parseValorComSoma(p.rav_str) : 0,
              }
            })}
            cobranca={cobrancaItens.map((it) => ({
              tipo: COBRANCA_TIPO_LABEL[it.tipo],
              valor: parseValorComSoma(it.valor_total_str),
              parcelas: it.num_parcelas,
            }))}
            passageiros={passageiros.map((p) => p.nome)}
            mostraComissao={props.podeTrocarAgente}
            comissaoPercentual={comissaoDoAgente}
          />
        )}
      </div>

      {/* Aviso de valor em aberto — só no passo 3 */}
      {step === 3 && (() => {
        const totalCobrado = cobrancaItens.reduce(
          (acc, it) => acc + (parseValorComSoma(it.valor_total_str) || 0), 0,
        )
        const diff = totalCobrado - totalVenda
        if (Math.abs(diff) < 0.01) return null
        const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(diff))
        const negativo = diff < 0
        return (
          <div className="flex items-start justify-end gap-1.5 text-xs text-amber-300/80">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <p className="text-right">
              {negativo
                ? <>Atenção! Diferença negativa de {valor}.<br />Está cobrando menos do que a venda.</>
                : <>Atenção! Diferença positiva de {valor}.<br />Está cobrando mais do que a venda.</>
              }
            </p>
          </div>
        )
      })()}

      {/* Navegação */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={voltar}
          disabled={step === 1 || isPending || isSavingDraft}
          className="text-white/70 hover:text-white"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-2">
          {/* Salvar rascunho — só em nova venda (agente, sem vendaId) */}
          {!props.modoGerente && !props.vendaId && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleSalvarRascunho}
              disabled={isPending || isSavingDraft}
              className="border border-white/10 text-white/55 hover:border-white/20 hover:text-white/80"
            >
              {isSavingDraft ? (
                <Spinner className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {rascunhoId ? "Atualizar rascunho" : "Salvar rascunho"}
            </Button>
          )}

          {step < 5 ? (
            props.modoGerente ? (
              // Gerente: todos os steps 1-4 têm "Salvar e Revisar" → vai direto ao step 5
              // Navegação entre 1-4 é feita clicando nas abas do cabeçalho
              <Button
                type="button"
                onClick={avancarParaRevisao}
                disabled={isPending}
                className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
              >
                Salvar e Revisar
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              // Agente (nova venda ou em_revisao): avança step a step normalmente
              <Button
                type="button"
                onClick={avancar}
                disabled={isPending || isSavingDraft}
                className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
              >
                Continuar
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )
          ) : props.modoGerente ? (
            // Step 5 · Gerente: aprovar diretamente
            <Button
              type="button"
              onClick={onSubmitGerente}
              disabled={isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isPending ? "Validando…" : "Validar Venda"}
              <CheckCircle2 className="ml-1 h-4 w-4" />
            </Button>
          ) : props.vendaId ? (
            // Step 5 · Agente editando em_revisao: resubmete
            <Button
              type="button"
              onClick={onSubmitAgente}
              disabled={isPending}
              className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
            >
              {isPending ? "Enviando…" : "Enviar para validação"}
              <Check className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            // Step 5 · Agente criando nova venda
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isPending || isSavingDraft}
              className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
            >
              {isPending ? "Enviando…" : "Enviar para aprovação"}
              <Check className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Aviso: valor em aberto ao avançar do passo 3 ──────────────── */}
      <Dialog open={confirmValorAberto} onOpenChange={setConfirmValorAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Valor em aberto
            </DialogTitle>
            <DialogDescription>
              O total cobrado não cobre o valor total da venda. Isso pode
              impactar as métricas financeiras e os relatórios de desempenho.
              Deseja continuar mesmo assim?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmValorAberto(false)}
            >
              Voltar e revisar
            </Button>
            <Button
              className="bg-amber-500 text-white hover:bg-amber-400"
              onClick={confirmarAvancoComValorAberto}
            >
              Continuar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Identificação
// ─────────────────────────────────────────────────────────────────────────────

function Step1(props: {
  empresas: Empresa[]
  empresaId: string
  setEmpresaId: (id: string) => void
  dataVenda: string
  setDataVenda: (v: string) => void
  dataInicioViagem: string
  setDataInicioViagem: (v: string) => void
  dataFimViagem: string
  setDataFimViagem: (v: string) => void
  clientes: ClienteOption[]
  clienteValue: string | "novo" | null
  setClienteValue: (v: string | "novo" | null) => void
  clienteNovo: ClienteNovoState
  setClienteNovo: React.Dispatch<React.SetStateAction<ClienteNovoState>>
  setAsyncError: (key: string, msg: string | null) => void
  pax: number
  setPax: (n: number) => void
  origens: Origem[]
  origem: string
  setOrigem: (v: string) => void
  agentes: Usuario[]
  agenteId: string
  setAgenteId: (id: string) => void
  comissao: number | null
  comissaoSource: "usuario" | "perfil" | "regra" | null
  podeTrocarAgente: boolean
  observacoes: string
  setObservacoes: (v: string) => void
  errors: Record<string, string>
}) {
  const e = props.errors
  const [checkingDoc, setCheckingDoc] = useState<"cpf" | "cnpj" | null>(null)
  const [docDuplicate, setDocDuplicate] = useState<{
    cpf?: { id: string; nome: string } | null
    cnpj?: { id: string; nome: string } | null
  }>({})

  async function onCpfBlur() {
    if (!cpfValido(props.clienteNovo.cpf) || !props.empresaId) return
    setCheckingDoc("cpf")
    try {
      const found = await lookupClientePorCpf(
        props.empresaId,
        onlyDigits(props.clienteNovo.cpf),
      )
      setDocDuplicate((prev) => ({ ...prev, cpf: found }))
      props.setAsyncError(
        "novo_cpf",
        found ? `CPF já cadastrado (${found.nome}). Selecione o cliente acima.` : null,
      )
    } finally {
      setCheckingDoc(null)
    }
  }

  async function onCnpjBlur() {
    if (!cnpjValido(props.clienteNovo.cnpj) || !props.empresaId) return
    setCheckingDoc("cnpj")
    try {
      const found = await lookupClientePorCnpj(
        props.empresaId,
        onlyDigits(props.clienteNovo.cnpj),
      )
      setDocDuplicate((prev) => ({ ...prev, cnpj: found }))
      props.setAsyncError(
        "novo_cnpj",
        found ? `CNPJ já cadastrado (${found.nome}). Selecione o cliente acima.` : null,
      )
    } finally {
      setCheckingDoc(null)
    }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Empresa" icon={<Building2 className="h-3.5 w-3.5" />} error={e.empresa_id}>
          <Select
            value={props.empresaId || undefined}
            onValueChange={props.setEmpresaId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {props.empresas.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Data da venda" icon={<CalendarDays className="h-3.5 w-3.5" />} error={e.data_venda}>
          <DateInput
            value={props.dataVenda}
            onChange={props.setDataVenda}
          />
        </Field>

        <Field label="PAX (passageiros)" error={e.pax}>
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => props.setPax(Math.max(1, props.pax - 1))}
              disabled={props.pax <= 1}
              aria-label="Diminuir"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/75 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={props.pax}
              onChange={(ev) => props.setPax(Math.max(1, Number(ev.target.value) || 1))}
              className="flex-1 text-center tabular-nums"
            />
            <button
              type="button"
              onClick={() => props.setPax(props.pax + 1)}
              aria-label="Aumentar"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data início viagem *" icon={<CalendarDays className="h-3.5 w-3.5" />} error={e.data_inicio_viagem}>
          <DateInput
            value={props.dataInicioViagem}
            onChange={props.setDataInicioViagem}
          />
        </Field>
        <Field label="Data fim viagem (opcional)">
          <DateInput
            value={props.dataFimViagem}
            onChange={props.setDataFimViagem}
          />
        </Field>
      </div>

      <Field
        label="Cliente"
        icon={<User className="h-3.5 w-3.5" />}
        error={e.cliente_id}
        hint={!props.empresaId ? "Selecione a empresa primeiro." : undefined}
      >
        <ClienteCombobox
          clientes={props.clientes}
          value={props.clienteValue}
          onChange={props.setClienteValue}
          disabled={!props.empresaId}
        />
      </Field>

      {props.clienteValue === "novo" && (
        <div className="rounded-lg border border-nexus-bright/30 bg-nexus-bright/[0.04] p-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-nexus-bright">
            Dados do novo cliente
          </p>

          {/* Radio PF/PJ */}
          <div className="mb-4">
            <div className="flex gap-2">
              {(["fisica", "juridica"] as const).map((opt) => {
                const ativo = props.clienteNovo.tipo_pessoa === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      props.setClienteNovo((s) => ({ ...s, tipo_pessoa: opt }))
                    }
                    className={
                      "flex-1 rounded-md border px-4 py-2 text-sm transition-colors " +
                      (ativo
                        ? "border-nexus-bright bg-nexus-bright/10 text-nexus-bright"
                        : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/25 hover:bg-white/[0.06]")
                    }
                  >
                    {opt === "fisica" ? "Pessoa física" : "Pessoa jurídica"}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {props.clienteNovo.tipo_pessoa === "fisica" ? (
              <>
                <Field label="Nome completo" error={e.novo_nome}>
                  <Input
                    value={props.clienteNovo.nome}
                    onChange={(ev) =>
                      props.setClienteNovo((s) => ({ ...s, nome: ev.target.value }))
                    }
                    required
                  />
                </Field>
                <Field label="CPF" error={e.novo_cpf}>
                  <div className="relative">
                    <Input
                      value={formatCpf(props.clienteNovo.cpf)}
                      onChange={(ev) => {
                        props.setClienteNovo((s) => ({ ...s, cpf: ev.target.value }))
                        setDocDuplicate((prev) => ({ ...prev, cpf: null }))
                        props.setAsyncError("novo_cpf", null)
                      }}
                      onBlur={onCpfBlur}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {checkingDoc === "cpf" && (
                      <Spinner
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-nexus-bright"
                      />
                    )}
                  </div>
                  {docDuplicate.cpf && (
                    <p className="mt-1 text-[11px] text-amber-300">
                      CPF já cadastrado:{" "}
                      <span className="font-medium">{docDuplicate.cpf.nome}</span>
                      . Selecione o cliente acima.
                    </p>
                  )}
                </Field>
              </>
            ) : (
              <>
                <Field label="Razão social" error={e.novo_razao_social}>
                  <Input
                    value={props.clienteNovo.razao_social}
                    onChange={(ev) =>
                      props.setClienteNovo((s) => ({
                        ...s,
                        razao_social: ev.target.value,
                      }))
                    }
                    required
                  />
                </Field>
                <Field label="Nome fantasia">
                  <Input
                    value={props.clienteNovo.nome_fantasia}
                    onChange={(ev) =>
                      props.setClienteNovo((s) => ({
                        ...s,
                        nome_fantasia: ev.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="CNPJ" error={e.novo_cnpj}>
                  <div className="relative">
                    <Input
                      value={formatCnpj(props.clienteNovo.cnpj)}
                      onChange={(ev) => {
                        props.setClienteNovo((s) => ({ ...s, cnpj: ev.target.value }))
                        setDocDuplicate((prev) => ({ ...prev, cnpj: null }))
                        props.setAsyncError("novo_cnpj", null)
                      }}
                      onBlur={onCnpjBlur}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    {checkingDoc === "cnpj" && (
                      <Spinner
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-nexus-bright"
                      />
                    )}
                  </div>
                  {docDuplicate.cnpj && (
                    <p className="mt-1 text-[11px] text-amber-300">
                      CNPJ já cadastrado:{" "}
                      <span className="font-medium">{docDuplicate.cnpj.nome}</span>
                      . Selecione o cliente acima.
                    </p>
                  )}
                </Field>
                <Field label="Nome do responsável">
                  <Input
                    value={props.clienteNovo.responsavel}
                    onChange={(ev) =>
                      props.setClienteNovo((s) => ({
                        ...s,
                        responsavel: ev.target.value,
                      }))
                    }
                  />
                </Field>
              </>
            )}
            <Field label="E-mail" error={e.novo_email}>
              <Input
                type="email"
                value={props.clienteNovo.email}
                onChange={(ev) =>
                  props.setClienteNovo((s) => ({ ...s, email: ev.target.value.replace(/\s/g, "") }))
                }
              />
            </Field>
            <Field label="Telefone" error={e.novo_telefone}>
              <Input
                value={formatTelefone(props.clienteNovo.telefone)}
                onChange={(ev) =>
                  props.setClienteNovo((s) => ({
                    ...s,
                    telefone: ev.target.value,
                  }))
                }
                placeholder="(11) 91234-5678"
                maxLength={15}
              />
            </Field>
            {/* Tipo/Faturamento ficam fora do cadastro ad-hoc: clientes faturados
                têm contrato e ciclo, devem ser pré-cadastrados pelo admin via
                /clientes. Aqui o novo cliente sempre nasce como `regular`. */}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Origem do lead">
          <Select
            value={props.origem || undefined}
            onValueChange={props.setOrigem}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {props.origens.map((o) => (
                <SelectItem key={o.id} value={o.nome}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Comissão do agente">
          <div className="flex h-10 items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-3 text-sm tabular-nums">
            {props.comissao != null
              ? <span className="font-medium text-nexus-bright">{props.comissao}%</span>
              : <span className="text-white/25">—</span>}
          </div>
        </Field>

        <Field
          label="Agente responsável"
          icon={<UserCog className="h-3.5 w-3.5" />}
          hint={
            !props.podeTrocarAgente
              ? "Você é o agente desta venda."
              : undefined
          }
        >
          <Select
            value={props.agenteId}
            onValueChange={props.setAgenteId}
            disabled={!props.podeTrocarAgente}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.agentes.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Observações gerais (opcional)">
        <Textarea
          value={props.observacoes}
          onChange={(ev) => props.setObservacoes(ev.target.value)}
          rows={2}
          placeholder="Notas internas sobre a venda…"
        />
      </Field>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Produtos
// ─────────────────────────────────────────────────────────────────────────────

function Step2Produtos(props: {
  produtos: ProdutoState[]
  setProdutos: React.Dispatch<React.SetStateAction<ProdutoState[]>>
  tiposProduto: TipoProduto[]
  camposExtra: CampoExtra[]
  fornecedores: Fornecedor[]
  cartoes: Cartao[]
  errors: Record<string, string>
  /** Quando true (Admin/Gerente), exibe campos de "Tipo de comissão" e "Comissão do vendedor".
   *  Agentes não veem — comissão é calculada por regra administrativa no aprovo. */
  mostraComissao: boolean
  /** Percentual de comissão do agente — quando definido, auto-preenche "Comissão vendedor" ao calcular o RAV. */
  comissaoPercentual: number | null
}) {
  const [openId, setOpenId] = useState<string | null>(
    () => props.produtos[0]?.id ?? null,
  )

  function adicionarProduto() {
    const novo = novoProduto()
    props.setProdutos((s) => [...s, novo])
    setOpenId(novo.id)
  }
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function removerProduto(id: string) {
    props.setProdutos((s) => s.filter((p) => p.id !== id))
    setConfirmDeleteId(null)
  }

  function patch(id: string, patchFn: (p: ProdutoState) => Partial<ProdutoState>) {
    props.setProdutos((s) =>
      s.map((p) => (p.id === id ? { ...p, ...patchFn(p) } : p)),
    )
  }

  /** Allow apenas dígitos, vírgula, ponto, '+' e espaço (formato BRL com soma). */
  function filtrarValor(raw: string): string {
    return raw.replace(/[^0-9.,+ ]/g, "")
  }

  /** Quando venda ou custo mudam, recalcula RAV = venda - custo automaticamente.
   *  Se o agente tem percentual de comissão definido, auto-preenche "Comissão vendedor" = RAV × %. */
  function patchValor(
    id: string,
    key: "valor_venda_str" | "valor_custo_str",
    raw: string,
  ) {
    const value = filtrarValor(raw)
    patch(id, (prev) => {
      const novo = { ...prev, [key]: value }
      const venda = parseValorComSoma(novo.valor_venda_str)
      const custo = parseValorComSoma(novo.valor_custo_str)
      const diff = venda - custo
      const ravStr = Number.isFinite(diff) && diff !== 0
        ? diff.toFixed(2).replace(".", ",")
        : ""
      // Auto-sugestão: Valor Total = custo + RAV extra fornecedor
      const ravExtra = parseValorComSoma(prev.rav_extra_fornecedor_str)
      const pgtoTotal = custo + ravExtra
      const pgtoTotalStr = pgtoTotal > 0
        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pgtoTotal)
        : ""
      // Auto-calcular comissão: RAV × percentual do agente
      let comissaoStr = prev.comissao_vendedor_str
      if (props.comissaoPercentual != null) {
        const rav = Number.isFinite(diff) ? diff : 0
        if (rav > 0) {
          const comissao = (rav * props.comissaoPercentual) / 100
          comissaoStr = comissao.toFixed(2).replace(".", ",")
        } else {
          comissaoStr = ""
        }
      }
      return { [key]: value, rav_str: ravStr, pgto_valor_total_str: pgtoTotalStr, comissao_vendedor_str: comissaoStr }
    })
  }

  return (
    <div className="space-y-3">
      {props.produtos.map((p, i) => {
        const tp = props.tiposProduto.find((t) => t.id === p.tipo_produto_id)
        const camposDoTipo = tp
          ? tp.campos
              .slice()
              .sort((a, b) => a.ordem - b.ordem)
              .map((v) => ({
                vinculo: v,
                campo: props.camposExtra.find((c) => c.id === v.campo_id),
              }))
              .filter((x) => x.campo)
          : []
        const isOpen = openId === p.id
        const venda = parseValorComSoma(p.valor_venda_str)
        const cartaoNome = props.cartoes.find((c) => c.id === p.pgto_cartao_id)?.nome
        const hasProductErrors = Object.keys(props.errors).some((k) =>
          k.startsWith(`produto_${i}_`),
        )

        // Texto do sumário quando fechado
        const summaryParts: string[] = []
        if (tp) summaryParts.push(tp.nome)
        if (venda > 0) summaryParts.push(formatBRL(venda))
        if (p.pgto_forma) {
          const formaLabel =
            p.pgto_forma === "cartao" && cartaoNome
              ? `Cartão (${cartaoNome})`
              : PGTO_FORMA_LABEL[p.pgto_forma as PgtoForma]
          summaryParts.push(formaLabel)
        }
        if (p.pgto_forma !== "pix" && p.pgto_num_parcelas > 0) {
          const userTotal = parseValorComSoma(p.pgto_valor_total_str)
          const pgtoTotal =
            userTotal > 0
              ? userTotal
              : parseValorComSoma(p.valor_custo_str) +
                parseValorComSoma(p.rav_extra_fornecedor_str)
          const entrada = parseValorComSoma(p.pgto_entrada_str) || 0
          const n = p.pgto_num_parcelas || 1
          const parcela = (pgtoTotal - entrada) / n
          summaryParts.push(
            parcela > 0
              ? `${n}x de ${formatBRL(parcela)}`
              : `${n}x`,
          )
        }
        return (
          <div
            key={p.id}
            className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
          >
            {/* ── Acordeão — cabeçalho ─────────────────────────────── */}
            <div
              className={`flex items-center gap-1 px-4 py-3${isOpen ? " border-b border-white/[0.06]" : ""}`}
            >
              {/* Botão de toggle — ocupa o espaço livre */}
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-150${isOpen ? " rotate-180" : ""}`}
                />

                {isOpen ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-white/70">
                    {tp?.icone && (
                      <span className="relative block h-3.5 w-3.5 shrink-0">
                        <Image
                          src={`/icons/tipos-produto/${tp.icone}.png`}
                          alt={tp.nome}
                          fill
                          className="object-contain"
                          style={{ filter: "brightness(0) invert(1)", opacity: 0.5 }}
                        />
                      </span>
                    )}
                    {tp?.nome ?? `Produto ${i + 1}`}
                  </span>
                ) : (
                  <>
                    <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                      <span className="flex shrink-0 items-center gap-1.5">
                        {tp?.icone && (
                          <div className="relative h-4 w-4 shrink-0">
                            <Image
                              src={`/icons/tipos-produto/${tp.icone}.png`}
                              alt={tp.nome}
                              fill
                              className="object-contain"
                              style={{ filter: "brightness(0) invert(1)", opacity: 0.65 }}
                            />
                          </div>
                        )}
                        <span className="text-[15px] font-semibold text-white">
                          {summaryParts[0] ?? `Produto ${i + 1}`}
                        </span>
                      </span>
                      {summaryParts.length > 1 && (
                        <span className="min-w-0 truncate text-sm text-white/60">
                          — {summaryParts.slice(1).join(" · ")}
                        </span>
                      )}
                    </span>
                    {hasProductErrors && (
                      <AlertCircle className="ml-1 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    )}
                  </>
                )}
              </button>

              {/* Remover produto — com confirmação inline */}
              {props.produtos.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {confirmDeleteId === p.id ? (
                    <>
                      <span className="text-[11px] text-white/50">Remover?</span>
                      <button
                        type="button"
                        onClick={() => removerProduto(p.id)}
                        className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-white/55 hover:bg-white/[0.08]"
                      >
                        Não
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="rounded p-1.5 text-rose-400/50 hover:text-rose-300"
                      aria-label="Remover produto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Acordeão — conteúdo (animado) ───────────────────── */}
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-in-out${isOpen ? " grid-rows-[1fr]" : " grid-rows-[0fr]"}`}
            >
            <div className="overflow-hidden">
            <div className="p-5">

            {/* ── Tipo + campos dinâmicos ─────────────────────────────── */}
            <div className="grid grid-cols-12 gap-3">
              <Field
                label="Tipo de produto"
                error={props.errors[`produto_${i}_tipo`]}
                className="col-span-12 sm:col-span-4"
              >
                <Select
                  value={p.tipo_produto_id || undefined}
                  onValueChange={(v) =>
                    patch(p.id, () => ({
                      tipo_produto_id: v,
                      valores_extras: {},
                    }))
                  }
                >
                  <SelectTrigger>
                    {tp ? (
                      <span className="!flex min-w-0 flex-1 items-center gap-1.5 !overflow-visible">
                        {tp.icone && (
                          <span className="relative block h-4 w-4 shrink-0">
                            <Image
                              src={`/icons/tipos-produto/${tp.icone}.png`}
                              alt={tp.nome}
                              fill
                              className="object-contain"
                              style={{ filter: "brightness(0) invert(1)", opacity: 0.65 }}
                            />
                          </span>
                        )}
                        <span className="truncate">{tp.nome}</span>
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecione" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {props.tiposProduto.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          {t.icone && (
                            <span className="relative block h-4 w-4 shrink-0">
                              <Image
                                src={`/icons/tipos-produto/${t.icone}.png`}
                                alt={t.nome}
                                fill
                                className="object-contain"
                                style={{ filter: "brightness(0) invert(1)", opacity: 0.6 }}
                              />
                            </span>
                          )}
                          {t.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Campos dinâmicos — largura adaptada ao tipo */}
              {camposDoTipo.map(({ vinculo, campo }) => {
                if (!campo) return null
                const val = p.valores_extras[campo.id] ?? ""
                const err = props.errors[`produto_${i}_extra_${campo.id}`]

                // Largura semântica por tipo de campo
                const colSpan =
                  campo.tipo_campo === "numero" || campo.tipo_campo === "sim_nao"
                    ? "col-span-6 sm:col-span-2"
                    : campo.tipo_campo === "data"
                      ? "col-span-6 sm:col-span-3"
                      : "col-span-12 sm:col-span-4"

                return (
                  <Field
                    key={campo.id}
                    label={`${campo.nome}${vinculo.obrigatorio ? " *" : ""}`}
                    error={err}
                    className={colSpan}
                  >
                    {campo.tipo_campo === "fornecedor" ? (
                      <Select
                        value={val || undefined}
                        onValueChange={(v) =>
                          patch(p.id, (prev) => ({
                            valores_extras: { ...prev.valores_extras, [campo.id]: v },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={campo.placeholder ?? "Selecione o fornecedor"} />
                        </SelectTrigger>
                        <SelectContent>
                          {props.fornecedores.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : campo.tipo_campo === "dropdown" ? (
                      <Select
                        value={val || undefined}
                        onValueChange={(v) =>
                          patch(p.id, (prev) => ({
                            valores_extras: { ...prev.valores_extras, [campo.id]: v },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={campo.placeholder ?? "Selecione"} />
                        </SelectTrigger>
                        <SelectContent>
                          {campo.opcoes.map((o) => (
                            <SelectItem key={o.valor} value={o.valor}>{o.valor}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : campo.tipo_campo === "data" ? (
                      <DateInput
                        value={val}
                        onChange={(iso) =>
                          patch(p.id, (prev) => ({
                            valores_extras: { ...prev.valores_extras, [campo.id]: iso },
                          }))
                        }
                      />
                    ) : campo.tipo_campo === "numero" ? (
                      <Input
                        type="number"
                        value={val}
                        onChange={(ev) =>
                          patch(p.id, (prev) => ({
                            valores_extras: { ...prev.valores_extras, [campo.id]: ev.target.value },
                          }))
                        }
                        placeholder={campo.placeholder ?? ""}
                      />
                    ) : campo.tipo_campo === "sim_nao" ? (
                      <Select
                        value={val || undefined}
                        onValueChange={(v) =>
                          patch(p.id, (prev) => ({
                            valores_extras: { ...prev.valores_extras, [campo.id]: v },
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={val}
                        onChange={(ev) =>
                          patch(p.id, (prev) => ({
                            valores_extras: { ...prev.valores_extras, [campo.id]: ev.target.value },
                          }))
                        }
                        placeholder={campo.placeholder ?? ""}
                      />
                    )}
                  </Field>
                )
              })}

            </div>

            {/* ── Valores financeiros ──────────────────────────────────── */}
            <div className="mt-5">
              <p className="mb-2.5 text-[11px] uppercase tracking-wider text-white/40">
                Valores
              </p>
              {/* Linha 1: Venda | Custo | RAV (auto) */}
              <div className="grid grid-cols-12 gap-3">
                <Field
                  label="Valor de venda"
                  error={props.errors[`produto_${i}_valor_venda`]}
                  className="col-span-12 sm:col-span-5"
                >
                  <CurrencyInput
                    value={p.valor_venda_str}
                    onChange={(v) => patchValor(p.id, "valor_venda_str", v)}
                  />
                </Field>

                <Field
                  label="Valor de custo"
                  error={props.errors[`produto_${i}_valor_custo`]}
                  className="col-span-12 sm:col-span-5"
                >
                  <CurrencyInput
                    value={p.valor_custo_str}
                    onChange={(v) => patchValor(p.id, "valor_custo_str", v)}
                  />
                </Field>

                {/* RAV — display compacto, não é input editável */}
                <div className="col-span-12 sm:col-span-2">
                  <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/55">
                    RAV
                  </Label>
                  <div className="flex h-10 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] px-2 text-center text-sm tabular-nums text-white/75">
                    {p.rav_str
                      ? formatBRL(parseValorComSoma(p.rav_str))
                      : <span className="text-white/25">—</span>}
                  </div>
                  <p className="mt-1 text-[10px] text-white/35">venda − custo</p>
                </div>

                {/* Linha 2: RAV extra cliente | RAV extra fornecedor | Comissão (Admin) */}
                <Field
                  label="RAV extra (cliente)"
                  className="col-span-12 sm:col-span-5"
                >
                  <CurrencyInput
                    value={p.rav_extra_cliente_str}
                    onChange={(v) => patch(p.id, () => ({ rav_extra_cliente_str: v }))}
                  />
                </Field>

                <Field
                  label="RAV extra (fornecedor)"
                  className="col-span-12 sm:col-span-5"
                >
                  <CurrencyInput
                    value={p.rav_extra_fornecedor_str}
                    onChange={(v) =>
                      patch(p.id, (prev) => {
                        const custo = parseValorComSoma(prev.valor_custo_str)
                        const ravExtra = parseValorComSoma(v)
                        const pgtoTotal = custo + ravExtra
                        const pgtoTotalStr = pgtoTotal > 0
                          ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pgtoTotal)
                          : ""
                        return { rav_extra_fornecedor_str: v, pgto_valor_total_str: pgtoTotalStr }
                      })
                    }
                  />
                </Field>

                {props.mostraComissao && (
                  <Field
                    label="Comissão vendedor"
                    hint="Valor pago ao agente"
                    className="col-span-12 sm:col-span-5"
                  >
                    <CurrencyInput
                      value={p.comissao_vendedor_str}
                      onChange={(v) =>
                        patch(p.id, () => ({ comissao_vendedor_str: v }))
                      }
                    />
                  </Field>
                )}
              </div>
            </div>

            {/* ── Pagamento ao fornecedor ──────────────────────────────── */}
            <div className="mt-5">
              <p className="mb-2.5 text-[11px] uppercase tracking-wider text-white/40">
                Pagamento ao fornecedor
              </p>
              <div className="grid grid-cols-12 gap-3">
                {/* Linha 1: Forma | Cartão (condicional) | Valor total */}
                <Field
                  label="Forma de pagamento"
                  error={props.errors[`produto_${i}_pgto_forma`]}
                  className="col-span-12 sm:col-span-3"
                >
                  <Select
                    value={p.pgto_forma || undefined}
                    onValueChange={(v) =>
                      patch(p.id, () => ({ pgto_forma: v as PgtoForma }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cartao">{PGTO_FORMA_LABEL["cartao"]}</SelectItem>
                      <SelectItem value="pix">{PGTO_FORMA_LABEL["pix"]}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {p.pgto_forma === "cartao" && (
                  <Field
                    label="Cartão da agência"
                    className="col-span-12 sm:col-span-5"
                  >
                    <Select
                      value={p.pgto_cartao_id || undefined}
                      onValueChange={(v) => patch(p.id, () => ({ pgto_cartao_id: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {props.cartoes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} (venc. {c.dia_vencimento})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                {/* Valor total — calculado automaticamente */}
                <Field
                  label="Valor total"
                  hint="Custo + RAV extra fornecedor"
                  className="col-span-12 sm:col-span-4"
                >
                  <CurrencyInput
                    value={p.pgto_valor_total_str}
                    onChange={(v) => patch(p.id, () => ({ pgto_valor_total_str: v }))}
                  />
                </Field>

                {/* Entrada + Parcelas + Valor parcela — ocultos no PIX */}
                {p.pgto_forma !== "pix" && (
                  <>
                    <Field
                      label="Entrada"
                      className="col-span-12 sm:col-span-4"
                    >
                      <CurrencyInput
                        value={p.pgto_entrada_str}
                        onChange={(v) => patch(p.id, () => ({ pgto_entrada_str: v }))}
                      />
                    </Field>

                    <div className="col-span-6 sm:col-span-2">
                      <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/55">
                        Parcelas
                      </Label>
                      <div className="flex h-10 items-center overflow-hidden rounded-md border border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() =>
                            patch(p.id, () => ({
                              pgto_num_parcelas: Math.max(1, p.pgto_num_parcelas - 1),
                            }))
                          }
                          disabled={p.pgto_num_parcelas <= 1}
                          className="flex h-full w-9 shrink-0 items-center justify-center border-r border-white/[0.08] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                          aria-label="Diminuir parcelas"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="flex-1 text-center text-sm tabular-nums text-white">
                          {p.pgto_num_parcelas}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            patch(p.id, () => ({
                              pgto_num_parcelas: Math.min(360, p.pgto_num_parcelas + 1),
                            }))
                          }
                          disabled={p.pgto_num_parcelas >= 360}
                          className="flex h-full w-9 shrink-0 items-center justify-center border-l border-white/[0.08] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                          aria-label="Aumentar parcelas"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Valor da parcela — display calculado */}
                    <div className="col-span-6 sm:col-span-4">
                      {(() => {
                        const userTotal = parseValorComSoma(p.pgto_valor_total_str)
                        const total = userTotal > 0
                          ? userTotal
                          : parseValorComSoma(p.valor_custo_str) + parseValorComSoma(p.rav_extra_fornecedor_str)
                        const entrada = parseValorComSoma(p.pgto_entrada_str) || 0
                        const n = p.pgto_num_parcelas || 1
                        const parcela = (total - entrada) / n
                        return (
                          <>
                            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/55">
                              Valor da parcela
                            </Label>
                            <div className="flex h-10 items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-3 text-sm tabular-nums text-white/75">
                              {parcela > 0
                                ? formatBRL(parcela)
                                : <span className="text-white/25">—</span>}
                            </div>
                            <p className="mt-1 text-[10px] text-white/35">
                              (total − entrada) ÷ parcelas
                            </p>
                          </>
                        )
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
            </div>
            </div>
            </div>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        onClick={adicionarProduto}
        className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.04] hover:text-white"
      >
        <Plus className="mr-2 h-4 w-4" />
        Adicionar outro produto
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Cobrança
// ─────────────────────────────────────────────────────────────────────────────

function Step3Cobranca(props: {
  itens: CobrancaItemState[]
  setItens: React.Dispatch<React.SetStateAction<CobrancaItemState[]>>
  obs: string
  setObs: (v: string) => void
  totalVenda: number
  errors: Record<string, string>
}) {
  function adicionar() {
    props.setItens((s) => [...s, novoItemCobranca()])
  }
  function remover(idx: number) {
    props.setItens((s) => s.filter((_, i) => i !== idx))
  }
  function patch(idx: number, p: Partial<CobrancaItemState>) {
    props.setItens((s) =>
      s.map((it, i) => (i === idx ? { ...it, ...p } : it)),
    )
  }

  const totalCobrado = props.itens.reduce(
    (acc, it) => acc + (parseValorComSoma(it.valor_total_str) || 0),
    0,
  )
  const diferenca = Math.abs(totalCobrado - props.totalVenda)
  const cobre = diferenca < 0.01

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45">
              Total da venda
            </p>
            <p className="text-base font-semibold tabular-nums text-white">
              {formatBRL(props.totalVenda)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45">
              Total cobrado
            </p>
            <p
              className={
                "text-base font-semibold tabular-nums " +
                (cobre ? "text-emerald-300" : "text-amber-300")
              }
            >
              {formatBRL(totalCobrado)}
            </p>
          </div>
        </div>
      </div>

      {props.itens.map((it, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-white">
              Cobrança {i + 1}
            </p>
            {props.itens.length > 1 && (
              <button
                type="button"
                onClick={() => remover(i)}
                className="rounded p-1 text-rose-300/70 hover:text-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {(() => {
            const semParcelas = it.tipo === "pix" || it.tipo === "outro"
            return (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Forma de pagamento">
              <Select
                value={it.tipo}
                onValueChange={(v) =>
                  patch(i, {
                    tipo: v as CobrancaTipo,
                    ...(v === "pix" || v === "outro" ? { num_parcelas: 1 } : {}),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">{COBRANCA_TIPO_LABEL["pix"]}</SelectItem>
                  <SelectItem value="boleto">{COBRANCA_TIPO_LABEL["boleto"]}</SelectItem>
                  <SelectItem value="cartao_credito">{COBRANCA_TIPO_LABEL["cartao_credito"]}</SelectItem>
                  <SelectItem value="outro">{COBRANCA_TIPO_LABEL["outro"]}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {it.tipo === "outro" && (
              <Field
                label="Forma de pagamento (Outro)"
                error={props.errors[`cobranca_${i}_outro_descricao`]}
              >
                <Input
                  value={it.outro_descricao}
                  onChange={(ev) => patch(i, { outro_descricao: ev.target.value })}
                  placeholder="Ex: Cheque, Permuta…"
                />
              </Field>
            )}

            <Field
              label="Valor"
              error={props.errors[`cobranca_${i}_valor`]}
            >
              <CurrencyInput
                value={it.valor_total_str}
                onChange={(v) => patch(i, { valor_total_str: v })}
              />
            </Field>

            {!semParcelas && (
              <>
                <Field label="Número de parcelas">
                  <div className="flex h-10 items-center overflow-hidden rounded-md border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => patch(i, { num_parcelas: Math.max(1, it.num_parcelas - 1) })}
                      disabled={it.num_parcelas <= 1}
                      className="flex h-full w-9 shrink-0 items-center justify-center border-r border-white/[0.08] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                      aria-label="Diminuir parcelas"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="flex-1 text-center text-sm tabular-nums text-white">
                      {it.num_parcelas}
                    </span>
                    <button
                      type="button"
                      onClick={() => patch(i, { num_parcelas: Math.min(360, it.num_parcelas + 1) })}
                      disabled={it.num_parcelas >= 360}
                      className="flex h-full w-9 shrink-0 items-center justify-center border-l border-white/[0.08] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                      aria-label="Aumentar parcelas"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Field>

                <Field label="Valor da parcela" hint="valor ÷ parcelas">
                  <CurrencyInput
                    value={(() => {
                      const total = parseValorComSoma(it.valor_total_str) || 0
                      const n = it.num_parcelas || 1
                      const v = total / n
                      return v > 0 ? formatBRL(v) : ""
                    })()}
                    onChange={() => {}}
                    disabled
                  />
                </Field>
              </>
            )}

            <Field label={semParcelas ? "Data pagamento" : "Data primeiro recebimento"}>
              <DateInput
                value={it.data_primeiro_recebimento}
                onChange={(iso) => patch(i, { data_primeiro_recebimento: iso })}
              />
            </Field>

            <Field label="Plataforma / link (opcional)">
              <Input
                value={it.plataforma_link}
                onChange={(ev) =>
                  patch(i, { plataforma_link: ev.target.value })
                }
                placeholder="PagSeguro, Cielo…"
              />
            </Field>

          </div>
            )
          })()}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={adicionar}
        className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.04] hover:text-white"
      >
        <Plus className="mr-2 h-4 w-4" />
        Adicionar outra forma de cobrança
      </Button>

      <Field label="Observações da cobrança (opcional)">
        <Textarea
          value={props.obs}
          onChange={(ev) => props.setObs(ev.target.value)}
          rows={2}
        />
      </Field>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Passageiros
// ─────────────────────────────────────────────────────────────────────────────

function Step4Passageiros(props: {
  passageiros: PassageiroState[]
  setPassageiros: React.Dispatch<React.SetStateAction<PassageiroState[]>>
  pax: number
  clienteNome: string
  clienteCpf: string
  errors: Record<string, string>
}) {
  function adicionar() {
    props.setPassageiros((s) => [...s, novoPassageiro()])
  }
  function remover(id: string) {
    props.setPassageiros((s) => s.filter((p) => p.id !== id))
  }
  function patch(id: string, p: Partial<PassageiroState>) {
    props.setPassageiros((s) =>
      s.map((px) => (px.id === id ? { ...px, ...p } : px)),
    )
  }

  function handleUsarDadosCliente(id: string, checked: boolean) {
    if (checked) {
      // desmarca qualquer outro que estivesse usando
      props.setPassageiros((s) =>
        s.map((px) =>
          px.id === id
            ? { ...px, usandoDadosCliente: true, nome: props.clienteNome, cpf: props.clienteCpf }
            : { ...px, usandoDadosCliente: false },
        ),
      )
    } else {
      patch(id, { usandoDadosCliente: false, nome: "", cpf: "" })
    }
  }

  const temDadosCliente = !!(props.clienteNome || props.clienteCpf)
  const idUsandoDados = props.passageiros.find((p) => p.usandoDadosCliente)?.id ?? null

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/55">
        PAX informado: <span className="text-white">{props.pax}</span>. Cadastre
        os passageiros aqui — todos serão associados a todos os produtos da
        venda. Granularidade por produto vem em V1.1.
      </p>

      {props.passageiros.map((p, i) => {
        const usandoDados = !!p.usandoDadosCliente
        const outroUsando = idUsandoDados !== null && idUsandoDados !== p.id
        return (
          <div
            key={p.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-white">
                  Passageiro {i + 1}
                </p>
                {temDadosCliente && (
                  <label className="flex select-none cursor-pointer items-center gap-1.5 text-xs text-white/55 hover:text-white/80">
                    <Checkbox
                      checked={usandoDados}
                      disabled={outroUsando}
                      onCheckedChange={(checked) =>
                        handleUsarDadosCliente(p.id, !!checked)
                      }
                    />
                    <span>Usar dados do Cliente</span>
                  </label>
                )}
              </div>
              {props.passageiros.length > 1 && (
                <button
                  type="button"
                  onClick={() => remover(p.id)}
                  className="rounded p-1 text-rose-300/70 hover:text-rose-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nome" error={props.errors[`passageiro_${i}_nome`]}>
                <Input
                  value={p.nome}
                  onChange={(ev) => patch(p.id, { nome: ev.target.value })}
                  disabled={usandoDados}
                />
              </Field>
              <Field label="CPF" error={props.errors[`passageiro_${i}_cpf`]}>
                <Input
                  value={formatCpf(p.cpf)}
                  onChange={(ev) => patch(p.id, { cpf: ev.target.value })}
                  maxLength={14}
                  placeholder="000.000.000-00"
                  disabled={usandoDados}
                />
              </Field>
              <Field label="Data de nascimento (opcional)">
                <DateInput
                  value={p.data_nascimento}
                  onChange={(iso) => patch(p.id, { data_nascimento: iso })}
                />
              </Field>
            </div>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        onClick={adicionar}
        className="border-white/10 bg-transparent text-white/80 hover:bg-white/[0.04] hover:text-white"
      >
        <Plus className="mr-2 h-4 w-4" />
        Adicionar passageiro
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Revisão
// ─────────────────────────────────────────────────────────────────────────────

function Step5Revisao(props: {
  empresaNome: string
  dataVenda: string
  dataInicioViagem: string
  dataFimViagem: string
  cliente: string
  clienteNovoFlag: boolean
  pax: number
  agenteNome: string
  origem: string
  produtos: {
    tipoNome: string
    icone: string | null
    valorVenda: number
    valorCusto: number
    comissao: number
    rav: number
  }[]
  cobranca: { tipo: string; valor: number; parcelas: number }[]
  passageiros: string[]
  /** Quando true (Admin/Gerente), exibe coluna/linha de comissão na revisão.
   *  Agentes não veem — comissão é calculada por regra administrativa no aprovo. */
  mostraComissao: boolean
  /** Percentual de comissão do agente (calculado pela regra de origem/perfil). */
  comissaoPercentual: number | null
}) {
  const totalVenda = props.produtos.reduce((a, p) => a + p.valorVenda, 0)
  const totalCusto = props.produtos.reduce((a, p) => a + p.valorCusto, 0)
  const totalComissao = props.produtos.reduce((a, p) => a + p.comissao, 0)
  const totalRav = props.produtos.reduce((a, p) => a + p.rav, 0)
  const lucroBruto = totalVenda - totalCusto - totalComissao
  const totalCobranca = props.cobranca.reduce((a, c) => a + c.valor, 0)

  const margemRav =
    totalVenda > 0 ? ((totalRav / totalVenda) * 100).toFixed(1) : null

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* ── Coluna esquerda ──────────────────────────────────────────── */}
      <div className="space-y-5 lg:col-span-2">
        <Bloco titulo="Identificação">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Stat label="Empresa" value={props.empresaNome} />
            <Stat label="Data da venda" value={formatDateBR(props.dataVenda)} />
            <Stat
              label="Cliente"
              value={
                <span className="flex flex-wrap items-center gap-1.5">
                  {props.cliente}
                  {props.clienteNovoFlag && (
                    <span className="rounded-full border border-nexus-bright/30 bg-nexus-bright/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-nexus-bright">
                      novo
                    </span>
                  )}
                </span>
              }
            />
            <Stat label="Agente" value={props.agenteNome} />
            <Stat label="PAX" value={`${props.pax} passageiro(s)`} />
            {props.origem && <Stat label="Origem do lead" value={props.origem} />}
            {props.dataInicioViagem && (
              <Stat
                label="Período da viagem"
                value={
                  props.dataFimViagem
                    ? `${formatDateBR(props.dataInicioViagem)} – ${formatDateBR(props.dataFimViagem)}`
                    : formatDateBR(props.dataInicioViagem)
                }
              />
            )}
          </div>
        </Bloco>

        <Bloco titulo={`Produtos (${props.produtos.length})`}>
          <div className="overflow-hidden rounded-lg border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Venda</th>
                  <th className="px-3 py-2 text-right">Custo</th>
                  <th className="px-3 py-2 text-right">RAV</th>
                  {props.mostraComissao && (
                    <th className="px-3 py-2 text-right">Comissão</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {props.produtos.map((p, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-3 py-2 text-white/85">
                      <span className="flex items-center gap-1.5">
                        {p.icone && (
                          <span className="relative block h-3.5 w-3.5 shrink-0">
                            <Image
                              src={`/icons/tipos-produto/${p.icone}.png`}
                              alt={p.tipoNome}
                              fill
                              className="object-contain"
                              style={{ filter: "brightness(0) invert(1)", opacity: 0.5 }}
                            />
                          </span>
                        )}
                        {p.tipoNome}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/85">
                      {formatBRL(p.valorVenda)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/55">
                      {formatBRL(p.valorCusto)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/70">
                      {formatBRL(p.rav)}
                    </td>
                    {props.mostraComissao && (
                      <td className="px-3 py-2 text-right tabular-nums text-amber-300/80">
                        {formatBRL(p.comissao)}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-white/[0.03] font-medium">
                  <td className="px-3 py-2 text-white/55">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white">
                    {formatBRL(totalVenda)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/65">
                    {formatBRL(totalCusto)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/85">
                    {formatBRL(totalRav)}
                  </td>
                  {props.mostraComissao && (
                    <td className="px-3 py-2 text-right tabular-nums text-amber-300">
                      {formatBRL(totalComissao)}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </Bloco>

        <Bloco titulo="Cobrança do cliente">
          <ul className="space-y-1.5 text-sm">
            {props.cobranca.map((c, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-white/75">
                  {c.tipo}
                  {c.parcelas > 1 && (
                    <span className="ml-2 text-xs text-white/45">
                      {c.parcelas}x
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-white">
                  {formatBRL(c.valor)}
                </span>
              </li>
            ))}
            <li className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 font-medium">
              <span className="text-white/85">Total cobrado</span>
              <span className="tabular-nums text-white">
                {formatBRL(totalCobranca)}
              </span>
            </li>
          </ul>
        </Bloco>

        <Bloco titulo={`Passageiros (${props.passageiros.length})`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {props.passageiros.map((nome, i) => (
              <li
                key={i}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/80"
              >
                {nome}
              </li>
            ))}
          </ul>
        </Bloco>
      </div>

      {/* ── Coluna direita — painel financeiro ───────────────────────── */}
      <div className="lg:col-span-1">
        <div className="space-y-4">
        <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
            Resultado financeiro
          </p>

          {/* Total da venda — destaque */}
          <div className="rounded-lg border border-nexus-bright/20 bg-nexus-bright/[0.07] px-4 py-3">
            <p className="mb-0.5 text-[11px] text-white/45">Total da venda</p>
            <p className="text-2xl font-bold tabular-nums text-white">
              {formatBRL(totalVenda) || "—"}
            </p>
          </div>

          {/* Métricas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/55">Custo total</span>
              <span className="tabular-nums text-white/75">
                {formatBRL(totalCusto) || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/55">RAV bruto</span>
              <span className="tabular-nums text-white/85">
                {formatBRL(totalRav) || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/55">Margem RAV</span>
              <span className="tabular-nums text-white/70">
                {margemRav !== null ? `${margemRav}%` : "—"}
              </span>
            </div>
          </div>

          {/* Comissão + lucro — só Admin/Gerente */}
          {props.mostraComissao && (
            <div className="space-y-2.5 border-t border-white/[0.06] pt-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">Comissão do vendedor</span>
                <span className="tabular-nums text-amber-300">
                  {formatBRL(totalComissao) || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/75">Lucro bruto</span>
                <span
                  className={
                    "text-base font-semibold tabular-nums " +
                    (lucroBruto >= 0 ? "text-emerald-300" : "text-rose-300")
                  }
                >
                  {formatBRL(Math.abs(lucroBruto))
                    ? (lucroBruto < 0 ? "−" : "") + formatBRL(Math.abs(lucroBruto))
                    : "—"}
                </span>
              </div>
            </div>
          )}

          {/* Total cobrado + alerta de divergência */}
          <div className="border-t border-white/[0.06] pt-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/55">Total cobrado</span>
              <span className="tabular-nums text-white/85">
                {formatBRL(totalCobranca) || "—"}
              </span>
            </div>
            {totalVenda > 0 &&
              totalCobranca > 0 &&
              Math.abs(totalCobranca - totalVenda) > 0.01 && (
                <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1.5 text-[11px] leading-snug text-amber-300/90">
                  Cobrança (
                  {formatBRL(totalCobranca)}) difere do total da venda (
                  {formatBRL(totalVenda)}).
                </p>
              )}
          </div>
        </div>

        {/* ── Margem do vendedor ───────────────────────────────────── */}
        {props.mostraComissao && (
          <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Comissão do vendedor
            </p>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
              <p className="mb-0.5 text-[11px] text-white/45">Total da comissão</p>
              <p className="text-2xl font-bold tabular-nums text-amber-300">
                {formatBRL(totalComissao) || "—"}
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">% sobre a venda</span>
                <span className="tabular-nums text-white/75">
                  {totalVenda > 0
                    ? `${((totalComissao / totalVenda) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">% sobre o RAV</span>
                <span className="tabular-nums text-white/75">
                  {totalRav > 0
                    ? `${((totalComissao / totalRav) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t border-white/[0.06] pt-3.5">
              <p className="text-[10px] uppercase tracking-wider text-white/35">
                Por produto
              </p>
              {props.produtos.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-white/65">
                    {p.icone && (
                      <span className="relative block h-3.5 w-3.5 shrink-0">
                        <Image
                          src={`/icons/tipos-produto/${p.icone}.png`}
                          alt={p.tipoNome}
                          fill
                          className="object-contain"
                          style={{ filter: "brightness(0) invert(1)", opacity: 0.45 }}
                        />
                      </span>
                    )}
                    {p.tipoNome}
                  </span>
                  <span className="tabular-nums text-amber-300/80">
                    {p.comissao > 0 ? formatBRL(p.comissao) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Comissão estimada do agente ──────────────────────── */}
        {props.comissaoPercentual != null && (
          <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Sua comissão estimada
            </p>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
              <p className="mb-0.5 text-[11px] text-white/45">Valor estimado</p>
              <p className="text-2xl font-bold tabular-nums text-amber-300">
                {totalRav > 0
                  ? formatBRL((totalRav * props.comissaoPercentual) / 100)
                  : "—"}
              </p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-white/55">Percentual aplicado</span>
              <span className="tabular-nums font-medium text-nexus-bright">
                {props.comissaoPercentual}%
              </span>
            </div>

            <p className="text-[10px] leading-relaxed text-white/30">
              Estimativa sujeita à aprovação do gerente.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de UI
// ─────────────────────────────────────────────────────────────────────────────

function Bloco({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
        {titulo}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

/** Label acima, valor abaixo — para grids de resumo (Step5 Identificação). */
function Stat({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="text-sm text-white/90">{value}</p>
    </div>
  )
}

function Field({
  label,
  icon,
  error,
  hint,
  children,
  className,
}: {
  label: string
  icon?: React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
        {icon}
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-white/40">{hint}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

function formatDateBR(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
