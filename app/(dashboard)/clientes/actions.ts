"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { clienteBaseSchema, type ClienteFormValues } from "@/lib/schemas/cliente"
import { onlyDigits } from "@/lib/utils/formatters"

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

/**
 * Cria um novo cliente.
 * Valida zod + checa duplicidade de CPF/email por empresa + audit log.
 */
export async function createCliente(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "criar")) {
    return { ok: false, error: "Você não tem permissão para criar clientes." }
  }

  const parsed = clienteBaseSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos do formulário.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const values = parsed.data
  const supabase = await createClient()
  const payload = montarPayloadCliente(values)

  // Dedup explícito (além do UNIQUE constraint) — pra UX melhor que erro 23505
  const dup = await checkDuplicateDocOrEmail(
    values.empresa_id,
    payload.cpf,
    payload.cnpj,
    values.email,
  )
  if (dup) {
    return { ok: false, error: dup.message, fieldErrors: dup.fieldErrors }
  }

  const { data: novo, error } = await supabase
    .from("clientes")
    .insert({ empresa_id: values.empresa_id, ...payload })
    .select("id")
    .single()

  if (error || !novo) {
    return { ok: false, error: error?.message ?? "Falha ao salvar cliente." }
  }

  await logAudit(user.id, values.empresa_id, "criar", novo.id, null, values)

  revalidatePath("/clientes")
  return { ok: true, data: { id: novo.id } }
}

/**
 * Atualiza um cliente existente.
 */
export async function updateCliente(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "editar")) {
    return { ok: false, error: "Você não tem permissão para editar clientes." }
  }

  const parsed = clienteBaseSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos do formulário.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const values = parsed.data
  const supabase = await createClient()

  // Snapshot antes pra audit_logs
  const { data: antes } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Cliente não encontrado." }

  const payload = montarPayloadCliente(values)

  // Dedup ignorando o próprio id
  const dup = await checkDuplicateDocOrEmail(
    values.empresa_id,
    payload.cpf,
    payload.cnpj,
    values.email,
    id,
  )
  if (dup) {
    return { ok: false, error: dup.message, fieldErrors: dup.fieldErrors }
  }

  const { error } = await supabase
    .from("clientes")
    .update(payload)
    .eq("id", id)

  if (error) return { ok: false, error: error.message }

  await logAudit(user.id, antes.empresa_id, "editar", id, antes, values)

  revalidatePath("/clientes")
  revalidatePath(`/clientes/${id}`)
  return { ok: true }
}

/**
 * Alterna status do cliente entre `ativo` e `inativo`. Não toca em `lead`
 * (lead vira ativo só pela 1ª venda fechada — fluxo separado).
 */
export async function toggleClienteAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }
  const supabase = await createClient()
  const { data: antes } = await supabase
    .from("clientes")
    .select("status, empresa_id")
    .eq("id", id)
    .single()
  if (!antes) return { ok: false, error: "Cliente não encontrado." }

  const novoStatus = ativo ? "ativo" : "inativo"
  const { error } = await supabase
    .from("clientes")
    .update({ status: novoStatus })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  await supabase.from("audit_logs").insert({
    usuario_id: user.id,
    empresa_id: antes.empresa_id,
    acao: ativo ? "ativar" : "inativar",
    entidade: "cliente",
    entidade_id: id,
    dados_antes: { status: antes.status },
    dados_depois: { status: novoStatus },
  })

  revalidatePath("/clientes")
  return { ok: true }
}

/**
 * Exclui um cliente (apenas Administrador).
 * Só permite se o cliente não tem vendas vinculadas.
 */
export async function deleteCliente(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "excluir")) {
    return { ok: false, error: "Apenas o Administrador pode excluir clientes." }
  }

  const supabase = await createClient()

  // Bloqueia se tem vendas (mesmo canceladas — preserva integridade histórica)
  const { count } = await supabase
    .from("vendas")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", id)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Este cliente possui vendas registradas e não pode ser excluído. Inative-o em vez disso.",
    }
  }

  const { data: antes } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Cliente não encontrado." }

  const { error } = await supabase.from("clientes").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  await logAudit(user.id, antes.empresa_id, "excluir", id, antes, null)

  revalidatePath("/clientes")
  redirect("/clientes")
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview de cliente (visualização agregada)
// ─────────────────────────────────────────────────────────────────────────────

