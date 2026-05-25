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
import { formatCnpj, formatCpf, formatTelefone } from "@/lib/utils/formatters"
import { ClientesFilters } from "@/components/clientes/clientes-filters"
import { StatusClienteBadge } from "@/components/clientes/status-badge"
import { NovoClienteButton } from "@/components/clientes/novo-cliente-button"
import { ClienteRowActions } from "@/components/clientes/cliente-row-actions"
import type {
  ClienteFormValues,
  StatusCliente,
  TipoCliente,
} from "@/lib/schemas/cliente"

export const metadata: Metadata = {
  title: "Clientes",
}

const PAGE_SIZE = 20

type SearchParams = Promise<{
  q?: string
  tipo?: string
  status?: string
  empresa?: string
  page?: string
}>

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "clientes", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver clientes.
      </div>
    )
  }

  const sp = await searchParams
  const q = sp.q?.trim() || ""
  const tipo = (sp.tipo as TipoCliente | undefined) ?? undefined
  const status = (sp.status as StatusCliente | undefined) ?? undefined
  const empresaFiltro = sp.empresa || undefined
  const page = Math.max(1, Number(sp.page ?? "1"))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const isAdminMaster = user.acessaTodasEmpresas

  const supabase = await createClient()

  // Empresas: Admin Master vê todas; outros perfis veem só as suas (modal usa).
  let empresas: { id: string; nome: string; slug: string }[] = []
  if (isAdminMaster) {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome, slug")
      .eq("ativo", true)
      .order("nome")
    empresas = data ?? []
  } else {
    empresas = user.empresas.map((e) => ({
      id: e.id,
      nome: e.nome,
      slug: e.slug,
    }))
  }
  const empresasParaModal = empresas.map((e) => ({ id: e.id, nome: e.nome }))
  // Default = Magic Trips quando disponível (V1 só opera lá). Fallback = 1ª.
  const magicTripsEmpresa = empresas.find((e) => e.slug === "magic-trips")
  const defaultEmpresaIdModal = magicTripsEmpresa?.id ?? empresas[0]?.id
  const lockEmpresaModal = !isAdminMaster && empresas.length === 1

  // Build query
  let query = supabase
    .from("clientes")
    .select(
      "id, nome, email, telefone, cpf, tipo, status, empresa_id, tipo_pessoa, cnpj, razao_social, nome_fantasia, responsavel, data_nascimento, observacoes, dia_faturamento, endereco, origem",
      { count: "exact" },
    )
    .order("nome")
    .range(from, to)

  if (q) {
    // Buscar por nome OU email OU CPF (CPF é dígitos puros no banco)
    const cpfDigits = q.replace(/\D/g, "")
    const ors: string[] = [`nome.ilike.%${q}%`, `email.ilike.%${q}%`]
    if (cpfDigits.length > 0) ors.push(`cpf.ilike.%${cpfDigits}%`)
    query = query.or(ors.join(","))
  }
  if (tipo) query = query.eq("tipo", tipo)
  if (status) query = query.eq("status", status)
  if (empresaFiltro && isAdminMaster) {
    query = query.eq("empresa_id", empresaFiltro)
  }

  const { data: clientes, count, error } = await query

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Erro ao carregar clientes: {error.message}
      </div>
    )
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Clientes</h2>
          <p className="mt-1 text-sm text-white/55">
            {total} {total === 1 ? "cliente cadastrado" : "clientes cadastrados"}
          </p>
        </div>

        {can(user, "clientes", "criar") && (
          <NovoClienteButton
            empresas={empresasParaModal}
            defaultEmpresaId={defaultEmpresaIdModal}
            lockEmpresa={lockEmpresaModal}
          />
        )}
      </div>

      <ClientesFilters
        q={q}
        tipo={tipo}
        status={status}
        empresaId={empresaFiltro}
        empresas={isAdminMaster ? empresas : []}
        showEmpresaFilter={isAdminMaster}
      />

      <div className="hidden md:block overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Cliente</TableHead>
              <TableHead className="text-white/55">E-mail</TableHead>
              <TableHead className="text-white/55">Telefone</TableHead>
              <TableHead className="text-white/55">Endereço</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clientes || clientes.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-sm text-white/45"
                >
                  {q || tipo || status
                    ? "Nenhum cliente encontrado com esses filtros."
                    : "Nenhum cliente cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((c) => {
                const isPJ = c.tipo_pessoa === "juridica"
                const linhaPrincipal = isPJ
                  ? c.razao_social ?? c.nome
                  : c.nome
                const linhaSecundaria = isPJ
                  ? c.responsavel ?? formatCnpj(c.cnpj)
                  : formatCpf(c.cpf)

                const end = (c.endereco ?? {}) as {
                  rua?: string
                  numero?: string
                  complemento?: string
                  bairro?: string
                  cidade?: string
                  estado?: string
                  cep?: string
                }
                const linhaRua = [
                  end.rua,
                  end.numero ? `, ${end.numero}` : "",
                  end.complemento ? ` - ${end.complemento}` : "",
                ]
                  .filter(Boolean)
                  .join("")
                const linhaCidade = [end.cidade, end.estado]
                  .filter(Boolean)
                  .join(" - ")

                return (
                  <TableRow
                    key={c.id}
                    className="border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1 leading-tight">
                        <span className="font-medium text-white">
                          {linhaPrincipal}
                        </span>
                        <span className="text-[11px] text-white/55">
                          {linhaSecundaria || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-white/65">
                      {c.email}
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {formatTelefone(c.telefone)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {linhaRua || linhaCidade ? (
                        <div className="flex flex-col gap-1 leading-tight">
                          <span className="text-white/85">
                            {linhaRua || "—"}
                          </span>
                          <span className="text-[11px] text-white/55">
                            {linhaCidade || "—"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white/35">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusClienteBadge
                        status={c.status as StatusCliente}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <ClienteRowActions
                        cliente={{
                          id: c.id,
                          nome_display: linhaPrincipal ?? "",
                          status: c.status as
                            | "lead"
                            | "ativo"
                            | "inativo",
                          initial: {
                            empresa_id: c.empresa_id,
                            tipo_pessoa: (c.tipo_pessoa ?? "fisica") as
                              | "fisica"
                              | "juridica",
                            nome: c.nome ?? "",
                            cpf: c.cpf ?? "",
                            data_nascimento: c.data_nascimento ?? "",
                            razao_social: c.razao_social ?? "",
                            nome_fantasia: c.nome_fantasia ?? "",
                            cnpj: c.cnpj ?? "",
                            responsavel: c.responsavel ?? "",
                            email: c.email,
                            telefone: c.telefone,
                            endereco: end,
                            origem: c.origem ?? "",
                            tipo: c.tipo as TipoCliente,
                            dia_faturamento: c.dia_faturamento ?? undefined,
                            status: c.status as StatusCliente,
                            observacoes: c.observacoes ?? "",
                          } as Partial<ClienteFormValues>,
                        }}
                        empresas={empresasParaModal}
                        defaultEmpresaId={defaultEmpresaIdModal}
                        lockEmpresa={lockEmpresaModal}
                        podeEditar={can(user, "clientes", "editar")}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Mobile: cards de cliente ──────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {!clientes || clientes.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center text-sm text-white/45">
            {q || tipo || status
              ? "Nenhum cliente encontrado com esses filtros."
              : "Nenhum cliente cadastrado ainda."}
          </div>
        ) : (
          clientes.map((c) => {
            const isPJ = c.tipo_pessoa === "juridica"
            const linhaPrincipal = isPJ ? c.razao_social ?? c.nome : c.nome
            const linhaSecundaria = isPJ
              ? c.responsavel ?? formatCnpj(c.cnpj)
              : formatCpf(c.cpf)

            const end = (c.endereco ?? {}) as {
              rua?: string
              numero?: string
              complemento?: string
              bairro?: string
              cidade?: string
              estado?: string
              cep?: string
            }

            return (
              <div
                key={c.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                {/* Linha 1: nome + status */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white leading-tight">
                    {linhaPrincipal}
                  </p>
                  <div className="shrink-0">
                    <StatusClienteBadge status={c.status as StatusCliente} />
                  </div>
                </div>

                {/* Linha 2: CPF / CNPJ */}
                {linhaSecundaria && (
                  <p className="mt-1 font-mono text-[11px] text-white/50">
                    {linhaSecundaria}
                  </p>
                )}

                {/* Linha 3: email */}
                {c.email && (
                  <p className="mt-1.5 text-xs text-white/60">{c.email}</p>
                )}

                {/* Linha 4: telefone */}
                {c.telefone && (
                  <p className="mt-0.5 text-xs text-white/55">
                    {formatTelefone(c.telefone)}
                  </p>
                )}

                {/* Ações */}
                <div className="mt-3 flex justify-end border-t border-white/[0.04] pt-3">
                  <ClienteRowActions
                    cliente={{
                      id: c.id,
                      nome_display: linhaPrincipal ?? "",
                      status: c.status as "lead" | "ativo" | "inativo",
                      initial: {
                        empresa_id: c.empresa_id,
                        tipo_pessoa: (c.tipo_pessoa ?? "fisica") as
                          | "fisica"
                          | "juridica",
                        nome: c.nome ?? "",
                        cpf: c.cpf ?? "",
                        data_nascimento: c.data_nascimento ?? "",
                        razao_social: c.razao_social ?? "",
                        nome_fantasia: c.nome_fantasia ?? "",
                        cnpj: c.cnpj ?? "",
                        responsavel: c.responsavel ?? "",
                        email: c.email,
                        telefone: c.telefone,
                        endereco: end,
                        origem: c.origem ?? "",
                        tipo: c.tipo as TipoCliente,
                        dia_faturamento: c.dia_faturamento ?? undefined,
                        status: c.status as StatusCliente,
                        observacoes: c.observacoes ?? "",
                      } as Partial<ClienteFormValues>,
                    }}
                    empresas={empresasParaModal}
                    defaultEmpresaId={defaultEmpresaIdModal}
                    lockEmpresa={lockEmpresaModal}
                    podeEditar={can(user, "clientes", "editar")}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-white/55">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
              >
                <Link
                  href={`/clientes?${new URLSearchParams({
                    ...Object.fromEntries(
                      Object.entries(sp).filter(([, v]) => v != null),
                    ),
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
                  href={`/clientes?${new URLSearchParams({
                    ...Object.fromEntries(
                      Object.entries(sp).filter(([, v]) => v != null),
                    ),
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
