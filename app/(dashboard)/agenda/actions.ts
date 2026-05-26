"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { createClient } from "@/lib/supabase/server"

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type AgendaEvento = {
  id: string
  tipo:
    | "conta_receber"
    | "cartao_fechamento"
    | "cartao_vencimento"
    | "viagem_inicio"
    | "lembrete"
    | "nota"
    | "reuniao"
    | "tarefa"
    | "outro"
  titulo: string
  descricao: string | null
  dia: string // ISO YYYY-MM-DD
  cor: string // hex
  referenciaTipo: string | null
  referenciaId: string | null
  valor: number | null
  /** HH:MM (24h) ou null quando o evento for de dia inteiro / não-manual */
  horaInicio: string | null
  horaFim: string | null
}

export type EventoManualInput = {
  titulo: string
  descricao?: string
  data_inicio: string
  data_fim?: string
  tipo: "nota" | "reuniao" | "tarefa" | "outro"
  cor: string
  all_day?: boolean
  hora_inicio?: string
  hora_fim?: string
  /** IDs dos usuários com quem compartilhar o evento (além do dono). */
  compartilhar_com?: string[]
}

export type UsuarioParaCompartilhar = {
  id: string
  nome: string
  perfilNome: string
}

const eventoManualSchema = z.object({
  titulo: z.string().trim().min(2, "Informe um título"),
  descricao: z.string().trim().optional(),
  data_inicio: z.string().min(8, "Informe uma data válida"),
  data_fim: z.string().optional(),
  tipo: z.enum(["nota", "reuniao", "tarefa", "outro"]).default("nota"),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex (#RRGGBB)")
    .default("#1498D5"),
  all_day: z.boolean().default(true),
  hora_inicio: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)")
    .optional(),
  hora_fim: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)")
    .optional(),
  compartilhar_com: z.array(z.string().uuid()).optional(),
})

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// ─── Listar eventos do período ────────────────────────────────────────────────

/**
 * Lista todos os eventos da agenda entre p_inicio e p_fim (inclusive).
 * Agrega 5 fontes via RPC `get_agenda_eventos`:
 *   - Contas a receber (parcelas_receber pendentes/atrasadas)
 *   - Cartões (fechamento + vencimento, expandido mês a mês)
 *   - Viagens (data_inicio_viagem em vendas aprovadas)
 *   - Lembretes pendentes do usuário
 *   - Eventos manuais (agenda_eventos)
 *
 * Permissão: agenda.ler. Agentes recebem apenas seus próprios lembretes
 * e notas manuais (filtragem feita dentro da RPC).
 */
export async function listarEventosAgenda(
  inicio: string,
  fim: string,
): Promise<ActionResult<AgendaEvento[]>> {
  const user = await requireCurrentUser()
  if (!can(user, "agenda", "ler") && !can(user, "agenda", "criar")) {
    return { ok: false, error: "Sem permissão para ver agenda." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_agenda_eventos", {
    p_inicio: inicio,
    p_fim: fim,
  })
  if (error) return { ok: false, error: error.message }

  const eventos: AgendaEvento[] = (data ?? []).map((r) => ({
    id: r.id,
    tipo: r.tipo as AgendaEvento["tipo"],
    titulo: r.titulo,
    descricao: r.descricao || null,
    dia: r.dia,
    cor: r.cor,
    referenciaTipo: r.referencia_tipo || null,
    referenciaId: r.referencia_id ?? null,
    valor: r.valor != null ? Number(r.valor) : null,
    horaInicio: r.hora_inicio ?? null,
    horaFim: r.hora_fim ?? null,
  }))

  return { ok: true, data: eventos }
}

// ─── CRUD de eventos manuais ──────────────────────────────────────────────────