export type ClienteOverview = {
  cliente: {
    id: string
    nome: string | null
    cpf: string | null
    data_nascimento: string | null
    passaporte: string | null
    tipo_pessoa: string
    razao_social: string | null
    nome_fantasia: string | null
    cnpj: string | null
    responsavel: string | null
    email: string
    telefone_ddi: string | null
    telefone: string
    endereco: Record<string, unknown> | null
    status: string
    tipo: string
    observacoes: string | null
    created_at: string
    empresa_nome: string | null
  }
  vendas: Array<{
    id: string
    status: string
    data_venda: string
    data_aprovacao: string | null
    pax: number
    receita: number
  }>
}

/**
 * Carrega cliente + lista de vendas (com totais somados a partir de
 * venda_produtos). Usado pelo modal de visualização de cliente.
 */
export async function getClienteOverview(
  id: string,
): Promise<ActionResult<ClienteOverview>> {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "ler")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()

  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select(
      "id, nome, cpf, data_nascimento, passaporte, tipo_pessoa, razao_social, nome_fantasia, cnpj, responsavel, email, telefone_ddi, telefone, endereco, status, tipo, observacoes, created_at, empresa:empresa_id(nome)",
    )
    .eq("id", id)
    .single()

  if (cErr || !cliente) {
    return { ok: false, error: "Cliente não encontrado." }
  }

  const { data: vendasRaw } = await supabase
    .from("vendas")
    .select("id, status, data_venda, data_aprovacao, pax")
    .eq("cliente_id", id)
    .order("data_venda", { ascending: false })

  const vendas = vendasRaw ?? []
  const vendaIds = vendas.map((v) => v.id)

  // Soma valor_venda por venda
  const { data: produtos } =
    vendaIds.length === 0
      ? { data: [] }
      : await supabase
          .from("venda_produtos")
          .select("venda_id, valor_venda")
          .in("venda_id", vendaIds)

  const receitaPorVenda = new Map<string, number>()
  for (const p of produtos ?? []) {
    receitaPorVenda.set(
      p.venda_id,
      (receitaPorVenda.get(p.venda_id) ?? 0) + Number(p.valor_venda ?? 0),
    )
  }

  const empresa = cliente.empresa as { nome: string } | null

  return {
    ok: true,
    data: {
      cliente: {
        ...cliente,
        endereco: cliente.endereco as Record<string, unknown> | null,
        empresa_nome: empresa?.nome ?? null,
      },
      vendas: vendas.map((v) => ({
        id: v.id,
        status: v.status,
        data_venda: v.data_venda,
        data_aprovacao: v.data_aprovacao,
        pax: v.pax,
        receita: receitaPorVenda.get(v.id) ?? 0,
      })),
    },
  }
}

/**
 * Procura cliente por CPF dentro de uma empresa.
 * Usado pelo formulário para alertar duplicidade on-blur.
 */
export async function lookupClientePorCpf(
  empresaId: string,
  cpf: string,
): Promise<{ id: string; nome: string } | null> {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "ler")) return null

  const cpfLimpo = onlyDigits(cpf)
  if (cpfLimpo.length !== 11) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .eq("cpf", cpfLimpo)
    .maybeSingle()

  return data ?? null
}

/**
 * Procura cliente por CNPJ dentro de uma empresa.
 * Usado pelo formulário para alertar duplicidade on-blur.
 */
export async function lookupClientePorCnpj(
  empresaId: string,
  cnpj: string,
): Promise<{ id: string; nome: string } | null> {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "ler")) return null

  const cnpjLimpo = onlyDigits(cnpj)
  if (cnpjLimpo.length !== 14) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .eq("cnpj", cnpjLimpo)
    .maybeSingle()

  return data ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapeia ClienteFormValues → row pronto pra insert/update no banco.
 * Garante que CPF/CNPJ ficam mutuamente exclusivos e que `nome` (NOT NULL)
 * recebe um valor sensato pra PJ (fantasia → razão social).
 */
