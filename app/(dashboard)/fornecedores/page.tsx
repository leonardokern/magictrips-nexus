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
import { formatCnpj } from "@/lib/utils/formatters"
import { FornecedoresFilters } from "@/components/fornecedores/fornecedores-filters"
import {
  FornecedorAtivoBadge,
  TipoFornecedorBadge,
} from "@/components/fornecedores/fornecedor-badges"
import { NovoFornecedorButton } from "@/components/fornecedores/novo-fornecedor-button"
import { FornecedorRowActions } from "@/components/fornecedores/fornecedor-row-actions"
import type { TipoFornecedor } from "@/lib/schemas/fornecedor"

export const metadata: Metadata = {
  title: "Fornecedores",
}

const PAGE_SIZE = 20

type SearchParams = Promise<{
  q?: string
  tipo?: string
  status?: string
  page?: string
}>

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "fornecedores", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver fornecedores.
      </div>
    )
  }

  const sp = await searchParams
  const q = sp.q?.trim() || ""
  const tipo = (sp.tipo as TipoFornecedor | undefined) ?? undefined
  const status = sp.status || undefined
  const page = Math.max(1, Number(sp.page ?? "1"))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  // Tipos de produto para os modais
  const { data: tiposProduto } = await supabase
    .from("tipos_produto")
    .select("id, nome, icone")
    .eq("ativo", true)
    .order("nome")

  // Query principal — colunas novas via cast (aguardando regenerar database.types.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("fornecedores")
    .select("id, nome, cnpj, tipo, ativo, modo_comissionado, modo_comissionado_dia_pagamento, modo_net", { count: "exact" })
    .order("nome")
    .range(from, to)

  if (q) {
    const cnpjDigits = q.replace(/\D/g, "")
    const ors: string[] = [`nome.ilike.%${q}%`]
    if (cnpjDigits.length > 0) ors.push(`cnpj.ilike.%${cnpjDigits}%`)
    query = query.or(ors.join(","))
  }
  if (tipo) query = query.eq("tipo", tipo)
  if (status === "ativo") query = query.eq("ativo", true)
  if (status === "inativo") query = query.eq("ativo", false)

  const { data: fornecedoresRaw, count, error } = await query

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Erro ao carregar fornecedores: {(error as { message: string }).message}
      </div>
    )
  }

  type FornRow = {
    id: string; nome: string; cnpj: string; tipo: string | null; ativo: boolean
    modo_comissionado: boolean; modo_comissionado_dia_pagamento: number | null; modo_net: boolean
  }
  const fornecedores = (fornecedoresRaw ?? []) as FornRow[]

  // Carrega vínculos de tipos de produto em batch para esta página
  const fornIds = fornecedores.map((f) => f.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vinculos } = fornIds.length
    ? await (supabase as any)
        .from("fornecedor_tipos_produto")
        .select("fornecedor_id, tipo_produto_id")
        .in("fornecedor_id", fornIds)
    : { data: [] }

  const vinculosPorFornecedor = new Map<string, string[]>()
  for (const v of (vinculos ?? []) as { fornecedor_id: string; tipo_produto_id: string }[]) {
    const arr = vinculosPorFornecedor.get(v.fornecedor_id) ?? []
    arr.push(v.tipo_produto_id)
    vinculosPorFornecedor.set(v.fornecedor_id, arr)
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const podeEditar = can(user, "fornecedores", "editar")
  const tiposProdutoList = (tiposProduto ?? []) as { id: string; nome: string; icone: string | null }[]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Fornecedores
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {total}{" "}
            {total === 1 ? "fornecedor cadastrado" : "fornecedores cadastrados"}
          </p>
        </div>

        {can(user, "fornecedores", "criar") && (
          <NovoFornecedorButton tiposProduto={tiposProdutoList} />
        )}
      </div>

      <FornecedoresFilters q={q} tipo={tipo} status={status} />

      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Nome</TableHead>
              <TableHead className="text-white/55">CNPJ</TableHead>
              <TableHead className="text-white/55">Tipo</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell colSpan={5} className="h-32 text-center text-sm text-white/45">
                  {q || tipo || status
                    ? "Nenhum fornecedor encontrado com esses filtros."
                    : "Nenhum fornecedor cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              fornecedores.map((f) => (
                <TableRow key={f.id} className="border-white/[0.06] hover:bg-white/[0.025]">
                  <TableCell className="font-medium text-white">{f.nome}</TableCell>
                  <TableCell className="font-mono text-xs text-white/75">
                    {formatCnpj(f.cnpj)}
                  </TableCell>
                  <TableCell>
                    <TipoFornecedorBadge tipo={f.tipo as TipoFornecedor | null} />
                  </TableCell>
                  <TableCell>
                    <FornecedorAtivoBadge ativo={f.ativo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <FornecedorRowActions
                      fornecedor={{
                        id: f.id,
                        nome: f.nome,
                        cnpj: f.cnpj,
                        tipo: f.tipo as TipoFornecedor | null,
                        ativo: f.ativo,
                        tiposProdutoIds: vinculosPorFornecedor.get(f.id) ?? [],
                        modoComissionado: f.modo_comissionado,
                        modoComissionadoDia: f.modo_comissionado_dia_pagamento,
                        modoNet: f.modo_net,
                      }}
                      tiposProduto={tiposProdutoList}
                      podeEditar={podeEditar}
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
        {fornecedores.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/45">
            {q || tipo || status
              ? "Nenhum fornecedor encontrado com esses filtros."
              : "Nenhum fornecedor cadastrado ainda."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {fornecedores.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{f.nome}</span>
                  <FornecedorAtivoBadge ativo={f.ativo} />
                </div>
                <p className="mt-1.5 font-mono text-xs text-white/55">
                  {formatCnpj(f.cnpj)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <TipoFornecedorBadge tipo={f.tipo as TipoFornecedor | null} />
                  <FornecedorRowActions
                    fornecedor={{
                      id: f.id,
                      nome: f.nome,
                      cnpj: f.cnpj,
                      tipo: f.tipo as TipoFornecedor | null,
                      ativo: f.ativo,
                      tiposProdutoIds: vinculosPorFornecedor.get(f.id) ?? [],
                      modoComissionado: f.modo_comissionado,
                      modoComissionadoDia: f.modo_comissionado_dia_pagamento,
                      modoNet: f.modo_net,
                    }}
                    tiposProduto={tiposProdutoList}
                    podeEditar={podeEditar}
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
                  href={`/fornecedores?${new URLSearchParams({
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
                  href={`/fornecedores?${new URLSearchParams({
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