export async function criarEventoManual(
  empresaId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "agenda", "criar")) {
    return { ok: false, error: "Sem permissão para criar evento." }
  }
  const parsed = eventoManualSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Verifique os campos." }
  }

  const supabase = await createClient()
  // Se all_day=false mas hora_inicio vazia, volta a tratar como dia inteiro
  const isAllDay = parsed.data.all_day || !parsed.data.hora_inicio
  const { data, error } = await supabase
    .from("agenda_eventos")
    .insert({
      empresa_id: empresaId,
      criado_por: user.id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      data_inicio: parsed.data.data_inicio,
      data_fim: parsed.data.data_fim || null,
      tipo: parsed.data.tipo,
      cor: parsed.data.cor,
      all_day: isAllDay,
      hora_inicio: isAllDay ? null : parsed.data.hora_inicio,
      hora_fim: isAllDay ? null : parsed.data.hora_fim || null,
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }

  // Compartilhamentos opcionais. O front já filtra Administrador master, e
  // a RLS de INSERT em agenda_eventos_compartilhamentos exige que o criador
  // seja o dono do evento — então é seguro inserir aqui sem revalidar.
  const compart = parsed.data.compartilhar_com ?? []
  if (compart.length > 0) {
    const rows = compart.map((usuario_id) => ({
      evento_id: data.id,
      usuario_id,
    }))
    const { error: shareErr } = await supabase
      .from("agenda_eventos_compartilhamentos")
      .insert(rows)
    if (shareErr) {
      console.error("Erro ao compartilhar evento:", shareErr.message)
    }
    // Nota: o lembrete pro destinatário é gerado automaticamente por um
    // trigger AFTER INSERT em agenda_eventos_compartilhamentos (migration
    // 053). Não precisa inserir aqui — RLS de lembretes só permite INSERT
    // por Administrador, então tentar do client falha. O trigger roda
    // como SECURITY DEFINER e bypassa essa restrição.
  }

  revalidatePath("/agenda")
  return { ok: true, data: { id: data.id } }
}

/**
 * Lista usuários da mesma empresa do solicitante para popular o
 * multi-select "Compartilhar com". Exclui:
 *   - o próprio usuário (não faz sentido compartilhar consigo)
 *   - usuários com perfil "Administrador" (admin master enxerga tudo via outros canais)
 *   - usuários inativos
 */
export async function listarUsuariosParaCompartilhar(): Promise<
  ActionResult<UsuarioParaCompartilhar[]>
> {
  await requireCurrentUser()
  const supabase = await createClient()

  // RPC SECURITY DEFINER já filtra por empresa do solicitante, exclui o
  // próprio usuário, exclui Administrador master e ordena por nome.
  const { data, error } = await supabase.rpc("listar_usuarios_para_compartilhar")
  if (error) return { ok: false, error: error.message }

  const lista: UsuarioParaCompartilhar[] = (data ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    perfilNome: r.perfil_nome,
  }))
  return { ok: true, data: lista }
}

export async function atualizarEventoManual(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "agenda", "editar")) {
    return { ok: false, error: "Sem permissão para editar evento." }
  }
  const parsed = eventoManualSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Verifique os campos." }
  }
  void user

  const supabase = await createClient()
  const { error } = await supabase
    .from("agenda_eventos")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      data_inicio: parsed.data.data_inicio,
      data_fim: parsed.data.data_fim || null,
      tipo: parsed.data.tipo,
      cor: parsed.data.cor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/agenda")
  return { ok: true }
}

export async function excluirEventoManual(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "agenda", "excluir")) {
    return { ok: false, error: "Sem permissão para excluir evento." }
  }
  void user

  const supabase = await createClient()
  const { error } = await supabase.from("agenda_eventos").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/agenda")
  return { ok: true }
}

// ─── Dados auxiliares para a página ───────────────────────────────────────────

export type AgendaPageData = {
  empresas: { id: string; nome: string }[]
  empresaPadrao: string | null
}

export async function getAgendaPageData(): Promise<ActionResult<AgendaPageData>> {
  const user = await requireCurrentUser()
  const supabase = await createClient()
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nome")
    .order("nome")

  return {
    ok: true,
    data: {
      empresas: empresas ?? [],
      empresaPadrao:
        user.empresas?.find((e) => e.slug === "magic-trips")?.id ??
        user.empresas?.[0]?.id ??
        null,
    },
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatDataBR(iso: string): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
