"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import {
  campoExtraCreateSchema,
  campoExtraUpdateSchema,
  tipoProdutoCreateSchema,
  tipoProdutoUpdateSchema,
  type CampoOpcao,
  type TipoCampo,
  type TipoProdutoVinculoCampo,
} from "@/lib/schemas/tipo-produto"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

function flatten(errors: Record<string, string[] | undefined>) {
  const out: Record<string, string> = {}
  for (const [k, msgs] of Object.entries(errors)) {
    if (msgs && msgs.length > 0 && msgs[0]) out[k] = msgs[0]
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de Produto
// ─────────────────────────────────────────────────────────────────────────────

async function syncTipoCampos(
  tipoId: string,
  campos: TipoProdutoVinculoCampo[],
) {
  const supabase = await createClient()
  await supabase.from("tipos_produto_campos").delete().eq("tipo_produto_id", tipoId)
  if (campos.length === 0) return
  await supabase.from("tipos_produto_campos").insert(
    campos.map((c) => ({
      tipo_produto_id: tipoId,
      campo_id: c.campo_id,
      obrigatorio: c.obrigatorio,
      ordem: c.ordem,
    })),
  )
}

export async function createTipoProduto(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "criar")) {
    return { ok: false, error: "Sem permissão para criar tipos de produto." }
  }

  const parsed = tipoProdutoCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { data: novo, error } = await supabase
    .from("tipos_produto")
    .insert({ nome: parsed.data.nome, ativo: true, icone: parsed.data.icone ?? null })
    .select("id")
    .single()

  if (error || !novo) {
    if (error?.code === "23505") {
      return {
        ok: false,
        error: "Já existe um tipo com esse nome.",
        fieldErrors: { nome: "Nome já em uso." },
      }
    }
    return { ok: false, error: error?.message ?? "Falha ao criar tipo." }
  }

  if (parsed.data.campos.length > 0) {
    await syncTipoCampos(novo.id, parsed.data.campos)
  }

  revalidatePath("/tipos-produto")
  return { ok: true, data: { id: novo.id } }
}

export async function updateTipoProduto(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const parsed = tipoProdutoUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const updates: { nome?: string; ativo?: boolean; icone?: string | null } = {}
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome
  if (parsed.data.ativo !== undefined) updates.ativo = parsed.data.ativo
  if (parsed.data.icone !== undefined) updates.icone = parsed.data.icone ?? null

  if (Object.keys(updates).length > 0) {
    // `.select("id")` é importante: detecta silent-fail de RLS (0 linhas
    // afetadas sem erro), que aconteceria se a policy bloqueasse a escrita.
    const { data, error } = await supabase
      .from("tipos_produto")
      .update(updates)
      .eq("id", id)
      .select("id")
    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "Já existe um tipo com esse nome.",
          fieldErrors: { nome: "Nome já em uso." },
        }
      }
      return { ok: false, error: error.message }
    }
    if (!data || data.length === 0) {
      return {
        ok: false,
        error: "Não foi possível salvar — verifique se você tem permissão para editar tipos de produto.",
      }
    }
  }

  if (parsed.data.campos !== undefined) {
    await syncTipoCampos(id, parsed.data.campos)
  }

  revalidatePath("/tipos-produto")
  return { ok: true }
}

export async function toggleTipoProdutoAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("tipos_produto")
    .update({ ativo })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/tipos-produto")
  return { ok: true }
}

