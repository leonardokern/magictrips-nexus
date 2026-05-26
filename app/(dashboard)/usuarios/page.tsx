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
import { UsuariosFilters } from "@/components/usuarios/usuarios-filters"
import {
  PerfilUsuarioBadge,
  UsuarioAtivoBadge,
} from "@/components/usuarios/usuario-badges"
import { NovoUsuarioButton } from "@/components/usuarios/novo-usuario-button"
import { UsuarioRowActions } from "@/components/usuarios/usuario-row-actions"

export const metadata: Metadata = {
  title: "Usuários",
}

const PAGE_SIZE = 20

type SearchParams = Promise<{
  q?: string
  perfil?: string
  status?: string
  empresa?: string
  page?: string
}>

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver usuários.
      </div>
    )
  }

  const sp = await searchParams
  const q = sp.q?.trim() || ""
  const perfilId = sp.perfil || undefined
  const status = sp.status || undefined
  const empresaFiltro = sp.empresa || undefined
  const page = Math.max(1, Number(sp.page ?? "1"))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const isAdminMaster = user.acessaTodasEmpresas
  const supabase = await createClient()

  const [{ data: perfis }, { data: empresasAtivas }] = await Promise.all([
    supabase.from("perfis_acesso").select("id, nome, empresa_id").eq("ativo", true).order("nome"),
    supabase.from("empresas").select("id, nome, slug").eq("ativo", true).order("nome"),
  ])

  // Filtro de empresa só pra Admin Master. NovoUsuarioButton recebe todas.
  const empresas = isAdminMaster ? (empresasAtivas ?? []) : []

  // Se filtrando por empresa, primeiro acha os usuario_ids dessa empresa
  let usuarioIdsFiltrados: string[] | null = null
  if (empresaFiltro && isAdminMaster) {
    const { data: rels } = await supabase
      .from("usuarios_empresas")
      .select("usuario_id")
      .eq("empresa_id", empresaFiltro)
    usuarioIdsFiltrados = (rels ?? []).map((r) => r.usuario_id)
    if (usuarioIdsFiltrados.length === 0) usuarioIdsFiltrados = ["00000000-0000-0000-0000-000000000000"]
  }

  // Query principal — foto_url via cast (aguardando regenerar database.types.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("usuarios")
    .select("id, nome, email, iniciais, foto_url, ativo, perfil_id", { count: "exact" })
    .order("nome")
    .range(from, to)

  if (q) query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`)
  if (perfilId) query = query.eq("perfil_id", perfilId)
  if (status === "ativo") query = query.eq("ativo", true)
  if (status === "inativo") query = query.eq("ativo", false)
  if (usuarioIdsFiltrados) query = query.in("id", usuarioIdsFiltrados)

  type UsuarioRow = { id: string; nome: string; email: string; iniciais: string | null; foto_url: string | null; ativo: boolean; perfil_id: string }
  const { data: usuariosRaw, count, error } = await query
  const usuarios = (usuariosRaw ?? []) as UsuarioRow[]

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Erro ao carregar usuários: {(error as { message: string }).message}
      </div>
    )
  }

  const perfisMap = new Map((perfis ?? []).map((p) => [p.id, p.nome]))
  const empresasMap = new Map((empresasAtivas ?? []).map((e) => [e.id, e.nome]))

  // Busca as empresas de cada usuário em batch
  const userIds = (usuarios ?? []).map((u) => u.id)
  const { data: empresasUsuarios } = userIds.length
    ? await supabase
        .from("usuarios_empresas")
        .select("usuario_id, empresa_id")
        .in("usuario_id", userIds)
    : { data: [] as { usuario_id: string; empresa_id: string }[] }

  const empresasPorUsuario = new Map<string, string[]>()
  for (const r of empresasUsuarios ?? []) {
    const arr = empresasPorUsuario.get(r.usuario_id) ?? []
    arr.push(r.empresa_id)
    empresasPorUsuario.set(r.usuario_id, arr)
  }
  const totalEmpresasAtivas = (empresasAtivas ?? []).length

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Usuários
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {total} {total === 1 ? "usuário cadastrado" : "usuários cadastrados"}
          </p>
        </div>

        {can(user, "usuarios", "criar") && (
          <NovoUsuarioButton
            perfis={perfis ?? []}
            empresas={empresasAtivas ?? []}
          />
        )}
      </div>

      <UsuariosFilters
        q={q}
        perfilId={perfilId}
        status={status}
        empresaId={empresaFiltro}
        perfis={perfis ?? []}
        empresas={empresas}
        showEmpresaFilter={isAdminMaster}
      />

      <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Usuário</TableHead>
              <TableHead className="text-white/55">E-mail</TableHead>
              <TableHead className="text-white/55">Perfil</TableHead>
              <TableHead className="text-white/55">Empresa</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!usuarios || usuarios.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell colSpan={6} className="h-32 text-center text-sm text-white/45">
                  {q || perfilId || status
                    ? "Nenhum usuário encontrado com esses filtros."
                    : "Nenhum usuário cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => {
                const perfilNome = perfisMap.get(u.perfil_id) ?? "—"
                const userEmpresaIds = empresasPorUsuario.get(u.id) ?? []
                const empresaNome =
                  userEmpresaIds.length === 0
                    ? "—"
                    : userEmpresaIds.length >= totalEmpresasAtivas
                      ? "Todas"
                      : userEmpresaIds
                          .map((id) => empresasMap.get(id) ?? "?")
                          .join(" · ")
                return (
                  <TableRow
                    key={u.id}
                    className="border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-white/80">
                          {u.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.foto_url} alt={u.nome} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            u.iniciais ?? u.nome.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-medium text-white">
                          {u.nome}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-white/55">{u.email}</TableCell>
                    <TableCell>
                      <PerfilUsuarioBadge nome={perfilNome} />
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {empresaNome}
                    </TableCell>
                    <TableCell>
                      <UsuarioAtivoBadge ativo={u.ativo} />
                    </TableCell>
                    <TableCell className="text-right">
                      <UsuarioRowActions
                        usuario={{
                          id: u.id,
                          nome: u.nome,
                          email: u.email,
                          perfil_id: u.perfil_id,
                          perfil_nome: perfilNome,
                          empresa_ids: userEmpresaIds,
                          ativo: u.ativo,
                          foto_url: u.foto_url,
                        }}
                        perfis={perfis ?? []}
                        empresas={empresasAtivas ?? []}
                        podeEditar={can(user, "usuarios", "editar")}
                        isSelf={u.id === user.id}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden">
        {!usuarios || usuarios.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/45">
            {q || perfilId || status
              ? "Nenhum usuário encontrado com esses filtros."
              : "Nenhum usuário cadastrado ainda."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {usuarios.map((u) => {
              const perfilNome = perfisMap.get(u.perfil_id) ?? "—"
              const userEmpresaIds = empresasPorUsuario.get(u.id) ?? []
              const empresaNome =
                userEmpresaIds.length === 0
                  ? "—"
                  : userEmpresaIds.length >= totalEmpresasAtivas
                    ? "Todas"
                    : userEmpresaIds
                        .map((id) => empresasMap.get(id) ?? "?")
                        .join(" · ")
              return (
                <div
                  key={u.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  {/* Row 1: avatar + nome + status */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-white/80">
                      {u.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.foto_url} alt={u.nome} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        u.iniciais ?? u.nome.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="flex-1 font-medium text-white">
                      {u.nome}
                    </span>
                    <UsuarioAtivoBadge ativo={u.ativo} />
                  </div>
                  {/* Row 2: email */}
                  <p className="mt-1.5 pl-12 text-xs text-white/55">{u.email}</p>
                  {/* Row 3: perfil + empresa */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-12">
                    <PerfilUsuarioBadge nome={perfilNome} />
                    <span className="text-xs text-white/55">{empresaNome}</span>
                  </div>
                  {/* Actions row */}
                  <div className="mt-3 flex items-center justify-end border-t border-white/[0.06] pt-3">
                    <UsuarioRowActions
                      usuario={{
                        id: u.id,
                        nome: u.nome,
                        email: u.email,
                        perfil_id: u.perfil_id,
                        perfil_nome: perfilNome,
                        empresa_ids: userEmpresaIds,
                        ativo: u.ativo,
                      }}
                      perfis={perfis ?? []}
                      empresas={empresasAtivas ?? []}
                      podeEditar={can(user, "usuarios", "editar")}
                      isSelf={u.id === user.id}
                    />
                  </div>
                </div>
              )
            })}
          </div>
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
                  href={`/usuarios?${new URLSearchParams({
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
                  href={`/usuarios?${new URLSearchParams({
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
