"use client"

import Image from "next/image"
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react"
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
  ExternalLink,
  Minus,
  Paperclip,
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
import { CartaoCombobox } from "./cartao-combobox"
import {
  ComprovanteCobrancaUpload,
  RevisaoComprovanteLink,
} from "./comprovante-cobranca-upload"
import { IconTooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { criarVenda, editarEAprovarVenda, resubmeterVenda } from "@/app/(dashboard)/vendas/actions"
import { salvarRascunho, descartarRascunho } from "@/app/(dashboard)/vendas/rascunho-actions"
import {
  listarAnexos,
  uploadAnexo,
  excluirAnexo,
  obterUrlAnexo,
  migrarAnexosParaVenda,
} from "@/app/(dashboard)/vendas/anexos-actions"
import {
  MAX_ANEXOS_POR_VENDA,
  MAX_ANEXO_BYTES,
  MIMES_ACEITOS,
  type AnexoVenda,
} from "@/lib/schemas/anexo"
import {
  COBRANCA_TIPO_LABEL,
  PGTO_FORMA_LABEL,
  type CobrancaTipo,
  type PgtoForma,
} from "@/lib/schemas/venda"
import { formatBRL, parseValorComSoma } from "@/lib/utils/sum-parser"
import { DateInput } from "@/components/ui/date-input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { formatCnpj, formatCpf, formatTelefone, onlyDigits, toTitleCase } from "@/lib/utils/formatters"
import { PhoneInput } from "@/components/shared/phone-input"
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
type Fornecedor = {
  id: string
  nome: string
  tipos_produto_ids: string[]
}
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
  step: 1 | 2 | 3 | 4 | 5 | 6
  /** Callback para mudar o passo (controle externo). */
  onStepChange: (step: 1 | 2 | 3 | 4 | 5 | 6) => void
  /** Passo mais avançado atingido — para salvar no rascunho e restaurar corretamente. */
  maxStep: 1 | 2 | 3 | 4 | 5 | 6
  onMaxStepChange: (step: 1 | 2 | 3 | 4 | 5 | 6) => void
  /** Modo edição por Gerente/Admin: steps 1-5 têm "Salvar e Revisar", step 6 tem "Validar Venda". */
  modoGerente?: boolean
  /** ID da venda sendo editada (obrigatório em modoGerente). */
  vendaId?: string
  /** Callback opcional disparado quando muda a validade de cada step.
   *  Usado pelo `EditarVendaModal` pra estilizar os tabs (✓ válido / ⚠ inválido). */
  onStepsStatusChange?: (status: StepsStatus) => void
}