export async function deleteTipoProduto(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "excluir")) {
    return { ok: false, error: "Sem permissão." }
  }
  const supabase = await createClient()

  // Bloqueia se já tiver venda usando esse tipo
  const { count } = await supabase
    .from("venda_produtos")
    .select("id", { count: "exact", head: true })
    .eq("tipo_produto_id", id)
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Existem ${count} venda(s) usando este tipo. Não dá pra excluir.`,
    }
  }

  // Apaga vínculos antes (segurança caso não tenha CASCADE)
  await supabase.from("tipos_produto_campos").delete().eq("tipo_produto_id", id)
  const { error } = await supabase.from("tipos_produto").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/tipos-produto")
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Campos Extra
// ─────────────────────────────────────────────────────────────────────────────

async function syncOpcoesCampo(campoId: string, opcoes: CampoOpcao[]) {
  const supabase = await createClient()
  // Replace strategy: apaga todas e re-insere com nova ordem
  await supabase.from("campos_extra_opcoes").delete().eq("campo_id", campoId)
  if (opcoes.length === 0) return
  await supabase.from("campos_extra_opcoes").insert(
    opcoes.map((o, i) => ({
      campo_id: campoId,
      valor: o.valor,
      ordem: o.ordem ?? i,
      ativo: true,
    })),
  )
}

export async function createCampoExtra(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "criar")) {
    return { ok: false, error: "Sem permissão para criar campos." }
  }

  const parsed = campoExtraCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { data: novo, error } = await supabase
    .from("campos_extra")
    .insert({
      nome: parsed.data.nome,
      tipo_campo: parsed.data.tipo_campo,
      placeholder: parsed.data.placeholder ?? null,
      ativo: true,
    })
    .select("id")
    .single()

  if (error || !novo) {
    if (error?.code === "23505") {
      return {
        ok: false,
        error: "Já existe um campo com esse nome.",
        fieldErrors: { nome: "Nome já em uso." },
      }
    }
    return { ok: false, error: error?.message ?? "Falha ao criar campo." }
  }

  if (parsed.data.tipo_campo === "dropdown" && parsed.data.opcoes) {
    await syncOpcoesCampo(novo.id, parsed.data.opcoes)
  }

  revalidatePath("/tipos-produto")
  return { ok: true, data: { id: novo.id } }
}

export async function updateCampoExtra(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const parsed = campoExtraUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const updates: {
    nome?: string
    tipo_campo?: string
    placeholder?: string | null
    ativo?: boolean
  } = {}
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome
  if (parsed.data.tipo_campo !== undefined)
    updates.tipo_campo = parsed.data.tipo_campo
  if (parsed.data.placeholder !== undefined)
    updates.placeholder = parsed.data.placeholder
  if (parsed.data.ativo !== undefined) updates.ativo = parsed.data.ativo

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from("campos_extra")
      .update(updates)
      .eq("id", id)
      .select("id")
    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "Já existe um campo com esse nome.",
          fieldErrors: { nome: "Nome já em uso." },
        }
      }
      return { ok: false, error: error.message }
    }
    if (!data || data.length === 0) {
      return {
        ok: false,
        error: "Não foi possível salvar — verifique se você tem permissão para editar campos.",
      }
    }
  }

  // Opções: replace
  const tipoEfetivo = parsed.data.tipo_campo
  if (parsed.data.opcoes !== undefined) {
    if (tipoEfetivo === "dropdown" || tipoEfetivo === undefined) {
      await syncOpcoesCampo(id, parsed.data.opcoes)
    } else {
      // Mudou pra tipo não-dropdown: apaga opções remanescentes
      const supa = await createClient()
      await supa.from("campos_extra_opcoes").delete().eq("campo_id", id)
    }
  } else if (tipoEfetivo && tipoEfetivo !== "dropdown") {
    const supa = await createClient()
    await supa.from("campos_extra_opcoes").delete().eq("campo_id", id)
  }

  revalidatePath("/tipos-produto")
  return { ok: true }
}

export async function toggleCampoExtraAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("campos_extra")
    .update({ ativo })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/tipos-produto")
  return { ok: true }
}

export async function deleteCampoExtra(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "excluir")) {
    return { ok: false, error: "Sem permissão." }
  }
  const supabase = await createClient()

  // Bloqueia se o campo está vinculado a algum tipo
  const { count } = await supabase
    .from("tipos_produto_campos")
    .select("id", { count: "exact", head: true })
    .eq("campo_id", id)
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Este campo está vinculado a ${count} tipo(s) de produto. Remova os vínculos antes de excluir.`,
    }
  }

  await supabase.from("campos_extra_opcoes").delete().eq("campo_id", id)
  const { error } = await supabase.from("campos_extra").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/tipos-produto")
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Listagem pro modal "Gerenciar campos"
// ─────────────────────────────────────────────────────────────────────────────

export type CampoExtraComUso = {
  id: string
  nome: string
  tipo_campo: TipoCampo
  placeholder: string | null
  ativo: boolean
  opcoes: CampoOpcao[]
  /** Nomes dos tipos de produto que usam esse campo. */
  tiposEmUso: string[]
}

/**
 * Lê todos os campos extras (com opções e nomes dos tipos que usam) pra alimentar
 * o modal "Gerenciar campos". É uma server action separada das listagens do page.tsx
 * porque o modal carrega sob demanda — exibe loader enquanto espera.
 */
export async function listarCamposParaGerenciar(): Promise<
  ActionResult<CampoExtraComUso[]>
> {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "ler")) {
    return { ok: false, error: "Sem permissão." }
  }
  const supabase = await createClient()

  const [{ data: campos, error: campErr }, { data: opcoes }, { data: vinculos }] =
    await Promise.all([
      supabase
        .from("campos_extra")
        .select("id, nome, tipo_campo, placeholder, ativo")
        .order("nome"),
      supabase
        .from("campos_extra_opcoes")
        .select("id, campo_id, valor, ordem")
        .eq("ativo", true)
        .order("ordem"),
      supabase
        .from("tipos_produto_campos")
        .select("campo_id, tipos_produto(nome)"),
    ])

  if (campErr) return { ok: false, error: campErr.message }

  const opcoesPorCampo = new Map<string, CampoOpcao[]>()
  for (const o of opcoes ?? []) {
    const arr = opcoesPorCampo.get(o.campo_id) ?? []
    arr.push({ id: o.id, valor: o.valor, ordem: o.ordem })
    opcoesPorCampo.set(o.campo_id, arr)
  }

  const tiposPorCampo = new Map<string, string[]>()
  for (const v of vinculos ?? []) {
    const nome = v.tipos_produto?.nome
    if (!nome) continue
    const arr = tiposPorCampo.get(v.campo_id) ?? []
    arr.push(nome)
    tiposPorCampo.set(v.campo_id, arr)
  }

  const result: CampoExtraComUso[] = (campos ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo_campo: c.tipo_campo as TipoCampo,
    placeholder: c.placeholder,
    ativo: c.ativo,
    opcoes: opcoesPorCampo.get(c.id) ?? [],
    tiposEmUso: tiposPorCampo.get(c.id) ?? [],
  }))

  return { ok: true, data: result }
}
