import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { formatDateBr } from "@/lib/utils/formatters"
import { PacotesFilters } from "@/components/pacotes/pacotes-filters"
import { TipoPacoteBadge, PacoteAtivoBadge } from "@/components/pacotes/pacote-badges"
import { NovoPacoteButton } from "@/components/pacotes/novo-pacote-button"
import {
  PacoteRowActions,
  type PacoteRow,
} from "@/components/pacotes/pacote-row-actions"
import type { TipoPacote } from "@/lib/schemas/pacote"
import type { TipoProdutoOpcao, FornecedorOpcao } from "@/components/pacotes/pacote-form-modal"
import type { CampoDinamico } from "@/components/shared/campo-dinamico-input"

export const metadata: Metadata = {
  title: "Pacotes",
}

const PAGE_SIZE = 20

type SearchParams = Promise<{
  q?: string
  tipo?: string
  status?: string
  page?: string
}>

export default async function PacotesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "pacotes", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver pacotes.
      </div>
    )
  }

  const empresaId = user.empresas[0]?.id
  if (!empresaId) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Nenhuma empresa vinculada ao seu usuário.
      </div>
    )
  }

  const sp = await searchParams
  const q = sp.q?.trim() || ""
  const tipo = (sp.tipo as TipoPacote | undefined) ?? undefined
  const status = sp.status || undefined
  const page = Math.max(1, Number(sp.page ?? "1"))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  let query = supabase
    .from("pacotes")
    .select(
      "id, nome, descricao, tipo_pacote, data_inicio_viagem, data_fim_viagem, tipo_produto_id, fornecedor_id, valor_custo_total, valores_extras, ativo",
      { count: "exact" },
    )
    .order("nome")
    .range(from, to)

  if (q) query = query.ilike("nome", `%${q}%`)
  if (tipo) query = query.eq("tipo_pacote", tipo)
  if (status === "ativo") query = query.eq("ativo", true)
  if (status === "inativo") query = query.eq("ativo", false)

  const [
    { data: pacotesRaw, count, error },
    { data: tipos },
    { data: vinculos },
    { data: fornecedoresRaw },
    { data: fornecedorVinculos },
    { data: campos },
    { data: opcoes },
  ] = await Promise.all([
    query,
    supabase.from("tipos_produto").select("id, nome, icone").eq("ativo", true).order("nome"),
    supabase.from("tipos_produto_campos").select("tipo_produto_id, campo_id, obrigatorio, ordem"),
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("fornecedor_tipos_produto").select("fornecedor_id, tipo_produto_id"),
    supabase.from("campos_extra").select("id, nome, tipo_campo, placeholder").eq("ativo", true).order("nome"),
    supabase.from("campos_extra_opcoes").select("campo_id, valor, ordem").eq("ativo", true).order("ordem"),
  ])

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Erro ao carregar pacotes: {(error as { message: string }).message}
      </div>
    )
  }

  type PacoteQueryRow = {
    id: string
    nome: string
    descricao: string | null
    tipo_pacote: TipoPacote
    data_inicio_viagem: string
    data_fim_viagem: string
    tipo_produto_id: string | null
    fornecedor_id: string | null
    valor_custo_total: number | null
    valores_extras: Record<string, string> | null
    ativo: boolean
  }
  const pacotesBase = (pacotesRaw ?? []) as PacoteQueryRow[]
  const pacoteIds = pacotesBase.map((p) => p.id)

  // Itens dos pacotes desta página + fornecedores de cada item
  const { data: itensRaw } = pacoteIds.length
    ? await supabase
        .from("pacote_itens")
        .select("id, pacote_id, ordem, tipo_produto_id, descricao, valores_extras")
        .in("pacote_id", pacoteIds)
        .order("ordem")
    : { data: [] }

  type ItemQueryRow = {
    id: string
    pacote_id: string
    ordem: number
    tipo_produto_id: string
    descricao: string | null
    valores_extras: Record<string, string> | null
  }
  const itensBase = (itensRaw ?? []) as ItemQueryRow[]
  const itemIds = itensBase.map((i) => i.id)

  const { data: itemFornecedoresRaw } = itemIds.length
    ? await supabase
        .from("pacote_item_fornecedores")
        .select("id, pacote_item_id, fornecedor_id, valor_custo, ordem")
        .in("pacote_item_id", itemIds)
        .order("ordem")
    : { data: [] }

  type ItemFornecedorQueryRow = {
    pacote_item_id: string
    fornecedor_id: string
    valor_custo: number
    ordem: number
  }
  const itemFornecedoresPorItem = new Map<string, ItemFornecedorQueryRow[]>()
  for (const f of (itemFornecedoresRaw ?? []) as ItemFornecedorQueryRow[]) {
    const arr = itemFornecedoresPorItem.get(f.pacote_item_id) ?? []
    arr.push(f)
    itemFornecedoresPorItem.set(f.pacote_item_id, arr)
  }

  const itensPorPacote = new Map<string, PacoteRow["itens"]>()
  for (const it of itensBase) {
    const arr = itensPorPacote.get(it.pacote_id) ?? []
    arr.push({
      tipo_produto_id: it.tipo_produto_id,
      descricao: it.descricao,
      valores_extras: it.valores_extras ?? {},
      ordem: it.ordem,
      fornecedores: (itemFornecedoresPorItem.get(it.id) ?? []).map((f) => ({
        fornecedor_id: f.fornecedor_id,
        valor_custo: f.valor_custo,
        ordem: f.ordem,
      })),
    })
    itensPorPacote.set(it.pacote_id, arr)
  }

  const pacotes: PacoteRow[] = pacotesBase.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    tipo_pacote: p.tipo_pacote,
    data_inicio_viagem: p.data_inicio_viagem,
    data_fim_viagem: p.data_fim_viagem,
    tipo_produto_id: p.tipo_produto_id,
    fornecedor_id: p.fornecedor_id,
    valor_custo_total: p.valor_custo_total,
    valores_extras: p.valores_extras ?? {},
    ativo: p.ativo,
    itens: itensPorPacote.get(p.id) ?? [],
  }))

  // Catálogos para os modais
  const vinculosPorTipo = new Map<
    string,
    { campo_id: string; obrigatorio: boolean; ordem: number }[]
  >()
  for (const v of vinculos ?? []) {
    const arr = vinculosPorTipo.get(v.tipo_produto_id) ?? []
    arr.push({ campo_id: v.campo_id, obrigatorio: v.obrigatorio, ordem: v.ordem })
    vinculosPorTipo.set(v.tipo_produto_id, arr)
  }
  const tiposProduto: TipoProdutoOpcao[] = (tipos ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    icone: t.icone ?? null,
    campos: vinculosPorTipo.get(t.id) ?? [],
  }))

  const vinculosPorFornecedor = new Map<string, string[]>()
  for (const v of (fornecedorVinculos ?? []) as { fornecedor_id: string; tipo_produto_id: string }[]) {
    const arr = vinculosPorFornecedor.get(v.fornecedor_id) ?? []
    arr.push(v.tipo_produto_id)
    vinculosPorFornecedor.set(v.fornecedor_id, arr)
  }
  const fornecedores: FornecedorOpcao[] = ((fornecedoresRaw ?? []) as { id: string; nome: string }[]).map(
    (f) => ({
      id: f.id,
      nome: f.nome,
      tipos_produto_ids: vinculosPorFornecedor.get(f.id) ?? [],
    }),
  )

  const opcoesPorCampo = new Map<string, { valor: string }[]>()
  for (const o of opcoes ?? []) {
    const arr = opcoesPorCampo.get(o.campo_id) ?? []
    arr.push({ valor: o.valor })
    opcoesPorCampo.set(o.campo_id, arr)
  }
  const camposExtra: CampoDinamico[] = (campos ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo_campo: c.tipo_campo,
    placeholder: c.placeholder,
    opcoes: opcoesPorCampo.get(c.id) ?? [],
  }))

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const podeCriar = can(user, "pacotes", "criar")
  const podeEditar = can(user, "pacotes", "editar")
  const podeExcluir = can(user, "pacotes", "excluir")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Pacotes</h2>
          <p className="mt-1 text-sm text-white/55">
            {total} {total === 1 ? "pacote cadastrado" : "pacotes cadastrados"}
          </p>
        </div>

        {podeCriar && (
          <NovoPacoteButton
            tiposProduto={tiposProduto}
            fornecedores={fornecedores}
            camposExtra={camposExtra}
            empresaId={empresaId}
          />
        )}
      </div>

      <PacotesFilters q={q} tipo={tipo} status={status} />

      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Nome</TableHead>
              <TableHead className="text-white/55">Tipo</TableHead>
              <TableHead className="text-white/55">Vigência</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pacotes.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell colSpan={5} className="h-32 text-center text-sm text-white/45">
                  {q || tipo || status
                    ? "Nenhum pacote encontrado com esses filtros."
                    : "Nenhum pacote cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              pacotes.map((p) => (
                <TableRow key={p.id} className="border-white/[0.06] hover:bg-white/[0.025]">
                  <TableCell>
                    <p className="font-medium text-white">{p.nome}</p>
                    {p.descricao && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-white/45">{p.descricao}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <TipoPacoteBadge tipo={p.tipo_pacote} />
                  </TableCell>
                  <TableCell className="text-sm text-white/75">
                    {formatDateBr(p.data_inicio_viagem)} – {formatDateBr(p.data_fim_viagem)}
                  </TableCell>
                  <TableCell>
                    <PacoteAtivoBadge ativo={p.ativo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <PacoteRowActions
                      pacote={p}
                      tiposProduto={tiposProduto}
                      fornecedores={fornecedores}
                      camposExtra={camposExtra}
                      empresaId={empresaId}
                      podeEditar={podeEditar}
                      podeExcluir={podeExcluir}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {pacotes.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/45">
            {q || tipo || status
              ? "Nenhum pacote encontrado com esses filtros."
              : "Nenhum pacote cadastrado ainda."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pacotes.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{p.nome}</span>
                  <PacoteAtivoBadge ativo={p.ativo} />
                </div>
                <p className="mt-0.5 text-xs text-white/45">
                  {formatDateBr(p.data_inicio_viagem)} – {formatDateBr(p.data_fim_viagem)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <TipoPacoteBadge tipo={p.tipo_pacote} />
                  <PacoteRowActions
                    pacote={p}
                    tiposProduto={tiposProduto}
                    fornecedores={fornecedores}
                    camposExtra={camposExtra}
                    empresaId={empresaId}
                    podeEditar={podeEditar}
                    podeExcluir={podeExcluir}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-white/55">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
              >
                <Link
                  href={`/pacotes?${new URLSearchParams({
                    ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null)),
                    page: String(page - 1),
                  } as Record<string, string>).toString()}`}
                >
                  Anterior
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
              >
                <Link
                  href={`/pacotes?${new URLSearchParams({
                    ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null)),
                    page: String(page + 1),
                  } as Record<string, string>).toString()}`}
                >
                  Próxima
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