function montarPayloadCliente(values: ClienteFormValues) {
  const isPJ = values.tipo_pessoa === "juridica"
  const cpf = isPJ ? null : onlyDigits(values.cpf ?? "")
  const cnpj = isPJ ? onlyDigits(values.cnpj ?? "") : null
  const nome = isPJ
    ? (values.nome_fantasia?.trim() || values.razao_social?.trim() || "")
    : (values.nome?.trim() ?? "")

  return {
    tipo_pessoa: values.tipo_pessoa,
    nome,
    razao_social: isPJ ? values.razao_social?.trim() || null : null,
    nome_fantasia: isPJ ? values.nome_fantasia?.trim() || null : null,
    responsavel: isPJ ? values.responsavel?.trim() || null : null,
    cpf,
    cnpj,
    data_nascimento: isPJ ? null : values.data_nascimento || null,
    passaporte: isPJ ? null : values.passaporte?.trim() || null,
    email: values.email,
    telefone_ddi: values.telefone_ddi ?? "+55",
    telefone: values.telefone,
    endereco: sanitizeEndereco(values.endereco),
    origem: values.origem || null,
    tipo: values.tipo,
    dia_faturamento:
      values.tipo === "faturado" ? (values.dia_faturamento as number) : null,
    status: values.status,
    observacoes: values.observacoes || null,
  }
}

async function checkDuplicateDocOrEmail(
  empresaId: string,
  cpf: string | null,
  cnpj: string | null,
  email: string,
  exceptId?: string,
): Promise<{ message: string; fieldErrors: Record<string, string> } | null> {
  const supabase = await createClient()

  const buildQuery = (col: "cpf" | "cnpj" | "email", value: string) => {
    let q = supabase
      .from("clientes")
      .select("id", { head: true, count: "exact" })
      .eq("empresa_id", empresaId)
      .eq(col, value)
    if (exceptId) q = q.neq("id", exceptId)
    return q
  }

  const checks: Array<{ key: "cpf" | "cnpj" | "email"; value: string }> = []
  if (cpf) checks.push({ key: "cpf", value: cpf })
  if (cnpj) checks.push({ key: "cnpj", value: cnpj })
  checks.push({ key: "email", value: email })

  const results = await Promise.all(checks.map((c) => buildQuery(c.key, c.value)))
  for (let i = 0; i < checks.length; i++) {
    if ((results[i]?.count ?? 0) > 0) {
      const c = checks[i]!
      const label =
        c.key === "cpf" ? "CPF" : c.key === "cnpj" ? "CNPJ" : "E-mail"
      return {
        message: `Já existe um cliente com este ${label} nesta empresa.`,
        fieldErrors: { [c.key]: `${label} já cadastrado nesta empresa.` },
      }
    }
  }
  return null
}

function sanitizeEndereco(endereco: ClienteFormValues["endereco"]) {
  if (!endereco) return null
  const entries = Object.entries(endereco).filter(([, v]) => v != null && v !== "")
  if (entries.length === 0) return null
  return Object.fromEntries(entries)
}

function flattenFieldErrors(
  errors: Record<string, string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, msgs] of Object.entries(errors)) {
    if (msgs && msgs.length > 0 && msgs[0]) out[k] = msgs[0]
  }
  return out
}

async function logAudit(
  usuarioId: string,
  empresaId: string | null,
  acao: "criar" | "editar" | "excluir",
  entidadeId: string,
  antes: unknown,
  depois: unknown,
) {
  const supabase = await createClient()
  await supabase.from("audit_logs").insert({
    usuario_id: usuarioId,
    empresa_id: empresaId,
    acao,
    entidade: "cliente",
    entidade_id: entidadeId,
    dados_antes: antes as never,
    dados_depois: depois as never,
  })
}