export type StepsStatus = {
  1: "valid" | "invalid"
  2: "valid" | "invalid"
  3: "valid" | "invalid"
  4: "valid" | "invalid"
  5: "valid" | "invalid"
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado interno do wizard
// ─────────────────────────────────────────────────────────────────────────────
// Exportado para que o NovaVendaModal possa tipá-lo ao hidratar um rascunho.
export type WizardDraftData = {
  step: 1 | 2 | 3 | 4 | 5 | 6
  /** Passo mais avançado que o usuário chegou — usado para restaurar o rascunho. */
  maxStep: 1 | 2 | 3 | 4 | 5 | 6
  empresaId: string
  dataVenda: string
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
  /** UUID gerado no client pra agrupar anexos uploadados durante o wizard.
   *  Persistido no rascunho pra que reabrir o rascunho recupere os anexos. */
  wizardSessionId?: string
}

type ProdutoState = {
  id: string // local uuid pra key
  tipo_produto_id: string
  /** Fornecedor selecionado via junction table (id do fornecedor, "outro" ou ""). */
  fornecedor_id: string
  /** Nome livre quando fornecedor_id === "outro". */
  fornecedor_outro_nome: string
  /** input livre, parseado no submit */
  valor_venda_str: string
  valor_custo_str: string
  rav_str: string
  rav_extra_cliente_str: string
  rav_extra_fornecedor_str: string
  comissao_vendedor_str: string
  valores_extras: Record<string, string>
  /** Data de emissão do produto (ex: data de emissão do bilhete aéreo).
   *  Conferência operacional — não tem efeito em cálculos. ISO YYYY-MM-DD. */
  data_emissao_str: string
  /** Datas da viagem do produto (ex: ida e volta do voo, check-in/out do hotel). */
  data_inicio_viagem_str: string
  data_fim_viagem_str: string
  /** "comissionado" (default): pgto fornecedor = custo.
   *  "net": pgto fornecedor = custo − RAV extra fornecedor. */
  pgto_modo: "comissionado" | "net"
  pgto_forma: PgtoForma | ""
  pgto_cartao_id: string
  pgto_valor_total_str: string
  pgto_entrada_str: string
  pgto_num_parcelas: number
  /** Data em que a entrada/1ª parcela é cobrada (cartão agência).
   *  Persiste em `venda_produtos.pgto_data_debito`. */
  pgto_data_entrada_str: string
  /** Valor extra na 1ª parcela (taxas no cartão). Diluído nas demais. */
  pgto_primeira_parcela_extra_str: string
}

type ParcelaDetalhe = {
  /** Posição 1-based pra exibir como "Parcela N". */
  ordem: number
  /** Valor da parcela como string (formato R$). */
  valor_str: string
  /** Data ISO YYYY-MM-DD da parcela. */
  data: string
}

type CobrancaItemState = {
  tipo: CobrancaTipo
  outro_descricao: string
  valor_total_str: string
  num_parcelas: number
  /** URL do link de pagamento — usado por `link_externo`. */
  plataforma_link: string
  /** Plataforma da cobrança — Select restrito a PagSeguro / Cielo. */
  plataforma: "" | "PagSeguro" | "Cielo"
  /** Distribuição das parcelas — vazia em pagamento à vista. */
  parcelas_detalhe: ParcelaDetalhe[]
  taxa_adquirente_str: string
  valor_liquido_str: string
  data_inicio: string
  data_primeiro_recebimento: string
  observacoes: string
  /** Comprovante de pagamento — obrigatório por item. */
  comprovante_storage_path: string
  comprovante_nome_arquivo: string
  comprovante_mime_type: string
  comprovante_tamanho_bytes: number
}

type PassageiroState = {
  id: string
  nome: string
  cpf: string
  data_nascimento: string
  /** Número do passaporte do passageiro — opcional. Usado em vendas
   *  internacionais. Sempre uppercase, máx 10 chars (igual cliente). */
  passaporte: string
  usandoDadosCliente?: boolean
}

type ClienteNovoState = {
  tipo_pessoa: "fisica" | "juridica"
  // PF
  nome: string
  cpf: string
  data_nascimento: string
  /** Número do passaporte — opcional. PF apenas. */
  passaporte: string
  // PJ
  razao_social: string
  nome_fantasia: string
  cnpj: string
  responsavel: string
  // Comuns
  email: string
  telefone_ddi: string
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
  { num: 5, label: "Anexos", icon: Paperclip },
  { num: 6, label: "Revisão", icon: Check },
] as const

function novoProduto(): ProdutoState {
  return {
    id: crypto.randomUUID(),
    tipo_produto_id: "",
    fornecedor_id: "",
    fornecedor_outro_nome: "",
    valor_venda_str: "",
    valor_custo_str: "",
    rav_str: "",
    rav_extra_cliente_str: "",
    rav_extra_fornecedor_str: "",
    comissao_vendedor_str: "",
    valores_extras: {},
    data_emissao_str: "",
    data_inicio_viagem_str: "",
    data_fim_viagem_str: "",
    pgto_modo: "comissionado",
    pgto_forma: "",
    pgto_cartao_id: "",
    pgto_valor_total_str: "",
    pgto_entrada_str: "",
    pgto_num_parcelas: 1,
    pgto_data_entrada_str: "",
    pgto_primeira_parcela_extra_str: "",
  }
}

function novoPassageiro(nome = ""): PassageiroState {
  return {
    id: crypto.randomUUID(),
    nome,
    cpf: "",
    data_nascimento: "",
    passaporte: "",
  }
}

function novoItemCobranca(): CobrancaItemState {
  return {
    tipo: "pix",
    outro_descricao: "",
    valor_total_str: "",
    num_parcelas: 1,
    plataforma_link: "",
    plataforma: "",
    parcelas_detalhe: [],
    taxa_adquirente_str: "",
    valor_liquido_str: "",
    data_inicio: "",
    data_primeiro_recebimento: "",
    observacoes: "",
    comprovante_storage_path: "",
    comprovante_nome_arquivo: "",
    comprovante_mime_type: "",
    comprovante_tamanho_bytes: 0,
  }
}

/**
 * Garante que um item de cobrança recebido de fora (ex: rascunho persistido
 * em versão anterior do schema) tenha TODOS os campos requeridos pelo state
 * atual. Mescla com o template do `novoItemCobranca` — campos ausentes
 * recebem default; campos presentes prevalecem.
 *
 * Sem isso, drafts antigos quebram em runtime quando tentamos `.map` em
 * `parcelas_detalhe` (que vinha como undefined).
 */
function normalizarCobrancaItem(
  it: Partial<CobrancaItemState>,
): CobrancaItemState {
  const base = novoItemCobranca()
  return {
    ...base,
    ...it,
    // Override defensivo nos arrays/objetos pra garantir tipo correto
    parcelas_detalhe: Array.isArray(it.parcelas_detalhe)
      ? it.parcelas_detalhe
      : [],
    plataforma:
      it.plataforma === "PagSeguro" || it.plataforma === "Cielo"
        ? it.plataforma
        : "",
  }
}

/** Recalcula `parcelas_detalhe` distribuindo o valor total igualmente.
 *  Mantém datas já preenchidas; cria entradas faltantes com data vazia. */
function redistribuirParcelas(it: CobrancaItemState): ParcelaDetalhe[] {
  const n = Math.max(1, it.num_parcelas)
  const total = parseValorComSoma(it.valor_total_str) || 0
  const base = total / n
  return Array.from({ length: n }).map((_, i) => {
    const existente = it.parcelas_detalhe[i]
    return {
      ordem: i + 1,
      valor_str: base > 0 ? formatBRL(base) : (existente?.valor_str ?? ""),
      data: existente?.data ?? "",
    }
  })
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

  // ── Anexos ───────────────────────────────────────────────────────────────
  // O `wizardSessionId` é um UUID estável durante toda a sessão do wizard.
  // Para nova venda: anexos são uploadados com este session_id; quando a
  // venda é criada, o server action `migrarAnexosParaVenda` migra os
  // registros pra venda_id. Para edição: usa-se direto o `props.vendaId`.
  // Hidrata do rascunho se existir, senão gera novo — assim reabrir o
  // rascunho recupera os anexos uploadados anteriormente.
  const [wizardSessionId] = useState<string>(
    () => d?.wizardSessionId ?? crypto.randomUUID(),
  )
  const [anexos, setAnexos] = useState<AnexoVenda[]>([])

  // Carrega anexos iniciais quando o wizard abre — uma única vez por sessão.
  useEffect(() => {
    let cancel = false
    listarAnexos({
      vendaId: props.vendaId ?? null,
      wizardSessionId: props.vendaId ? null : wizardSessionId,
    }).then((r) => {
      if (cancel) return
      if (r.ok && r.data) setAnexos(r.data)
    })
    return () => {
      cancel = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.vendaId, wizardSessionId])

  // ── Autosave (rascunho) ───────────────────────────────────────────────────
  // Liga apenas em nova venda do agente (sem vendaId, não-gerente). Marca
  // dirty a cada mudança de estado relevante, salva 1.5s depois do último
  // keystroke; heartbeat de 10s garante save mesmo durante digitação contínua.
  type AutoStatus = "idle" | "dirty" | "saving" | "saved" | "error"
  const autosaveAtivo = !props.modoGerente && !props.vendaId
  const [autoStatus, setAutoStatus] = useState<AutoStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const dirtyRef = useRef(false)
  const inflightRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Flag pra ignorar o primeiro disparo do useEffect (montagem inicial).
   *  Só começa a autosalvar a partir da primeira mudança real de campo. */
  const tocouRef = useRef(false)

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
        passaporte: "",
        razao_social: "",
        nome_fantasia: "",
        cnpj: "",
        responsavel: "",
        email: "",
        telefone_ddi: "+55",
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

  // Produtos — normaliza rascunhos antigos que não têm os campos de fornecedor
  const [produtos, setProdutos] = useState<ProdutoState[]>(() => {
    const raw = d?.produtos
    if (!raw) return [novoProduto()]
    return raw.map((p) => ({
      ...novoProduto(),
      ...p,
      fornecedor_id: (p as ProdutoState).fornecedor_id ?? "",
      fornecedor_outro_nome: (p as ProdutoState).fornecedor_outro_nome ?? "",
    }))
  })

  // Cobrança — normaliza rascunhos antigos que possam não ter os campos
  // mais recentes (parcelas_detalhe, plataforma). Garante shape consistente
  // independente da versão do schema que gerou o draft.
  const [cobrancaItens, setCobrancaItens] = useState<CobrancaItemState[]>(
    () => (d?.cobrancaItens ?? [novoItemCobranca()]).map(normalizarCobrancaItem),
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
    if (!clienteValue) e.cliente_id = "Selecione um cliente ou cadastre um novo."
    if (clienteValue === "novo") {
      if (clienteNovo.tipo_pessoa === "fisica") {
        if (clienteNovo.nome.trim().length < 2)
          e.novo_nome = "Informe o nome do cliente."
        if (!cpfValido(clienteNovo.cpf)) e.novo_cpf = "CPF inválido."
        if (!clienteNovo.data_nascimento)
          e.novo_data_nascimento = "Data de nascimento obrigatória."
        // Passaporte é opcional. Validação só de formato se preenchido.
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
    if (!origem) e.origem = "Selecione a origem do lead."
    return e
  }

  function validarStep2(): Record<string, string> {
    const e: Record<string, string> = {}
    if (produtos.length === 0) e.produtos = "Adicione ao menos um produto."
    produtos.forEach((p, i) => {
      if (!p.tipo_produto_id) e[`produto_${i}_tipo`] = "Tipo obrigatório."

      // Identificação — campos fixos obrigatórios
      if (!p.fornecedor_id) {
        e[`produto_${i}_fornecedor`] = "Fornecedor obrigatório."
      } else if (p.fornecedor_id === "outro" && !p.fornecedor_outro_nome.trim()) {
        e[`produto_${i}_fornecedor_outro`] = "Informe o nome do fornecedor."
      }
      if (!p.data_emissao_str)
        e[`produto_${i}_data_emissao`] = "Data de emissão obrigatória."
      if (!p.data_inicio_viagem_str)
        e[`produto_${i}_data_inicio_viagem`] = "Início da viagem obrigatório."
      // Fim da viagem é opcional (alguns produtos como passagem só-ida ou
      // serviços avulsos não têm data fim). Quando preenchido, ainda
      // validamos que não precede o início.
      if (
        p.data_fim_viagem_str &&
        p.data_inicio_viagem_str &&
        p.data_fim_viagem_str < p.data_inicio_viagem_str
      ) {
        e[`produto_${i}_data_fim_viagem`] =
          "Fim da viagem deve ser igual ou posterior ao início."
      }

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

  /** Se todos os produtos são `cartao_cliente`, o Step 3 fica restrito a
   *  Faturado ou Link Externo — o cliente paga via cartão e a Magic só
   *  registra o canal de cobrança usado. */
  const todosCartaoCliente =
    produtos.length > 0 && produtos.every((p) => p.pgto_forma === "cartao_cliente")

  // Quando o usuário entra no modo restrito (todos cartão cliente), itens
  // já preenchidos com tipos não-permitidos (pix, boleto, cartao_credito,
  // outro…) são migrados pra `link_externo` — assim o Select volta a ter
  // um valor válido em vez de ficar vazio.
  useEffect(() => {
    if (!todosCartaoCliente) return
    const tiposPermitidos: CobrancaTipo[] = ["faturado", "link_externo"]
    setCobrancaItens((prev) => {
      let mudou = false
      const next = prev.map((it) => {
        if (tiposPermitidos.includes(it.tipo)) return it
        mudou = true
        return { ...it, tipo: "link_externo" as CobrancaTipo, num_parcelas: 1 }
      })
      return mudou ? next : prev
    })
  }, [todosCartaoCliente])

  function validarStep3(): Record<string, string> {
    const e: Record<string, string> = {}
    // Quando todos os produtos foram pagos com `cartao_cliente`, o cliente
    // paga direto no link do fornecedor e a Magic não emite cobrança nenhuma.
    // Step 3 vira informativo apenas — nada a validar.
    if (todosCartaoCliente) return e
    if (cobrancaItens.length === 0)
      e.cobranca_itens = "Adicione ao menos uma forma de cobrança."
    cobrancaItens.forEach((it, i) => {
      const v = parseValorComSoma(it.valor_total_str)
      if (!v || v <= 0) e[`cobranca_${i}_valor`] = "Valor inválido."
      if (it.tipo === "outro" && !it.outro_descricao.trim())
        e[`cobranca_${i}_outro_descricao`] = "Informe a forma de pagamento."
      // Em `link_externo`, plataforma (PagSeguro/Cielo) é obrigatória —
      // o operador precisa identificar qual gateway gerou o link.
      if (it.tipo === "link_externo" && !it.plataforma)
        e[`cobranca_${i}_plataforma`] = "Selecione a plataforma (PagSeguro ou Cielo)."
      // Comprovante de pagamento — só obrigatório pra `link_externo`
      // (PagSeguro/Cielo). Demais formas (PIX, boleto, cartão, faturado,
      // outro) não exigem comprovante.
      if (it.tipo === "link_externo" && !it.comprovante_storage_path)
        e[`cobranca_${i}_comprovante`] = "Anexe o comprovante de pagamento."

      // Parcelas (tipos parceláveis: PIX/boleto/cartão/faturado). Cada parcela
      // exige valor > 0 E data ISO preenchida. Usa o mesmo fallback do render
      // (redistribuirParcelas) pra cobrir o caso em que o usuário não tocou
      // ainda no detalhamento — o valor auto-fill conta, mas a data não.
      const ehParcelavel = it.tipo !== "outro" && it.tipo !== "link_externo"
      if (ehParcelavel) {
        const parcelas =
          it.parcelas_detalhe.length === it.num_parcelas
            ? it.parcelas_detalhe
            : redistribuirParcelas(it)
        parcelas.forEach((p, j) => {
          const valorP = parseValorComSoma(p.valor_str)
          if (!valorP || valorP <= 0) {
            e[`cobranca_${i}_parcela_${j}_valor`] =
              `Valor da parcela ${j + 1} obrigatório.`
          }
          if (!p.data) {
            e[`cobranca_${i}_parcela_${j}_data`] =
              `Data da parcela ${j + 1} obrigatória.`
          }
        })
      }
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

  // ── Revalidação ao vivo ──────────────────────────────────────────────────
  // Quando o usuário corrige um campo que estava marcado como erro, a
  // mensagem desaparece automaticamente. NÃO surge erro novo ao digitar —
  // apenas REMOVE erros já mostrados que deixaram de ser válidos.
  //
  // Funciona pra todos os steps porque os 4 validadores são puros e
  // independentes — basta unir os retornos e comparar com `errors`.
  useEffect(() => {
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev
      const atuais = {
        ...validarStep1(),
        ...asyncErrors,
        ...validarStep2(),
        ...validarStep3(),
        ...validarStep4(),
      }
      const next: Record<string, string> = {}
      let mudou = false
      for (const [k, v] of Object.entries(prev)) {
        if (atuais[k]) {
          next[k] = atuais[k]!
          // Atualiza a mensagem se mudou (ex: "CPF obrigatório" → "CPF inválido")
          if (atuais[k] !== v) mudou = true
        } else {
          mudou = true
        }
      }
      return mudou ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    empresaId, dataVenda, clienteValue, clienteNovo, pax, origem, asyncErrors,
    produtos, cobrancaItens, todosCartaoCliente,
    passageiros,
  ])

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
    // Passo 3 → 4: avisa se houver valor em aberto entre cobrança e venda.
    // Pula esse aviso quando a venda é totalmente cartao_cliente (cobrança
    // dispensada — cliente paga direto ao fornecedor).
    if (step === 3) {
      if (!todosCartaoCliente) {
        const totalCobrado = cobrancaItens.reduce(
          (acc, it) => acc + (parseValorComSoma(it.valor_total_str) || 0), 0,
        )
        if (Math.abs(totalCobrado - totalVenda) >= 0.01) {
          setConfirmValorAberto(true)
          return
        }
      }
      sincronizarPassageiros()
    }
    if (step < 6) {
      const next = (step + 1) as 1 | 2 | 3 | 4 | 5 | 6
      setStep(next)
      props.onMaxStepChange(Math.max(props.maxStep, next) as 1 | 2 | 3 | 4 | 5 | 6)
    }
  }

  function confirmarAvancoComValorAberto() {
    setConfirmValorAberto(false)
    sincronizarPassageiros()
    setStep(4)
  }

  function voltar() {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5 | 6)
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
    if (step === 3 && !todosCartaoCliente) {
      const totalCobrado = cobrancaItens.reduce(
        (acc, it) => acc + (parseValorComSoma(it.valor_total_str) || 0), 0,
      )
      if (Math.abs(totalCobrado - totalVenda) >= 0.01) {
        setConfirmValorAberto(true)
        return
      }
    }
    sincronizarPassageiros()
    setStep(6)
    props.onMaxStepChange(6)
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
      // Volta pra lista de vendas — alinhado com o fluxo de criação:
      // depois de mandar pra validação o agente sai do modal e vê a venda
      // saindo de "Precisa de revisão" pra "Aguardando aprovação".
      router.push("/vendas")
    })
  }

  // ── Salvar rascunho ───────────────────────────────────────────────────────

  function coletarEstadoAtual(): WizardDraftData {
    return {
      step,
      maxStep: props.maxStep,
      empresaId,
      dataVenda,
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
      wizardSessionId,
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

  // ── Autosave: dispara save sem toast, atualiza status visual ────────────
  // Captura refs estáveis pros valores usados durante o save assíncrono.
  const rascunhoIdRef = useRef(rascunhoId)
  rascunhoIdRef.current = rascunhoId

  async function autosaveAgora() {
    if (!autosaveAtivo) return
    if (inflightRef.current) return
    // Sem nada útil pra salvar — não chama o servidor
    if (!empresaId && !clienteValue && !dataVenda) return
    inflightRef.current = true
    setAutoStatus("saving")
    dirtyRef.current = false
    try {
      const r = await salvarRascunho(
        rascunhoIdRef.current,
        gerarTituloRascunho(),
        step,
        empresaId || null,
        coletarEstadoAtual() as unknown as Record<string, unknown>,
      )
      if (r.ok && r.data) {
        setRascunhoId(r.data.id)
        setLastSavedAt(new Date())
        // Se ficou dirty enquanto salvava, sinaliza e agenda novo save
        setAutoStatus(dirtyRef.current ? "dirty" : "saved")
      } else {
        dirtyRef.current = true
        setAutoStatus("error")
      }
    } catch {
      dirtyRef.current = true
      setAutoStatus("error")
    } finally {
      inflightRef.current = false
    }
  }

  // Marca dirty + agenda save com debounce a cada mudança de estado relevante.
  // Lista de deps cobre tudo que `coletarEstadoAtual` lê. O primeiro disparo
  // (montagem) é ignorado — só salva a partir da primeira interação do usuário.
  useEffect(() => {
    if (!autosaveAtivo) return
    if (!tocouRef.current) {
      tocouRef.current = true
      return
    }
    dirtyRef.current = true
    setAutoStatus((prev) => (prev === "saving" ? prev : "dirty"))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      autosaveAgora()
    }, 1500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    empresaId, dataVenda,
    clienteValue, clienteNovo, pax, origem, agenteId,
    observacoesGerais, produtos, cobrancaItens, cobrancaObs, passageiros,
  ])

  // Heartbeat: salva a cada 10s se houver dirty (cobre digitação contínua).
  useEffect(() => {
    if (!autosaveAtivo) return
    const id = setInterval(() => {
      if (dirtyRef.current) autosaveAgora()
    }, 10_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveAtivo])

  // Reporta validade dos steps 1-5 pro modal (usado pra estilizar tabs).
  // O step 5 (Anexos) é sempre válido — anexos são opcionais.
  useEffect(() => {
    if (!props.onStepsStatusChange) return
    const e1 = { ...validarStep1(), ...asyncErrors }
    const e2 = validarStep2()
    const e3 = validarStep3()
    const e4 = validarStep4()
    props.onStepsStatusChange({
      1: Object.keys(e1).length === 0 ? "valid" : "invalid",
      2: Object.keys(e2).length === 0 ? "valid" : "invalid",
      3: Object.keys(e3).length === 0 ? "valid" : "invalid",
      4: Object.keys(e4).length === 0 ? "valid" : "invalid",
      5: "valid",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    empresaId, dataVenda,
    clienteValue, clienteNovo, pax, origem, agenteId,
    produtos, cobrancaItens, passageiros, asyncErrors,
  ])

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
      // Associa anexos uploadados durante o wizard (vinculados a
      // wizardSessionId) à venda recém-criada. Best-effort — falha aqui não
      // bloqueia o fluxo, mas avisa o usuário.
      if (r.data?.id && anexos.length > 0) {
        const mig = await migrarAnexosParaVenda(wizardSessionId, r.data.id)
        if (!mig.ok) {
          toast.warning("Venda criada, mas alguns anexos podem não ter sido vinculados.")
        }
      }
      // Descarta o rascunho após aprovação bem-sucedida (silencioso)
      if (rascunhoId) {
        await descartarRascunho(rascunhoId).catch(() => null)
      }
      toast.success("Venda enviada para aprovação.")
      props.onSuccessClose?.()
      // Volta pra lista de vendas — o agente vê sua nova venda em
      // "Aguardando aprovação" e segue o dia. (Antes ia pro detalhe.)
      router.push("/vendas")
    })
  }

  function construirPayload() {
    const produtosPayload = produtos.map((p, i) => {
      // Extrai fornecedor: primeiro usa o seletor dedicado (junction table),
      // com fallback para campos dinâmicos de tipo 'fornecedor' (legado).
      const tp = props.tiposProduto.find((t) => t.id === p.tipo_produto_id)
      let fornecedor_id: string | null = null
      let fornecedor_nome = ""

      if (p.fornecedor_id && p.fornecedor_id !== "outro") {
        // Fornecedor selecionado via junction table
        fornecedor_id = p.fornecedor_id
        fornecedor_nome = props.fornecedores.find((f) => f.id === p.fornecedor_id)?.nome ?? ""
      } else if (p.fornecedor_id === "outro" && p.fornecedor_outro_nome.trim()) {
        // "Outro" — fornecedor não cadastrado
        fornecedor_id = null
        fornecedor_nome = p.fornecedor_outro_nome.trim()
      } else if (tp) {
        // Fallback legado: campo dinâmico de tipo 'fornecedor'
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
      data_emissao: p.data_emissao_str || null,
      data_inicio_viagem: p.data_inicio_viagem_str || null,
      data_fim_viagem: p.data_fim_viagem_str || null,
      valores_extras: p.valores_extras,
      valor_venda: parseValorComSoma(p.valor_venda_str),
      valor_custo: parseValorComSoma(p.valor_custo_str),
      rav: p.rav_str ? parseValorComSoma(p.rav_str) : null,
      rav_extra_cliente: parseValorComSoma(p.rav_extra_cliente_str) || 0,
      rav_extra_fornecedor: parseValorComSoma(p.rav_extra_fornecedor_str) || 0,
      comissao_vendedor: p.comissao_vendedor_str
        ? parseValorComSoma(p.comissao_vendedor_str)
        : null,
      pgto_modo: p.pgto_modo,
      pgto_forma: p.pgto_forma || null,
      pgto_cartao_id: p.pgto_cartao_id || null,
      pgto_valor_total: (() => {
        const userVal = parseValorComSoma(p.pgto_valor_total_str)
        if (userVal > 0) return userVal
        const custo = parseValorComSoma(p.valor_custo_str)
        return custo > 0 ? custo : null
      })(),
      // Só cartao_agencia controla parcelas/entrada — demais formas zeram.
      pgto_entrada: p.pgto_forma === "cartao_agencia" ? parseValorComSoma(p.pgto_entrada_str) || 0 : 0,
      pgto_num_parcelas: p.pgto_forma === "cartao_agencia" ? p.pgto_num_parcelas : 1,
      // valor_parcela = base de cada parcela "normal" (excluindo o extra da 1ª).
      // Modelo: base = (total - entrada - extra) / N. Primeira = base + extra.
      pgto_valor_parcela: p.pgto_forma !== "cartao_agencia" ? null : (() => {
        const userVal = parseValorComSoma(p.pgto_valor_total_str)
        const custo = parseValorComSoma(p.valor_custo_str)
        const total = userVal > 0 ? userVal : custo
        const entrada = parseValorComSoma(p.pgto_entrada_str) || 0
        const extra = parseValorComSoma(p.pgto_primeira_parcela_extra_str) || 0
        const n = p.pgto_num_parcelas || 1
        const v = (total - entrada - extra) / n
        return v > 0 ? v : null
      })(),
      pgto_primeira_parcela_extra:
        p.pgto_forma === "cartao_agencia"
          ? parseValorComSoma(p.pgto_primeira_parcela_extra_str) || 0
          : 0,
      pgto_data_debito:
        p.pgto_forma === "cartao_agencia" && p.pgto_data_entrada_str
          ? p.pgto_data_entrada_str
          : null,
      }
    })

    // "outro" e "link_externo" não têm parcelamento.
    // PIX, boleto, faturado e cartão podem ser parcelados.
    const semParcelas = (tipo: CobrancaTipo) =>
      tipo === "outro" || tipo === "link_externo"
    const itensCobranca = cobrancaItens.map((it) => {
      const isAvulso = semParcelas(it.tipo)
      const parcelasDet = isAvulso
        ? []
        : it.parcelas_detalhe.map((p, i) => ({
            ordem: i + 1,
            valor: parseValorComSoma(p.valor_str) || 0,
            data: p.data || null,
          }))
      // Compatibilidade: alguns consumidores legados (geração de contas a
      // receber, relatórios) usam `data_primeiro_recebimento` direto.
      // Pra parceladas, copia da primeira parcela; senão usa o campo legado.
      const dataPrimeiro =
        parcelasDet[0]?.data ?? it.data_primeiro_recebimento ?? null
      return {
        tipo: it.tipo,
        valor_total: parseValorComSoma(it.valor_total_str),
        num_parcelas: isAvulso ? 1 : it.num_parcelas,
        valor_parcela: isAvulso ? null : (() => {
          const total = parseValorComSoma(it.valor_total_str) || 0
          const n = it.num_parcelas || 1
          return total > 0 ? total / n : null
        })(),
        plataforma_link: it.plataforma_link || null,
        plataforma: it.plataforma || null,
        parcelas_detalhe: parcelasDet,
        taxa_adquirente: it.taxa_adquirente_str
          ? parseValorComSoma(it.taxa_adquirente_str)
          : null,
        valor_liquido: it.valor_liquido_str
          ? parseValorComSoma(it.valor_liquido_str)
          : null,
        data_inicio: it.data_inicio || null,
        data_primeiro_recebimento: dataPrimeiro || null,
        observacoes: it.tipo === "outro" ? it.outro_descricao || null : null,
        // Comprovante de pagamento (upload já feito; só persiste o path)
        comprovante_storage_path: it.comprovante_storage_path || null,
        comprovante_nome_arquivo: it.comprovante_nome_arquivo || null,
        comprovante_mime_type: it.comprovante_mime_type || null,
        comprovante_tamanho_bytes: it.comprovante_tamanho_bytes || null,
      }
    })

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
                telefone_ddi: clienteNovo.telefone_ddi,
                telefone: clienteNovo.telefone_ddi === "+55" ? onlyDigits(clienteNovo.telefone) : clienteNovo.telefone.trim(),
                cpf: onlyDigits(clienteNovo.cpf),
                data_nascimento: clienteNovo.data_nascimento || null,
                passaporte: clienteNovo.passaporte.trim() || null,
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
                telefone_ddi: clienteNovo.telefone_ddi,
                telefone: clienteNovo.telefone_ddi === "+55" ? onlyDigits(clienteNovo.telefone) : clienteNovo.telefone.trim(),
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
          passaporte: p.passaporte.trim() || null,
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
          todosCartaoCliente ? (
            // Cliente pagou direto com o próprio cartão → não há cobrança
            // a registrar. Step 3 vira informativo.
            <div className="rounded-xl border border-nexus-bright/20 bg-nexus-bright/[0.04] p-6">
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-nexus-bright" />
                <div className="space-y-1.5 text-sm leading-relaxed text-white/75">
                  <p className="font-medium text-white">
                    Cobrança dispensada — cartão do cliente
                  </p>
                  <p>
                    Todos os produtos desta venda foram registrados com forma de
                    pagamento <strong className="text-white">Cartão Cliente</strong>.
                    O fornecedor enviará o link de pagamento diretamente ao
                    cliente e a Magic recebe apenas a comissão.
                  </p>
                  <p className="text-white/55">
                    Nada precisa ser preenchido neste passo. Clique em{" "}
                    <strong className="text-white/85">Continuar</strong> para
                    seguir aos passageiros.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Step3Cobranca
              itens={cobrancaItens}
              setItens={setCobrancaItens}
              obs={cobrancaObs}
              setObs={setCobrancaObs}
              totalVenda={totalVenda}
              errors={errors}
              restritoCartaoCliente={false}
            />
          )
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
            clienteDataNascimento={
              clienteValue === "novo"
                ? clienteNovo.tipo_pessoa === "fisica" ? clienteNovo.data_nascimento : ""
                : (props.clientes.find((x) => x.id === clienteValue)?.data_nascimento ?? "")
            }
            clientePassaporte={
              clienteValue === "novo"
                ? clienteNovo.tipo_pessoa === "fisica" ? clienteNovo.passaporte : ""
                : (props.clientes.find((x) => x.id === clienteValue)?.passaporte ?? "")
            }
            errors={errors}
          />
        )}

        {step === 5 && (
          <Step5Anexos
            vendaId={props.vendaId ?? null}
            wizardSessionId={wizardSessionId}
            anexos={anexos}
            setAnexos={setAnexos}
            observacoes={observacoesGerais}
            setObservacoes={setObservacoesGerais}
            readOnly={false}
          />
        )}

        {step === 6 && (
          <Step6Revisao
            empresaNome={
              props.empresas.find((e) => e.id === empresaId)?.nome ?? "—"
            }
            dataVenda={dataVenda}
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
              const camposDoTipo = tp?.campos ?? []
              const camposExtras = camposDoTipo
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((tc) => {
                  const campo = props.camposExtra.find((c) => c.id === tc.campo_id)
                  return {
                    nome: campo?.nome ?? "—",
                    valor: p.valores_extras[tc.campo_id] ?? "",
                  }
                })
                .filter((c) => c.valor !== "")
              const fornecedorNome =
                p.fornecedor_id === "outro"
                  ? p.fornecedor_outro_nome
                  : props.fornecedores.find((f) => f.id === p.fornecedor_id)?.nome ?? ""
              const cartaoNome =
                p.pgto_forma === "cartao_agencia"
                  ? props.cartoes.find((c) => c.id === p.pgto_cartao_id)?.nome ?? null
                  : null
              return {
                tipoNome: tp?.nome ?? "—",
                icone: tp?.icone ?? null,
                fornecedorNome,
                dataEmissao: p.data_emissao_str || null,
                dataInicioViagem: p.data_inicio_viagem_str || null,
                dataFimViagem: p.data_fim_viagem_str || null,
                valorVenda: parseValorComSoma(p.valor_venda_str),
                valorCusto: parseValorComSoma(p.valor_custo_str),
                comissao: p.comissao_vendedor_str
                  ? parseValorComSoma(p.comissao_vendedor_str)
                  : 0,
                rav: p.rav_str ? parseValorComSoma(p.rav_str) : 0,
                ravExtraCliente: p.rav_extra_cliente_str
                  ? parseValorComSoma(p.rav_extra_cliente_str)
                  : 0,
                ravExtraFornecedor: p.rav_extra_fornecedor_str
                  ? parseValorComSoma(p.rav_extra_fornecedor_str)
                  : 0,
                camposExtras,
                pgtoForma: p.pgto_forma || null,
                pgtoCartaoNome: cartaoNome,
                pgtoValorTotal: parseValorComSoma(p.pgto_valor_total_str) || 0,
                pgtoEntrada: parseValorComSoma(p.pgto_entrada_str) || 0,
                pgtoNumParcelas: p.pgto_num_parcelas || 1,
                pgtoDataEntrada: p.pgto_data_entrada_str || null,
                pgtoPrimeiraParcelaExtra:
                  parseValorComSoma(p.pgto_primeira_parcela_extra_str) || 0,
              }
            })}
            cobranca={cobrancaItens.map((it) => ({
              tipo: COBRANCA_TIPO_LABEL[it.tipo],
              valor: parseValorComSoma(it.valor_total_str),
              parcelas: it.num_parcelas,
              link: it.tipo === "link_externo" ? it.plataforma_link.trim() : null,
              plataforma: it.plataforma || null,
              parcelasDetalhe:
                // Tipos avulsos (outro / link_externo) não têm parcelas.
                it.tipo !== "outro" &&
                it.tipo !== "link_externo" &&
                it.parcelas_detalhe.length > 0
                  ? it.parcelas_detalhe.map((p, j) => ({
                      ordem: p.ordem ?? j + 1,
                      valor: parseValorComSoma(p.valor_str) || 0,
                      data: p.data || null,
                    }))
                  : [],
              comprovante: it.comprovante_storage_path
                ? {
                    storagePath: it.comprovante_storage_path,
                    nomeArquivo: it.comprovante_nome_arquivo,
                    mimeType: it.comprovante_mime_type,
                  }
                : null,
            }))}
            passageiros={passageiros.map((p) => ({
              nome: p.nome,
              cpf: p.cpf,
              dataNascimento: p.data_nascimento,
              passaporte: p.passaporte,
              usandoDadosCliente: p.usandoDadosCliente ?? false,
            }))}
            // Revisão é sempre minimalista — sem painéis de "Comissão do
            // vendedor", "Lucro bruto" ou "Margem do vendedor". A comissão
            // do responsável aparece num único bloco compacto à direita.
            mostraComissao={false}
            comissaoPercentual={comissaoDoAgente}
            anexos={anexos}
          />
        )}
      </div>

      {/* Aviso de valor em aberto — sempre no passo 3 (vale também no modo
          restrito cartão cliente, onde Faturado/Link Externo precisam fechar
          o total da venda). */}
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
            <>
              <AutosaveIndicator status={autoStatus} lastSavedAt={lastSavedAt} />
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
            </>
          )}

          {step < 6 ? (
            props.modoGerente ? (
              // Gerente: todos os steps 1-5 têm "Salvar e Revisar" → vai direto ao step 6
              // Navegação entre 1-5 é feita clicando nas abas do cabeçalho
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
            // Step 6 · Gerente: aprovar diretamente
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
            // Step 6 · Agente editando em_revisao: resubmete
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
            // Step 6 · Agente criando nova venda
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
// Indicador visual do autosave (ao lado do botão "Salvar rascunho")
// ─────────────────────────────────────────────────────────────────────────────

function AutosaveIndicator({
  status,
  lastSavedAt,
}: {
  status: "idle" | "dirty" | "saving" | "saved" | "error"
  lastSavedAt: Date | null
}) {
  // Mantém o texto atualizando a cada 30s pra ir mostrando "há 1 minuto" etc.
  // Sem timer pesado: força rerender via setState(tick).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (status !== "saved") return
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [status])
  void tick

  if (status === "idle") return null

  const config = (() => {
    switch (status) {
      case "saving":
        return {
          label: "Salvando…",
          dotClass: "bg-nexus-bright animate-pulse",
          textClass: "text-nexus-bright/85",
        }
      case "saved":
        return {
          label: lastSavedAt
            ? `Salvo ${tempoRelativo(lastSavedAt)}`
            : "Salvo",
          dotClass: "bg-emerald-400",
          textClass: "text-emerald-300/85",
        }
      case "dirty":
        return {
          label: "Mudanças não salvas",
          dotClass: "bg-amber-400 animate-pulse",
          textClass: "text-amber-300/85",
        }
      case "error":
        return {
          label: "Erro ao salvar",
          dotClass: "bg-rose-500",
          textClass: "text-rose-300",
        }
    }
  })()

  return (
    <span
      className="flex items-center gap-1.5 text-[11px] font-medium"
      aria-live="polite"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dotClass}`} />
      <span className={config.textClass}>{config.label}</span>
    </span>
  )
}

function tempoRelativo(d: Date): string {
  const segs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (segs < 5) return "agora"
  if (segs < 60) return `há ${segs}s`
  const min = Math.floor(segs / 60)
  if (min < 60) return `há ${min}min`
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `às ${hh}:${mi}`
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
                    onBlur={(ev) =>
                      props.setClienteNovo((s) => ({
                        ...s,
                        nome: toTitleCase(ev.target.value),
                      }))
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

                <Field
                  label="Data de nascimento *"
                  error={e.novo_data_nascimento}
                >
                  <DateInput
                    value={props.clienteNovo.data_nascimento}
                    onChange={(iso) =>
                      props.setClienteNovo((s) => ({ ...s, data_nascimento: iso }))
                    }
                  />
                </Field>

                <Field label="Passaporte">
                  <Input
                    value={props.clienteNovo.passaporte}
                    onChange={(ev) =>
                      props.setClienteNovo((s) => ({
                        ...s,
                        passaporte: ev.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Ex: BR1234567"
                    maxLength={10}
                    className="uppercase tracking-wider"
                  />
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
                  props.setClienteNovo((s) => ({
                    ...s,
                    // E-mail sempre minúsculo e sem espaços.
                    email: ev.target.value.replace(/\s/g, "").toLowerCase(),
                  }))
                }
                className="lowercase"
              />
            </Field>
            <Field label="Telefone" error={e.novo_telefone}>
              <PhoneInput
                ddi={props.clienteNovo.telefone_ddi ?? "+55"}
                onDdiChange={(ddi) =>
                  props.setClienteNovo((s) => ({ ...s, telefone_ddi: ddi }))
                }
                value={props.clienteNovo.telefone}
                onChange={(val) =>
                  props.setClienteNovo((s) => ({ ...s, telefone: val }))
                }
              />
            </Field>
            {/* Tipo/Faturamento ficam fora do cadastro ad-hoc: clientes faturados
                têm contrato e ciclo, devem ser pré-cadastrados pelo admin via
                /clientes. Aqui o novo cliente sempre nasce como `regular`. */}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Origem do lead *" error={props.errors.origem}>
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

      {/* Observações gerais foram movidas pro Step 5 (Anexos) em junho/2026 —
          ficam junto dos anexos como informação de suporte da venda. */}
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

  /** Recalcula o string de comissão do vendedor com base no RAV TOTAL
   *  (rav base + rav extra cliente + rav extra fornecedor), multiplicado
   *  pelo % do agente. Todas as superfícies (lista, dashboards, PDF, resumo)
   *  usam essa mesma base. Retorna "" quando não há % definido (regra
   *  sobrescrita pelo Admin no aprovo). */
  function recomputarComissao(
    ravStr: string,
    ravExtraClienteStr: string,
    ravExtraFornecedorStr: string,
  ): string {
    if (props.comissaoPercentual == null) return ""
    const rav = parseValorComSoma(ravStr)
    const ravExtraCliente = parseValorComSoma(ravExtraClienteStr)
    const ravExtraFornecedor = parseValorComSoma(ravExtraFornecedorStr)
    const base =
      (Number.isFinite(rav) ? rav : 0) +
      (Number.isFinite(ravExtraCliente) ? ravExtraCliente : 0) +
      (Number.isFinite(ravExtraFornecedor) ? ravExtraFornecedor : 0)
    if (base <= 0) return ""
    const comissao = (base * props.comissaoPercentual) / 100
    return comissao.toFixed(2).replace(".", ",")
  }

  /** Quando venda ou custo mudam, recalcula RAV = venda - custo automaticamente.
   *  Se o agente tem percentual de comissão definido, auto-preenche
   *  "Comissão vendedor" = (RAV + RAV Extra Cliente) × %. */
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
      // Pagamento ao fornecedor = custo (modo comissionado fixo)
      const pgtoTotal = custo
      const pgtoTotalStr = pgtoTotal > 0
        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pgtoTotal)
        : ""
      // Auto-calcular comissão usando RAV total = base + extra cliente +
      // extra fornecedor.
      const comissaoStr = props.comissaoPercentual != null
        ? recomputarComissao(
            ravStr,
            prev.rav_extra_cliente_str,
            prev.rav_extra_fornecedor_str,
          )
        : prev.comissao_vendedor_str
      return { [key]: value, rav_str: ravStr, pgto_valor_total_str: pgtoTotalStr, comissao_vendedor_str: comissaoStr }
    })
  }

  /** Quando o usuário preenche RAV manualmente, calcula
   *  `valor_custo = valor_venda - rav` automaticamente — mantendo
   *  venda − custo = rav. Valor de venda nunca é preenchido pelo sistema. */
  function patchRav(id: string, raw: string) {
    const value = filtrarValor(raw)
    patch(id, (prev) => {
      const venda = parseValorComSoma(prev.valor_venda_str)
      const rav = parseValorComSoma(value)
      // Só recalcula custo se venda > 0 e RAV foi preenchido.
      // Se RAV foi limpo, mantém o custo intacto.
      const custoNovoStr =
        venda > 0 && value.trim() !== ""
          ? Math.max(0, venda - rav).toFixed(2).replace(".", ",")
          : prev.valor_custo_str
      const custoNovo = parseValorComSoma(custoNovoStr)
      const pgtoTotalStr = custoNovo > 0
        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(custoNovo)
        : ""
      const comissaoStr = recomputarComissao(
        value,
        prev.rav_extra_cliente_str,
        prev.rav_extra_fornecedor_str,
      )
      return {
        rav_str: value,
        valor_custo_str: custoNovoStr,
        pgto_valor_total_str: pgtoTotalStr,
        comissao_vendedor_str: comissaoStr,
      }
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
            p.pgto_forma === "cartao_agencia" && cartaoNome
              ? `Cartão Agência (${cartaoNome})`
              : PGTO_FORMA_LABEL[p.pgto_forma as PgtoForma]
          summaryParts.push(formaLabel)
        }
        if (p.pgto_forma === "cartao_agencia" && p.pgto_num_parcelas > 0) {
          const userTotal = parseValorComSoma(p.pgto_valor_total_str)
          const custo = parseValorComSoma(p.valor_custo_str)
          const pgtoTotal = userTotal > 0 ? userTotal : custo
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

            {/* ══════════════════════════════════════════════════════════
                SEÇÃO 1: TIPO + DETALHES DO PRODUTO
                Card com borda azul Nexus leve. Tipo está dentro porque é
                ele quem define quais campos aparecem aqui.
                ══════════════════════════════════════════════════════════ */}
            <div className="rounded-lg border border-nexus-bright/15 bg-nexus-bright/[0.025] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md border border-nexus-bright/30 bg-nexus-bright/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-nexus-bright">
                  Produto
                </span>
                <p className="text-[11px] uppercase tracking-wider text-white/55">
                  {tp ? `Detalhes — ${tp.nome}` : "Selecione o tipo para ver os detalhes"}
                </p>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <Field
                  label="Tipo de produto *"
                  error={props.errors[`produto_${i}_tipo`]}
                  className="col-span-12 sm:col-span-4"
                >
                  <Select
                    value={p.tipo_produto_id || undefined}
                    onValueChange={(v) =>
                      patch(p.id, () => ({
                        tipo_produto_id: v,
                        valores_extras: {},
                        fornecedor_id: "",
                        fornecedor_outro_nome: "",
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

              {camposDoTipo.map(({ vinculo, campo }) => {
                if (!campo) return null
                const val = p.valores_extras[campo.id] ?? ""
                const err = props.errors[`produto_${i}_extra_${campo.id}`]

                // Largura semântica por tipo de campo
                //   numero / sim_nao  → 2/12 (compactos — stepper / Select)
                //   valor             → 3/12 (campo monetário — R$ + número)
                //   data              → 3/12 (largura tipo DD/MM/AAAA)
                //   texto_curto       → 2/12 (códigos, IDs, localizadores)
                //   texto (longo)     → 6/12 (descrições, observações)
                //   dropdown / fornecedor → 4/12
                const colSpan =
                  campo.tipo_campo === "numero" || campo.tipo_campo === "sim_nao"
                    ? "col-span-6 sm:col-span-2"
                    : campo.tipo_campo === "valor" || campo.tipo_campo === "data"
                      ? "col-span-6 sm:col-span-3"
                      : campo.tipo_campo === "texto_curto"
                        ? "col-span-6 sm:col-span-2"
                        : campo.tipo_campo === "texto"
                          ? "col-span-12 sm:col-span-6"
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
                          {/* Ordenamos alfabeticamente (pt-BR) no render —
                              a ordem cadastrada no admin não vale aqui,
                              o operador procura a opção pelo nome. */}
                          {campo.opcoes
                            .slice()
                            .sort((a, b) =>
                              a.valor.localeCompare(b.valor, "pt-BR", {
                                sensitivity: "base",
                              }),
                            )
                            .map((o) => (
                              <SelectItem key={o.valor} value={o.valor}>
                                {o.valor}
                              </SelectItem>
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
                      (() => {
                        // Stepper compacto centralizado: −  N  +
                        // Inteiro ≥ 0; persistido como string pra compat.
                        const n = Math.max(0, parseInt(String(val), 10) || 0)
                        const setN = (next: number) => {
                          patch(p.id, (prev) => ({
                            valores_extras: {
                              ...prev.valores_extras,
                              [campo.id]: String(Math.max(0, next)),
                            },
                          }))
                        }
                        return (
                          // Visual consistente com o <Input> padrão do
                          // shadcn (border-input + bg-background). Botões
                          // − e + ficam INTERNOS ao container, dividindo
                          // o input com bordas finas do mesmo tom.
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
                              value={val || "0"}
                              onChange={(ev) => {
                                const v = ev.target.value.replace(/[^\d]/g, "")
                                patch(p.id, (prev) => ({
                                  valores_extras: {
                                    ...prev.valores_extras,
                                    [campo.id]: v,
                                  },
                                }))
                              }}
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
                      })()
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
                    ) : campo.tipo_campo === "valor" ? (
                      <div className="flex h-10 items-stretch overflow-hidden rounded-md border border-input bg-background">
                        <span className="flex items-center border-r border-input px-2.5 text-xs text-white/45 select-none">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={val}
                          onChange={(ev) =>
                            patch(p.id, (prev) => ({
                              valores_extras: { ...prev.valores_extras, [campo.id]: ev.target.value },
                            }))
                          }
                          onBlur={() => {
                            const n = parseValorComSoma(val)
                            if (n > 0) {
                              patch(p.id, (prev) => ({
                                valores_extras: {
                                  ...prev.valores_extras,
                                  [campo.id]: formatBRL(n),
                                },
                              }))
                            }
                          }}
                          onFocus={(ev) => ev.target.select()}
                          placeholder={campo.placeholder ?? "0,00"}
                          className="min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums text-white outline-none placeholder:text-white/30"
                        />
                      </div>
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
            </div>

            {/* ══════════════════════════════════════════════════════════
                SEÇÃO 2: IDENTIFICAÇÃO — fornecedor + datas (campos fixos)
                ══════════════════════════════════════════════════════════ */}
            <div className="mt-5">
              <p className="mb-2.5 text-[11px] uppercase tracking-wider text-white/40">
                Identificação
              </p>
              <div className="grid grid-cols-12 gap-3">
                {/* Linha 1: Fornecedor | Início da viagem | Fim da viagem */}
                {(() => {
                  const fornecedoresDoTipo = tp
                    ? props.fornecedores.filter((f) => f.tipos_produto_ids.includes(tp.id))
                    : []
                  const semTipo = !tp
                  return (
                    <Field
                      label="Fornecedor *"
                      className="col-span-12 sm:col-span-4"
                      error={props.errors[`produto_${i}_fornecedor`]}
                    >
                      <Select
                        value={p.fornecedor_id || undefined}
                        onValueChange={(v) =>
                          patch(p.id, () => ({ fornecedor_id: v, fornecedor_outro_nome: "" }))
                        }
                        disabled={semTipo}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={semTipo ? "Selecione o tipo do produto" : "Selecione"} />
                        </SelectTrigger>
                        <SelectContent>
                          {fornecedoresDoTipo.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                          <SelectItem value="outro">Outro…</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )
                })()}

                <Field
                  label="Início da viagem *"
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  className="col-span-12 sm:col-span-4"
                  error={props.errors[`produto_${i}_data_inicio_viagem`]}
                >
                  <DateInput
                    value={p.data_inicio_viagem_str}
                    onChange={(iso) =>
                      patch(p.id, (prev) => ({
                        data_inicio_viagem_str: iso,
                        // Se o novo início ficou após o fim atual, limpa o fim
                        // pra forçar o usuário a reescolher uma data válida.
                        data_fim_viagem_str:
                          iso && prev.data_fim_viagem_str && prev.data_fim_viagem_str < iso
                            ? ""
                            : prev.data_fim_viagem_str,
                      }))
                    }
                  />
                </Field>

                <Field
                  label="Fim da viagem"
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  className="col-span-12 sm:col-span-4"
                  error={props.errors[`produto_${i}_data_fim_viagem`]}
                >
                  <DateInput
                    value={p.data_fim_viagem_str}
                    min={p.data_inicio_viagem_str || undefined}
                    onChange={(iso) =>
                      patch(p.id, () => ({ data_fim_viagem_str: iso }))
                    }
                  />
                </Field>

                {p.fornecedor_id === "outro" && (
                  <Field
                    label="Nome do fornecedor *"
                    className="col-span-12 sm:col-span-4"
                    error={props.errors[`produto_${i}_fornecedor_outro`]}
                  >
                    <Input
                      value={p.fornecedor_outro_nome}
                      onChange={(e) =>
                        patch(p.id, () => ({
                          fornecedor_outro_nome: e.target.value,
                        }))
                      }
                      placeholder="Ex: Latam Travel"
                    />
                  </Field>
                )}

                {/* Linha 2: Data de emissão */}
                <Field
                  label="Data de emissão *"
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  className="col-span-12 sm:col-span-4"
                  error={props.errors[`produto_${i}_data_emissao`]}
                >
                  <DateInput
                    value={p.data_emissao_str}
                    onChange={(iso) =>
                      patch(p.id, () => ({ data_emissao_str: iso }))
                    }
                  />
                </Field>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SEÇÃO 3: VALORES FINANCEIROS
                ══════════════════════════════════════════════════════════ */}
            <div className="mt-5">
              <p className="mb-2.5 text-[11px] uppercase tracking-wider text-white/40">
                Valores
              </p>
              {/* Linha 1: Venda (37,5%) + Custo (37,5%) + RAV (25%)
                  Linha 2: RAV Extra Cliente (50%) + RAV Extra Fornecedor (50%) */}
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  {/* Subgrade Venda+Custo ocupa 9/12 (= 75%) e divide igual.
                      Em mobile, cada um vira linha cheia. */}
                  <div className="col-span-12 grid grid-cols-2 gap-3 sm:col-span-9">
                    <Field
                      label="Valor de venda"
                      error={props.errors[`produto_${i}_valor_venda`]}
                    >
                      <CurrencyInput
                        value={p.valor_venda_str}
                        onChange={(v) => patchValor(p.id, "valor_venda_str", v)}
                      />
                    </Field>

                    <Field
                      label="Valor de custo"
                      error={props.errors[`produto_${i}_valor_custo`]}
                    >
                      <CurrencyInput
                        value={p.valor_custo_str}
                        onChange={(v) => patchValor(p.id, "valor_custo_str", v)}
                      />
                    </Field>
                  </div>

                  {/* RAV — auto-calculado em venda/custo, mas editável (o
                      vendedor pode sobrescrever pra refletir "depends" manuais). */}
                  <Field
                    label="RAV"
                    className="col-span-12 sm:col-span-3"
                  >
                    <CurrencyInput
                      value={p.rav_str}
                      onChange={(v) => patchRav(p.id, v)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  {/* RAV Extra Cliente — taxa adicional cobrada do cliente.
                      Entra na base de comissão do agente. */}
                  <Field
                    label="RAV extra (cliente)"
                    className="col-span-12 sm:col-span-6"
                  >
                    <CurrencyInput
                      value={p.rav_extra_cliente_str}
                      onChange={(v) =>
                        patch(p.id, (prev) => ({
                          rav_extra_cliente_str: v,
                          comissao_vendedor_str: recomputarComissao(
                            prev.rav_str,
                            v,
                            prev.rav_extra_fornecedor_str,
                          ),
                        }))
                      }
                    />
                  </Field>

                  <Field
                    label="RAV extra (fornecedor)"
                    className="col-span-12 sm:col-span-6"
                  >
                    <CurrencyInput
                      value={p.rav_extra_fornecedor_str}
                      onChange={(v) =>
                        patch(p.id, (prev) => ({
                          rav_extra_fornecedor_str: v,
                          // RAV extra fornecedor agora entra na base de
                          // comissão — recalcula sempre que muda.
                          comissao_vendedor_str: recomputarComissao(
                            prev.rav_str,
                            prev.rav_extra_cliente_str,
                            v,
                          ),
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* ── Pagamento ao fornecedor ──────────────────────────────── */}
            <div className="mt-5">
              <p className="mb-2.5 text-[11px] uppercase tracking-wider text-white/40">
                Pagamento ao fornecedor
              </p>
              <div className="grid grid-cols-12 gap-3">
                {/* Forma de pagamento — define o que mais aparece nesta seção */}
                <Field
                  label="Forma de pagamento"
                  error={props.errors[`produto_${i}_pgto_forma`]}
                  className="col-span-12 sm:col-span-4"
                >
                  <Select
                    value={p.pgto_forma || undefined}
                    onValueChange={(v) =>
                      patch(p.id, (prev) => {
                        const nova = v as PgtoForma
                        // Limpa campos que não fazem sentido nas formas onde
                        // a Magic não controla o fluxo (faturado, cartao_cliente)
                        if (nova === "cartao_cliente" || nova === "faturado") {
                          return {
                            pgto_forma: nova,
                            pgto_cartao_id: "",
                            pgto_valor_total_str: "",
                            pgto_entrada_str: "",
                            pgto_num_parcelas: 1,
                          }
                        }
                        // Cartão agência: auto-preenche Valor Total com o custo.
                        // Só preenche se o campo ainda estiver vazio pra não
                        // sobrescrever um valor que o usuário possa ter digitado.
                        const custo = parseValorComSoma(prev.valor_custo_str)
                        const totalCalc = custo
                        const totalAtual = parseValorComSoma(prev.pgto_valor_total_str)
                        const novoTotalStr =
                          totalAtual > 0
                            ? prev.pgto_valor_total_str
                            : totalCalc > 0
                              ? new Intl.NumberFormat("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(totalCalc)
                              : ""
                        return {
                          pgto_forma: nova,
                          pgto_valor_total_str: novoTotalStr,
                        }
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="faturado">{PGTO_FORMA_LABEL["faturado"]}</SelectItem>
                      <SelectItem value="cartao_agencia">{PGTO_FORMA_LABEL["cartao_agencia"]}</SelectItem>
                      <SelectItem value="cartao_cliente">{PGTO_FORMA_LABEL["cartao_cliente"]}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {/* ── FATURADO ─ Sistema só registra a forma ──────────── */}
                {p.pgto_forma === "faturado" && (
                  <div className="col-span-12 sm:col-span-8 flex items-center">
                    <div className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs leading-relaxed text-white/55">
                      Fornecedor desconta das comissões com a Magic; se faltar
                      saldo, gera fatura direta. O contas a pagar deste fluxo é
                      tratado fora do sistema nesta fase.
                    </div>
                  </div>
                )}

                {/* ── CARTÃO CLIENTE ─ Cliente paga direto ao fornecedor ── */}
                {p.pgto_forma === "cartao_cliente" && (
                  <div className="col-span-12 sm:col-span-8 flex items-center">
                    <div className="w-full rounded-md border border-nexus-bright/20 bg-nexus-bright/[0.05] px-3 py-2.5 text-xs leading-relaxed text-white/70">
                      O fornecedor enviará um link de pagamento direto ao cliente.
                      A Magic recebe apenas a comissão — nada precisa ser
                      registrado em Cobrança no passo 3.
                    </div>
                  </div>
                )}

                {/* ── CARTÃO AGÊNCIA ─ Magic paga, controla parcelas ──── */}
                {p.pgto_forma === "cartao_agencia" && (
                  <>
                    {/* Linha 1 — Cartão (com busca) + Valor total + Data entrada */}
                    <Field
                      label="Cartão da agência"
                      className="col-span-12 sm:col-span-5"
                    >
                      <CartaoCombobox
                        cartoes={props.cartoes}
                        value={p.pgto_cartao_id || null}
                        onChange={(id) =>
                          patch(p.id, () => ({ pgto_cartao_id: id ?? "" }))
                        }
                      />
                    </Field>

                    <Field
                      label="Valor total"
                      hint="Valor de custo"
                      className="col-span-6 sm:col-span-4"
                    >
                      <CurrencyInput
                        value={p.pgto_valor_total_str}
                        onChange={(v) => patch(p.id, () => ({ pgto_valor_total_str: v }))}
                      />
                    </Field>

                    {/* Data da primeira cobrança no cartão (data de débito).
                        Persiste em pgto_data_debito. Útil pra projetar
                        fluxo de caixa das parcelas. */}
                    <Field
                      label="Data de entrada"
                      icon={<CalendarDays className="h-3.5 w-3.5" />}
                      className="col-span-6 sm:col-span-3"
                    >
                      <DateInput
                        value={p.pgto_data_entrada_str}
                        onChange={(iso) =>
                          patch(p.id, () => ({ pgto_data_entrada_str: iso }))
                        }
                      />
                    </Field>

                    {/* Linha 2 — Entrada + Parcelas + Extra primeira parcela */}
                    <Field label="Entrada" className="col-span-12 sm:col-span-4">
                      <CurrencyInput
                        value={p.pgto_entrada_str}
                        onChange={(v) => patch(p.id, () => ({ pgto_entrada_str: v }))}
                      />
                    </Field>

                    <div className="col-span-6 sm:col-span-3">
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

                    {/* Valor extra na primeira parcela (taxas etc.) —
                        comum em viagens onde a primeira fatura já vem com
                        IOF / taxa de serviço / seguro. */}
                    <Field
                      label="Extra na 1ª parcela"
                      hint="Taxas etc."
                      className="col-span-6 sm:col-span-5"
                    >
                      <CurrencyInput
                        value={p.pgto_primeira_parcela_extra_str}
                        onChange={(v) =>
                          patch(p.id, () => ({ pgto_primeira_parcela_extra_str: v }))
                        }
                      />
                    </Field>

                    {/* Linha 3 — Breakdown completo das parcelas */}
                    <div className="col-span-12">
                      {(() => {
                        const userTotal = parseValorComSoma(p.pgto_valor_total_str)
                        const total = userTotal > 0
                          ? userTotal
                          : parseValorComSoma(p.valor_custo_str)
                        const entrada = parseValorComSoma(p.pgto_entrada_str) || 0
                        const extra = parseValorComSoma(p.pgto_primeira_parcela_extra_str) || 0
                        const n = p.pgto_num_parcelas || 1
                        // Modelo: cada parcela recebe base + extra na primeira.
                        // base = (total − entrada − extra) / n
                        // p1 = base + extra; p2..pN = base
                        const base = (total - entrada - extra) / n
                        const p1 = base + extra
                        const semExtra = extra <= 0
                        return (
                          <>
                            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/55">
                              Valor das parcelas
                            </Label>
                            {base > 0 ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-md border border-nexus-bright/20 bg-nexus-bright/[0.05] px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-wider text-nexus-bright/70">
                                    1ª parcela
                                  </p>
                                  <p className="text-sm font-semibold tabular-nums text-white">
                                    {formatBRL(p1)}
                                  </p>
                                  {!semExtra && (
                                    <p className="text-[10px] text-white/45">
                                      {formatBRL(base)} + {formatBRL(extra)} (taxas)
                                    </p>
                                  )}
                                </div>
                                <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-wider text-white/45">
                                    {n > 1 ? `Demais (${n - 1}x)` : "Detalhes"}
                                  </p>
                                  <p className="text-sm font-semibold tabular-nums text-white/85">
                                    {n > 1 ? formatBRL(base) : <span className="text-white/25">—</span>}
                                  </p>
                                  <p className="text-[10px] text-white/35">
                                    base = (total − entrada − extra) ÷ parcelas
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-10 items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white/25">
                                Preencha valor total para ver as parcelas
                              </div>
                            )}
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
  /** Quando true (todos os produtos têm pgto_forma = cartao_cliente),
   *  o Select de Forma de pagamento fica restrito a "Faturado" e
   *  "Link externo". No link externo, o campo de URL fica expandido. */
  restritoCartaoCliente?: boolean
}) {
  function adicionar() {
    props.setItens((s) => [
      ...s,
      props.restritoCartaoCliente
        ? { ...novoItemCobranca(), tipo: "link_externo" }
        : novoItemCobranca(),
    ])
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

      {props.itens.map((it, i) => {
        // Tipos sem parcelamento: pagamento avulso ou pago em um único momento
        // pelo cliente fora do nosso controle (link_externo).
        const semParcelas = it.tipo === "outro" || it.tipo === "link_externo"
        const valorItem = parseValorComSoma(it.valor_total_str) || 0
        const valorOutrosItens = props.itens.reduce(
          (acc, x, j) =>
            j === i ? acc : acc + (parseValorComSoma(x.valor_total_str) || 0),
          0,
        )
        const restante = props.totalVenda - valorOutrosItens - valorItem
        const restanteAbs = props.totalVenda - valorOutrosItens
        // Sempre mostra o atalho "Preencher com restante" — quando não há
        // restante (ou esta cobrança já cobre tudo), fica desabilitado pra
        // dar feedback de que o saldo está zerado.
        const podePreencherRestante =
          restanteAbs > 0 && Math.abs(restante) >= 0.01
        const totalCoberto =
          props.totalVenda > 0 && Math.abs(restanteAbs) < 0.01

        function setTipo(novoTipo: CobrancaTipo) {
          const reseta: Partial<CobrancaItemState> =
            novoTipo === "outro" || novoTipo === "link_externo"
              ? { num_parcelas: 1, parcelas_detalhe: [] }
              : {}
          // Saindo de `link_externo`: limpa o comprovante anexado.
          // Mantém os bytes no bucket por simplicidade (sem garbage collect).
          if (it.tipo === "link_externo" && novoTipo !== "link_externo") {
            reseta.comprovante_storage_path = ""
            reseta.comprovante_nome_arquivo = ""
            reseta.comprovante_mime_type = ""
            reseta.comprovante_tamanho_bytes = 0
          }
          patch(i, { tipo: novoTipo, ...reseta })
        }

        function setNumParcelas(novo: number) {
          // Ao adicionar/remover parcela, REDISTRIBUI o valor total
          // igualmente entre todas as parcelas. Datas existentes são
          // preservadas (o operador pode ter planejado as datas mesmo
          // antes de saber o número final de parcelas).
          const total = parseValorComSoma(it.valor_total_str) || 0
          const base = total / Math.max(1, novo)
          const novas: ParcelaDetalhe[] = Array.from({ length: novo }).map((_, j) => ({
            ordem: j + 1,
            valor_str: base > 0 ? formatBRL(base) : "",
            data: it.parcelas_detalhe[j]?.data ?? "",
          }))
          patch(i, { num_parcelas: novo, parcelas_detalhe: novas })
        }

        function setValorTotal(v: string) {
          // Sempre que o valor total mudar, refaz a distribuição mantendo as
          // datas. Operador pode customizar valores depois.
          const next: Partial<CobrancaItemState> = { valor_total_str: v }
          if (!semParcelas) {
            const total = parseValorComSoma(v) || 0
            const n = Math.max(1, it.num_parcelas)
            const base = total / n
            next.parcelas_detalhe = Array.from({ length: n }).map(
              (_, j) => ({
                ordem: j + 1,
                valor_str: base > 0 ? formatBRL(base) : "",
                data: it.parcelas_detalhe[j]?.data ?? "",
              }),
            )
          }
          patch(i, next)
        }

        function patchParcela(idx: number, dados: Partial<ParcelaDetalhe>) {
          // Auto-fill mensal: quando a parcela 1 recebe uma data PELA
          // PRIMEIRA VEZ (antes vazia, agora preenchida), propagamos a
          // mesma data nas parcelas seguintes adicionando um mês por
          // parcela. Em alterações subsequentes da parcela 1 NÃO propaga
          // — assumimos que o operador já ajustou as demais e quer apenas
          // mudar a primeira. O operador pode editar qualquer parcela
          // manualmente a qualquer momento.
          const isFirstFillParcela1 =
            idx === 0 &&
            typeof dados.data === "string" &&
            dados.data !== "" &&
            !it.parcelas_detalhe[0]?.data

          if (isFirstFillParcela1 && dados.data) {
            const partes = dados.data.split("-").map(Number)
            const [ano, mes, dia] = partes
            if (ano && mes && dia) {
              patch(i, {
                parcelas_detalhe: it.parcelas_detalhe.map((p, j) => {
                  if (j === 0) return { ...p, ...dados }
                  // Soma `j` meses preservando o mesmo dia. Se o mês
                  // alvo não tem o dia (ex: 31 jan + 1 mês = fev), usa
                  // o último dia válido daquele mês.
                  const mesAlvo = mes + j // 1-indexed
                  const anoAlvo = ano + Math.floor((mesAlvo - 1) / 12)
                  const mesNormalizado = ((mesAlvo - 1) % 12) + 1
                  const ultimoDiaMes = new Date(
                    anoAlvo,
                    mesNormalizado,
                    0,
                  ).getDate()
                  const diaFinal = Math.min(dia, ultimoDiaMes)
                  const iso = `${anoAlvo}-${String(mesNormalizado).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`
                  return { ...p, data: iso }
                }),
              })
              return
            }
          }

          patch(i, {
            parcelas_detalhe: it.parcelas_detalhe.map((p, j) =>
              j === idx ? { ...p, ...dados } : p,
            ),
          })
        }

        function preencherRestante() {
          if (restanteAbs <= 0) return
          setValorTotal(formatBRL(restanteAbs))
        }

        return (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Cobrança {i + 1}</p>
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

            {/* Grid 12-col pra ter granularidade fina. Padrão: cada Field
                ocupa 3/12 (1/4), então 4 campos cabem numa linha. Em mobile
                cada campo ocupa 12/12 (linha cheia). */}
            <div className="grid gap-3 sm:grid-cols-12">
              <Field
                label="Forma de pagamento"
                className="col-span-12 sm:col-span-3"
              >
                <Select
                  value={it.tipo}
                  onValueChange={(v) => setTipo(v as CobrancaTipo)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {props.restritoCartaoCliente ? (
                      <>
                        <SelectItem value="faturado">
                          {COBRANCA_TIPO_LABEL["faturado"]}
                        </SelectItem>
                        <SelectItem value="link_externo">
                          {COBRANCA_TIPO_LABEL["link_externo"]}
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="pix">{COBRANCA_TIPO_LABEL["pix"]}</SelectItem>
                        <SelectItem value="boleto">{COBRANCA_TIPO_LABEL["boleto"]}</SelectItem>
                        <SelectItem value="cartao_credito">
                          {COBRANCA_TIPO_LABEL["cartao_credito"]}
                        </SelectItem>
                        <SelectItem value="faturado">
                          {COBRANCA_TIPO_LABEL["faturado"]}
                        </SelectItem>
                        <SelectItem value="link_externo">
                          {COBRANCA_TIPO_LABEL["link_externo"]}
                        </SelectItem>
                        <SelectItem value="outro">{COBRANCA_TIPO_LABEL["outro"]}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </Field>

              {it.tipo === "outro" && (
                <Field
                  label="Forma de pagamento (Outro)"
                  error={props.errors[`cobranca_${i}_outro_descricao`]}
                  className="col-span-12 sm:col-span-3"
                >
                  <Input
                    value={it.outro_descricao}
                    onChange={(ev) => patch(i, { outro_descricao: ev.target.value })}
                    placeholder="Ex: Cheque, Permuta…"
                  />
                </Field>
              )}

              {/* Valor + atalho "Preencher com restante" embaixo, só aparece
                  quando há diferença a preencher. Mantém a linha enxuta e a
                  ação fica explícita sem disputar espaço com o input. */}
              <Field
                label="Valor"
                error={props.errors[`cobranca_${i}_valor`]}
                className="col-span-12 sm:col-span-3"
              >
                <CurrencyInput
                  value={it.valor_total_str}
                  onChange={setValorTotal}
                />
                {/* Sempre mostra o atalho quando há um total da venda definido.
                    Desabilita visualmente quando já não há restante a cobrir
                    (totalCoberto) ou quando esta cobrança já cobre o saldo. */}
                {props.totalVenda > 0 && (
                  <button
                    type="button"
                    onClick={preencherRestante}
                    disabled={!podePreencherRestante}
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium transition-colors",
                      podePreencherRestante
                        ? "text-nexus-bright hover:text-nexus-bright-soft hover:underline"
                        : "cursor-not-allowed text-white/35",
                    )}
                  >
                    <Plus className="h-3 w-3" />
                    {totalCoberto
                      ? "Valor total já coberto"
                      : podePreencherRestante
                        ? `Preencher com restante (${formatBRL(restanteAbs)})`
                        : "Sem restante a preencher"}
                  </button>
                )}
              </Field>

              {!semParcelas && (
                <Field
                  label="Parcelas"
                  className="col-span-12 sm:col-span-2"
                >
                  <div className="flex h-10 items-center overflow-hidden rounded-md border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setNumParcelas(Math.max(1, it.num_parcelas - 1))}
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
                      onClick={() => setNumParcelas(Math.min(360, it.num_parcelas + 1))}
                      disabled={it.num_parcelas >= 360}
                      className="flex h-full w-9 shrink-0 items-center justify-center border-l border-white/[0.08] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                      aria-label="Aumentar parcelas"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Field>
              )}

              {/* Plataforma — Select restrito a PagSeguro / Cielo.
                  Em `link_externo` é OBRIGATÓRIA (identifica gateway que
                  gerou o link). Nos demais tipos é opcional.
                  Tamanho dinâmico: 4/12 quando há "Parcelas" (3+3+2+4=12) e
                  3/12 quando não há (3+3+3=9 — sobra espaço pro link). */}
              <Field
                label={
                  it.tipo === "link_externo" ? "Plataforma *" : "Plataforma"
                }
                error={props.errors[`cobranca_${i}_plataforma`]}
                className={cn(
                  "col-span-12",
                  semParcelas ? "sm:col-span-3" : "sm:col-span-4",
                )}
              >
                <Select
                  value={it.plataforma || "_nenhuma"}
                  onValueChange={(v) =>
                    patch(i, {
                      plataforma:
                        v === "_nenhuma"
                          ? ""
                          : (v as "PagSeguro" | "Cielo"),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* "Nenhuma" só aparece pra tipos onde a plataforma é
                        opcional — em link_externo o operador é forçado a
                        escolher PagSeguro ou Cielo. */}
                    {it.tipo !== "link_externo" && (
                      <SelectItem value="_nenhuma">Nenhuma</SelectItem>
                    )}
                    <SelectItem value="PagSeguro">PagSeguro</SelectItem>
                    <SelectItem value="Cielo">Cielo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

            </div>

            {/* ── Parcelas detalhadas ─────────────────────────────────────
                Sempre que o tipo aceita parcelas (exclui outro/link_externo),
                mostramos o detalhamento — mesmo com 1 parcela. Isso padroniza
                o layout: data e valor sempre aparecem juntos por parcela. */}
            {!semParcelas && (
              <div className="mt-4 space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-white/55">
                    Detalhamento {it.num_parcelas > 1 ? "das parcelas" : "da parcela"}
                  </p>
                  {it.num_parcelas > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        patch(i, { parcelas_detalhe: redistribuirParcelas(it) })
                      }
                      className="text-[11px] text-nexus-bright/80 hover:text-nexus-bright"
                    >
                      Redistribuir valores
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {(it.parcelas_detalhe.length === it.num_parcelas
                    ? it.parcelas_detalhe
                    : redistribuirParcelas(it)
                  ).map((parc, j) => {
                    const errValor =
                      props.errors[`cobranca_${i}_parcela_${j}_valor`]
                    const errData =
                      props.errors[`cobranca_${i}_parcela_${j}_data`]
                    const temErro = !!(errValor || errData)
                    return (
                      <div
                        key={j}
                        className={cn(
                          "grid grid-cols-12 items-center gap-2 rounded-md border px-3 py-2 transition-colors",
                          temErro
                            ? "border-destructive/40 bg-destructive/[0.04]"
                            : "border-white/[0.04] bg-white/[0.02]",
                        )}
                      >
                        <div className="col-span-2 text-[11px] uppercase tracking-wider text-white/45">
                          Parcela {parc.ordem}
                        </div>
                        <div className="col-span-5">
                          <CurrencyInput
                            value={parc.valor_str}
                            onChange={(v) => patchParcela(j, { valor_str: v })}
                          />
                          {errValor && (
                            <p className="mt-1 text-[10px] text-destructive">
                              {errValor}
                            </p>
                          )}
                        </div>
                        <div className="col-span-5">
                          <DateInput
                            value={parc.data}
                            onChange={(iso) => patchParcela(j, { data: iso })}
                          />
                          {errData && (
                            <p className="mt-1 text-[10px] text-destructive">
                              {errData}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {(() => {
                  // Usa o mesmo fallback do render: se o state ainda não tem
                  // o array completo (ex: acabou de selecionar o tipo e
                  // parcelas_detalhe está vazio), usa o auto-fill pra calcular
                  // a soma — assim o aviso fica coerente com o que o usuário
                  // está vendo na tela.
                  const parcelasEfetivas =
                    it.parcelas_detalhe.length === it.num_parcelas
                      ? it.parcelas_detalhe
                      : redistribuirParcelas(it)
                  const somaParcelas = parcelasEfetivas.reduce(
                    (acc, p) => acc + (parseValorComSoma(p.valor_str) || 0),
                    0,
                  )
                  const diff = somaParcelas - valorItem
                  if (Math.abs(diff) < 0.01) return null
                  return (
                    <p className="text-[11px] text-amber-300/80">
                      Soma das parcelas: {formatBRL(somaParcelas)} ·{" "}
                      {diff > 0 ? "+" : "−"}
                      {formatBRL(Math.abs(diff))} em relação ao valor total
                    </p>
                  )
                })()}
              </div>
            )}

            {/* ── Comprovante de pagamento ──────────────────────────────
                Só pra `link_externo` (PagSeguro/Cielo). Demais formas
                (PIX, boleto, cartão, faturado, outro) não exigem
                comprovante — operadores conferem por outros meios. */}
            {it.tipo === "link_externo" && (
              <div className="mt-4">
                <ComprovanteCobrancaUpload
                  storagePath={it.comprovante_storage_path}
                  nomeArquivo={it.comprovante_nome_arquivo}
                  mimeType={it.comprovante_mime_type}
                  tamanhoBytes={it.comprovante_tamanho_bytes}
                  onChange={(next) =>
                    patch(i, {
                      comprovante_storage_path: next.storagePath,
                      comprovante_nome_arquivo: next.nomeArquivo,
                      comprovante_mime_type: next.mimeType,
                      comprovante_tamanho_bytes: next.tamanhoBytes,
                    })
                  }
                  error={props.errors[`cobranca_${i}_comprovante`]}
                />
              </div>
            )}
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
  clienteDataNascimento: string
  clientePassaporte: string
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
      // Desmarca qualquer outro passageiro que estivesse usando; aplica
      // nome + CPF + data de nascimento + passaporte do cliente.
      props.setPassageiros((s) =>
        s.map((px) =>
          px.id === id
            ? {
                ...px,
                usandoDadosCliente: true,
                nome: props.clienteNome,
                cpf: props.clienteCpf,
                data_nascimento: props.clienteDataNascimento,
                passaporte: props.clientePassaporte,
              }
            : { ...px, usandoDadosCliente: false },
        ),
      )
    } else {
      patch(id, {
        usandoDadosCliente: false,
        nome: "",
        cpf: "",
        data_nascimento: "",
        passaporte: "",
      })
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
                  <label
                    className={cn(
                      "flex select-none items-center gap-1.5 text-xs",
                      outroUsando
                        ? "cursor-not-allowed text-white/25"
                        : "cursor-pointer text-white/55 hover:text-white/80",
                    )}
                  >
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
            {/* Grid 12-col, tudo numa linha:
                  Nome (6) + CPF (2) + Data nasc (2) + Passaporte (2) */}
            <div className="grid gap-3 sm:grid-cols-12">
              <Field
                label="Nome"
                error={props.errors[`passageiro_${i}_nome`]}
                className="sm:col-span-6"
              >
                <Input
                  value={p.nome}
                  onChange={(ev) => patch(p.id, { nome: ev.target.value })}
                  onBlur={(ev) => patch(p.id, { nome: toTitleCase(ev.target.value) })}
                  disabled={usandoDados}
                />
              </Field>
              <Field
                label="CPF"
                error={props.errors[`passageiro_${i}_cpf`]}
                className="sm:col-span-2"
              >
                <Input
                  value={formatCpf(p.cpf)}
                  onChange={(ev) => patch(p.id, { cpf: ev.target.value })}
                  maxLength={14}
                  placeholder="000.000.000-00"
                  disabled={usandoDados}
                />
              </Field>
              <Field label="Nascimento" className="sm:col-span-2">
                <DateInput
                  value={p.data_nascimento}
                  onChange={(iso) => patch(p.id, { data_nascimento: iso })}
                  disabled={usandoDados}
                />
              </Field>
              <Field label="Passaporte" className="sm:col-span-2">
                <Input
                  value={p.passaporte}
                  onChange={(ev) =>
                    patch(p.id, { passaporte: ev.target.value.toUpperCase() })
                  }
                  placeholder="BR1234567"
                  maxLength={10}
                  disabled={usandoDados}
                  className="uppercase tracking-wider"
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

/** Tabela de produtos expansível — clique na linha para ver os campos extras. */
function ProdutosRevisao(props: {
  produtos: {
    tipoNome: string
    icone: string | null
    fornecedorNome: string
    dataEmissao: string | null
    dataInicioViagem: string | null
    dataFimViagem: string | null
    valorVenda: number
    valorCusto: number
    comissao: number
    rav: number
    ravExtraCliente: number
    ravExtraFornecedor: number
    camposExtras: { nome: string; valor: string }[]
    pgtoForma: string | null
    pgtoCartaoNome: string | null
    pgtoValorTotal: number
    pgtoEntrada: number
    pgtoNumParcelas: number
    pgtoDataEntrada: string | null
    pgtoPrimeiraParcelaExtra: number
  }[]
  totalVenda: number
  totalCusto: number
  totalRav: number
  totalComissao: number
  mostraComissao: boolean
}) {
  // Por padrão todos os acordeões ficam fechados — o operador abre se quiser
  // ver os campos personalizados. Otimiza o espaço da tela na revisão.
  const [abertos, setAbertos] = useState<Record<number, boolean>>({})

  function toggle(i: number) {
    setAbertos((prev) => ({ ...prev, [i]: !prev[i] }))
  }

  const colCount = 6 + (props.mostraComissao ? 1 : 0)

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
            <th className="w-8 px-2 py-2"></th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Emissão</th>
            <th className="px-3 py-2 text-right">Venda</th>
            <th className="px-3 py-2 text-right">Custo</th>
            <th className="px-3 py-2 text-right">RAV</th>
            {props.mostraComissao && (
              <th className="px-3 py-2 text-right">Comissão</th>
            )}
          </tr>
        </thead>
        <tbody>
          {props.produtos.map((p, i) => {
            const aberto = abertos[i] ?? false
            const temDetalhes =
              p.camposExtras.length > 0 ||
              p.ravExtraCliente > 0 ||
              p.ravExtraFornecedor > 0 ||
              !!p.fornecedorNome ||
              !!p.dataInicioViagem ||
              !!p.dataFimViagem ||
              !!p.pgtoForma
            return (
              <Fragment key={i}>
                <tr
                  className={
                    "border-b border-white/[0.04] last:border-0 " +
                    (temDetalhes ? "cursor-pointer hover:bg-white/[0.025]" : "")
                  }
                  onClick={temDetalhes ? () => toggle(i) : undefined}
                >
                  <td className="px-2 py-2 text-white/40">
                    {temDetalhes ? (
                      <ChevronDown
                        className={
                          "h-3.5 w-3.5 transition-transform " +
                          (aberto ? "rotate-0" : "-rotate-90")
                        }
                      />
                    ) : null}
                  </td>
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
                  <td className="px-3 py-2 text-white/65 tabular-nums">
                    {p.dataEmissao ? formatDateBR(p.dataEmissao) : "—"}
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
                {temDetalhes && aberto && (
                  <tr className="border-b border-white/[0.04] bg-white/[0.015]">
                    <td colSpan={colCount} className="px-3 py-2.5">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 pl-6 sm:grid-cols-2">
                        {p.fornecedorNome && (
                          <div className="flex items-baseline gap-2 text-[12px]">
                            <span className="text-white/40">Fornecedor:</span>
                            <span className="text-white/85">{p.fornecedorNome}</span>
                          </div>
                        )}
                        {(p.dataInicioViagem || p.dataFimViagem) && (
                          <div className="flex items-baseline gap-2 text-[12px]">
                            <span className="text-white/40">Viagem:</span>
                            <span className="tabular-nums text-white/85">
                              {p.dataInicioViagem ? formatDateBR(p.dataInicioViagem) : "—"}
                              {p.dataFimViagem ? ` – ${formatDateBR(p.dataFimViagem)}` : ""}
                            </span>
                          </div>
                        )}
                        {p.camposExtras.map((c, j) => (
                          <div
                            key={j}
                            className="flex items-baseline gap-2 text-[12px]"
                          >
                            <span className="text-white/40">{c.nome}:</span>
                            <span className="text-white/85">{c.valor}</span>
                          </div>
                        ))}
                        {p.ravExtraCliente > 0 && (
                          <div className="flex items-baseline gap-2 text-[12px]">
                            <span className="text-white/40">
                              RAV extra cliente:
                            </span>
                            <span className="tabular-nums text-nexus-bright">
                              {formatBRL(p.ravExtraCliente)}
                            </span>
                          </div>
                        )}
                        {p.ravExtraFornecedor > 0 && (
                          <div className="flex items-baseline gap-2 text-[12px]">
                            <span className="text-white/40">
                              RAV extra fornecedor:
                            </span>
                            <span className="tabular-nums text-nexus-bright">
                              {formatBRL(p.ravExtraFornecedor)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ── Pagamento ao fornecedor ──────────────────── */}
                      {p.pgtoForma && (
                        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-white/[0.04] pl-6 pt-2 sm:grid-cols-2">
                          <div className="flex items-baseline gap-2 text-[12px]">
                            <span className="text-white/40">Forma de pgto:</span>
                            <span className="text-white/85">
                              {p.pgtoForma === "cartao_agencia" && p.pgtoCartaoNome
                                ? `Cartão Agência — ${p.pgtoCartaoNome}`
                                : PGTO_FORMA_LABEL[p.pgtoForma as PgtoForma] ?? p.pgtoForma}
                            </span>
                          </div>
                          {p.pgtoForma === "cartao_agencia" && p.pgtoDataEntrada && (
                            <div className="flex items-baseline gap-2 text-[12px]">
                              <span className="text-white/40">Data de entrada:</span>
                              <span className="tabular-nums text-white/85">
                                {formatDateBR(p.pgtoDataEntrada)}
                              </span>
                            </div>
                          )}
                          {p.pgtoForma === "cartao_agencia" && p.pgtoEntrada > 0 && (
                            <div className="flex items-baseline gap-2 text-[12px]">
                              <span className="text-white/40">Entrada:</span>
                              <span className="tabular-nums text-white/85">
                                {formatBRL(p.pgtoEntrada)}
                              </span>
                            </div>
                          )}
                          {p.pgtoForma === "cartao_agencia" && p.pgtoNumParcelas > 1 && (() => {
                            const totalPgto =
                              p.pgtoValorTotal > 0 ? p.pgtoValorTotal : p.valorCusto
                            const extra = p.pgtoPrimeiraParcelaExtra || 0
                            const base =
                              (totalPgto - p.pgtoEntrada - extra) / p.pgtoNumParcelas
                            const p1 = base + extra
                            return (
                              <>
                                <div className="flex items-baseline gap-2 text-[12px]">
                                  <span className="text-white/40">Parcelas:</span>
                                  <span className="tabular-nums text-white/85">
                                    {p.pgtoNumParcelas}x{" "}
                                    {extra > 0 ? (
                                      <>
                                        — 1ª: {formatBRL(p1)} · demais:{" "}
                                        {formatBRL(base)}
                                      </>
                                    ) : (
                                      <>de {formatBRL(base)}</>
                                    )}
                                  </span>
                                </div>
                                {extra > 0 && (
                                  <div className="flex items-baseline gap-2 text-[12px]">
                                    <span className="text-white/40">
                                      Taxa na 1ª parcela:
                                    </span>
                                    <span className="tabular-nums text-nexus-bright">
                                      {formatBRL(extra)}
                                    </span>
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          <tr className="bg-white/[0.03] font-medium">
            <td className="px-2 py-2"></td>
            <td className="px-3 py-2 text-white/55">Total</td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-right tabular-nums text-white">
              {formatBRL(props.totalVenda)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-white/65">
              {formatBRL(props.totalCusto)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-white/85">
              {formatBRL(props.totalRav)}
            </td>
            {props.mostraComissao && (
              <td className="px-3 py-2 text-right tabular-nums text-amber-300">
                {formatBRL(props.totalComissao)}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Step6Revisao(props: {
  empresaNome: string
  dataVenda: string
  cliente: string
  clienteNovoFlag: boolean
  pax: number
  agenteNome: string
  origem: string
  produtos: {
    tipoNome: string
    icone: string | null
    fornecedorNome: string
    dataEmissao: string | null
    dataInicioViagem: string | null
    dataFimViagem: string | null
    valorVenda: number
    valorCusto: number
    comissao: number
    rav: number
    ravExtraCliente: number
    ravExtraFornecedor: number
    camposExtras: { nome: string; valor: string }[]
    pgtoForma: string | null
    pgtoCartaoNome: string | null
    pgtoValorTotal: number
    pgtoEntrada: number
    pgtoNumParcelas: number
    pgtoDataEntrada: string | null
    pgtoPrimeiraParcelaExtra: number
  }[]
  cobranca: {
    tipo: string
    valor: number
    parcelas: number
    /** Quando preenchido, mostra link clicável abaixo do item.
     *  Hoje só é usado pelo tipo `link_externo` (PagSeguro/Cielo). */
    link?: string | null
    /** Plataforma da cobrança (PagSeguro / Cielo / null). */
    plataforma?: string | null
    /** Distribuição planejada das parcelas. Vazio = à vista ou auto-divide. */
    parcelasDetalhe?: { ordem: number; valor: number; data: string | null }[]
    /** Comprovante de pagamento — quando null, mostra "Comprovante pendente". */
    comprovante?: {
      storagePath: string
      nomeArquivo: string
      mimeType: string
    } | null
  }[]
  passageiros: {
    nome: string
    cpf: string
    dataNascimento: string
    passaporte: string
    usandoDadosCliente: boolean
  }[]
  /** Quando true (Admin/Gerente), exibe coluna/linha de comissão na revisão.
   *  Agentes não veem — comissão é calculada por regra administrativa no aprovo. */
  mostraComissao: boolean
  /** Percentual de comissão do agente (calculado pela regra de origem/perfil). */
  comissaoPercentual: number | null
  /** Lista de anexos (carregada do server) — exibida em bloco próprio
   *  abaixo de Passageiros. Vazio = bloco oculto. */
  anexos: AnexoVenda[]
}) {
  const totalVenda = props.produtos.reduce((a, p) => a + p.valorVenda, 0)
  const totalCusto = props.produtos.reduce((a, p) => a + p.valorCusto, 0)
  // Comissão recalculada AQUI = RAV total × % do agente. Vendas antigas
  // gravadas com base diferente (sem rav_extra_fornecedor) também exibem
  // o valor correto pela regra atual.
  // RAV total = RAV base (venda - custo) + RAV Extra Cliente + RAV Extra Fornecedor
  const totalRavBase = props.produtos.reduce((a, p) => a + p.rav, 0)
  const totalRavExtraCliente = props.produtos.reduce(
    (a, p) => a + p.ravExtraCliente,
    0,
  )
  const totalRavExtraFornecedor = props.produtos.reduce(
    (a, p) => a + p.ravExtraFornecedor,
    0,
  )
  const totalRav = totalRavBase + totalRavExtraCliente + totalRavExtraFornecedor
  const totalComissao =
    props.comissaoPercentual != null
      ? (totalRav * props.comissaoPercentual) / 100
      : 0
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
          </div>
        </Bloco>

        <Bloco titulo={`Produtos (${props.produtos.length})`}>
          <ProdutosRevisao
            produtos={props.produtos}
            totalVenda={totalVenda}
            totalCusto={totalCusto}
            totalRav={totalRav}
            totalComissao={totalComissao}
            mostraComissao={props.mostraComissao}
          />
        </Bloco>

        <Bloco titulo="Cobrança do cliente">
          <ul className="space-y-2.5 text-sm">
            {props.cobranca.map((c, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white/75">
                    {c.tipo}
                    {c.parcelas > 1 && (
                      <span className="ml-2 text-xs text-white/45">
                        {c.parcelas}x
                      </span>
                    )}
                    {c.plataforma && (
                      <span className="ml-2 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/55">
                        {c.plataforma}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-white">
                    {formatBRL(c.valor)}
                  </span>
                </div>
                {c.link && (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 break-all text-[11px] text-nexus-bright hover:text-nexus-bright-soft hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.link}</span>
                  </a>
                )}
                {c.parcelasDetalhe && c.parcelasDetalhe.length > 0 && (
                  <ul className="mt-1 space-y-0.5 border-l border-white/[0.05] pl-3">
                    {c.parcelasDetalhe.map((p) => (
                      <li
                        key={p.ordem}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <span className="text-white/45">
                          Parcela {p.ordem}
                          {p.data && (
                            <span className="ml-2 tabular-nums text-white/55">
                              {formatDateBR(p.data)}
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-white/65">
                          {formatBRL(p.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Comprovante de pagamento — botão abre em nova aba */}
                {c.comprovante && (
                  <RevisaoComprovanteLink
                    storagePath={c.comprovante.storagePath}
                    nomeArquivo={c.comprovante.nomeArquivo}
                    mimeType={c.comprovante.mimeType}
                  />
                )}
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
          <ul className="space-y-2">
            {props.passageiros.map((p, i) => (
              <li
                key={i}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-medium text-white/60">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-white/90">
                      {p.nome || "—"}
                    </span>
                    {p.usandoDadosCliente && (
                      <span className="rounded-full border border-nexus-bright/30 bg-nexus-bright/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-nexus-bright">
                        cliente
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-x-4 gap-y-0.5 pl-8 text-[12px] text-white/55">
                  <span>
                    <span className="text-white/35">CPF:</span>{" "}
                    {p.cpf || "—"}
                  </span>
                  <span>
                    <span className="text-white/35">Nascimento:</span>{" "}
                    {p.dataNascimento ? formatDateBR(p.dataNascimento) : "—"}
                  </span>
                  <span>
                    <span className="text-white/35">Passaporte:</span>{" "}
                    {p.passaporte || "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Bloco>

        {props.anexos.length > 0 && (
          <Bloco titulo={`Anexos (${props.anexos.length})`}>
            <AnexosRevisao anexos={props.anexos} />
          </Bloco>
        )}
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
              <span className="text-white/55">RAV total</span>
              <span className="tabular-nums text-white/85">
                {formatBRL(totalRav) || "—"}
              </span>
            </div>
            {/* Breakdown do RAV — só aparece se algum extra (cliente ou
                fornecedor) tiver valor. Inclui as 3 linhas: RAV, RAV extra
                cliente e RAV extra fornecedor, mostrando só as > 0. */}
            {(totalRavExtraCliente > 0 || totalRavExtraFornecedor > 0) && (
              <div className="space-y-1 border-l border-white/[0.05] pl-3">
                {totalRavBase > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">RAV</span>
                    <span className="tabular-nums text-white/55">
                      {formatBRL(totalRavBase)}
                    </span>
                  </div>
                )}
                {totalRavExtraCliente > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">RAV extra cliente</span>
                    <span className="tabular-nums text-white/55">
                      {formatBRL(totalRavExtraCliente)}
                    </span>
                  </div>
                )}
                {totalRavExtraFornecedor > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">RAV extra fornecedor</span>
                    <span className="tabular-nums text-white/55">
                      {formatBRL(totalRavExtraFornecedor)}
                    </span>
                  </div>
                )}
              </div>
            )}
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

        {/* ── Comissão do responsável ─────────────────────────── */}
        {props.comissaoPercentual != null && (
          <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Comissão do responsável
            </p>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
              <p className="mb-0.5 text-[11px] text-white/45">Valor calculado</p>
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

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Anexos (até 10 arquivos, 10 MB cada, imagens ou PDF)
// ─────────────────────────────────────────────────────────────────────────────

function Step5Anexos(props: {
  vendaId: string | null
  wizardSessionId: string
  anexos: AnexoVenda[]
  setAnexos: React.Dispatch<React.SetStateAction<AnexoVenda[]>>
  /** Observações gerais — movidas do Step 1 pra cá em junho/2026. */
  observacoes: string
  setObservacoes: (v: string) => void
  readOnly?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string[]>([])

  const limiteAtingido = props.anexos.length >= MAX_ANEXOS_POR_VENDA
  const acceptedTypes = MIMES_ACEITOS.join(",")

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (props.anexos.length + files.length > MAX_ANEXOS_POR_VENDA) {
      toast.error(`Máximo de ${MAX_ANEXOS_POR_VENDA} anexos por venda.`)
      e.target.value = ""
      return
    }
    for (const file of files) {
      if (file.size > MAX_ANEXO_BYTES) {
        toast.error(`"${file.name}" excede 10 MB.`)
        continue
      }
      if (!(MIMES_ACEITOS as readonly string[]).includes(file.type)) {
        toast.error(`"${file.name}" não é PDF nem imagem.`)
        continue
      }
      const tempKey = `${file.name}-${file.size}`
      setUploading((s) => [...s, tempKey])
      try {
        const fd = new FormData()
        fd.set("file", file)
        if (props.vendaId) fd.set("vendaId", props.vendaId)
        else fd.set("wizardSessionId", props.wizardSessionId)
        const r = await uploadAnexo(fd)
        if (!r.ok) {
          toast.error(r.error ?? "Falha no upload.")
        } else if (r.data) {
          props.setAnexos((s) => [...s, r.data!])
        }
      } finally {
        setUploading((s) => s.filter((k) => k !== tempKey))
      }
    }
    e.target.value = ""
  }

  async function onRemove(anexoId: string) {
    const r = await excluirAnexo(anexoId)
    if (!r.ok) {
      toast.error(r.error ?? "Falha ao remover anexo.")
      return
    }
    props.setAnexos((s) => s.filter((a) => a.id !== anexoId))
  }

  async function onAbrir(anexoId: string) {
    const r = await obterUrlAnexo(anexoId)
    if (!r.ok) {
      toast.error(r.error ?? "Não foi possível abrir o arquivo.")
      return
    }
    if (!r.data) return
    window.open(r.data.url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Anexos da venda</p>
            <p className="mt-0.5 text-xs text-white/55">
              Comprovantes, vouchers, prints de reserva. Até{" "}
              {MAX_ANEXOS_POR_VENDA} arquivos, 10 MB cada (PDF ou imagem).
            </p>
          </div>
          <div className="text-xs text-white/45 tabular-nums">
            {props.anexos.length} / {MAX_ANEXOS_POR_VENDA}
          </div>
        </div>

        {!props.readOnly && (
          <div className="mt-4">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={acceptedTypes}
              onChange={onPick}
              className="hidden"
              disabled={limiteAtingido}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={limiteAtingido || uploading.length > 0}
              className="border-nexus-bright/30 bg-nexus-bright/[0.05] text-nexus-bright hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
            >
              <Paperclip className="mr-2 h-4 w-4" />
              {limiteAtingido ? "Limite atingido" : "Selecionar arquivos"}
            </Button>
            {uploading.length > 0 && (
              <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-white/55">
                <Spinner className="h-3 w-3" />
                Enviando {uploading.length}…
              </span>
            )}
          </div>
        )}
      </div>

      {props.anexos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] py-10 text-center text-sm text-white/45">
          Nenhum anexo enviado ainda.
          {!props.readOnly && " Use o botão acima pra adicionar."}
        </div>
      ) : (
        <ul className="space-y-2">
          {props.anexos.map((a) => (
            <AnexoCard
              key={a.id}
              anexo={a}
              onAbrir={() => onAbrir(a.id)}
              onRemover={props.readOnly ? undefined : () => onRemove(a.id)}
            />
          ))}
        </ul>
      )}

      {/* Observações gerais — campo livre pra notas internas sobre a venda.
          Movido do Step 1 (Identificação) pra cá em junho/2026 — faz mais
          sentido junto dos anexos como "informações de suporte" da venda. */}
      <div className="border-t border-white/[0.06] pt-5">
        <Field label="Observações gerais (opcional)">
          <Textarea
            value={props.observacoes}
            onChange={(ev) => props.setObservacoes(ev.target.value)}
            rows={3}
            placeholder="Notas internas sobre a venda…"
            disabled={props.readOnly}
          />
        </Field>
      </div>
    </div>
  )
}

function AnexoCard({
  anexo,
  onAbrir,
  onRemover,
}: {
  anexo: AnexoVenda
  onAbrir: () => void
  onRemover?: () => void
}) {
  const isPdf = anexo.mimeType === "application/pdf"
  const tamanhoMB = (anexo.tamanhoBytes / (1024 * 1024)).toFixed(2)

  return (
    <li className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div
        className={
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border " +
          (isPdf
            ? "border-rose-400/30 bg-rose-400/[0.08] text-rose-300"
            : "border-nexus-bright/30 bg-nexus-bright/[0.08] text-nexus-bright")
        }
      >
        <Paperclip className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onAbrir}
          className="block w-full truncate text-left text-sm font-medium text-white hover:text-nexus-bright"
          title={anexo.nomeArquivo}
        >
          {anexo.nomeArquivo}
        </button>
        <p className="mt-0.5 text-[11px] text-white/45">
          {isPdf ? "PDF" : "Imagem"} · {tamanhoMB} MB
        </p>
      </div>
      <button
        type="button"
        onClick={onAbrir}
        title="Abrir em nova aba"
        aria-label="Abrir em nova aba"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
      >
        <ExternalLink className="h-4 w-4" />
      </button>
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          title="Remover anexo"
          aria-label="Remover anexo"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-rose-500/25 bg-rose-500/[0.08] text-rose-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/15"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloco de anexos na revisão (Step 6) — somente leitura
// ─────────────────────────────────────────────────────────────────────────────

function AnexosRevisao({ anexos }: { anexos: AnexoVenda[] }) {
  async function onAbrir(anexoId: string) {
    const r = await obterUrlAnexo(anexoId)
    if (!r.ok) {
      toast.error(r.error ?? "Não foi possível abrir o arquivo.")
      return
    }
    if (!r.data) return
    window.open(r.data.url, "_blank", "noopener,noreferrer")
  }

  return (
    <ul className="space-y-2">
      {anexos.map((a) => (
        <AnexoCard key={a.id} anexo={a} onAbrir={() => onAbrir(a.id)} />
      ))}
    </ul>
  )
}
