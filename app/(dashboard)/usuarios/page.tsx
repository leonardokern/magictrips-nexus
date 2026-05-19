import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
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

  const isAdminMaster = user.empresa === null
  const supabase = await createClient()

  const { data: perfis = [] } = await supabase
    .from("perfis_acesso")
    .select("id, nome")
    .order("nome")

  let empresas: { id: string; nome: string }[] = []
  if (isAdminMaster) {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome")
    empresas = data ?? []
  }

  // Query principal
  let query = supabase
    .from("usuarios")
    .select(
      "id, nome, email, iniciais, ativo, perfil_id, empresa_id",
      { count: "exact" },
    )
    .order("nome")
    .range(from, to)

  if (q) {
    query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (perfilId) query = query.eq("perfil_id", perfilId)
  if (status === "ativo") query = query.eq("ativo", true)
  if (status === "inativo") query = query.eq("ativo", false)
  if (empresaFiltro && isAdminMaster) query = query.eq("empresa_id", empresaFiltro)

  const { data: usuarios, count, error } = await query

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Erro ao carregar usuários: {error.message}
      </div>
    )
  }

  const perfisMap = new Map((perfis ?? []).map((p) => [p.id, p.nome]))
  const empresasMap = new Map(empresas.map((e) => [e.id, e.nome]))

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
          <Button asChild className="bg-indigo-500 text-white hover:bg-indigo-400">
            <Link href="/usuarios/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </Link>
          </Button>
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

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Usuário</TableHead>
              <TableHead className="text-white/55">E-mail</TableHead>
              <TableHead className="text-white/55">Perfil</TableHead>
              <TableHead className="text-white/55">Empresa</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!usuarios || usuarios.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell colSpan={5} className="h-32 text-center text-sm text-white/45">
                  {q || perfilId || status
                    ? "Nenhum usuário encontrado com esses filtros."
                    : "Nenhum usuário cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => {
                const perfilNome = perfisMap.get(u.perfil_id) ?? "—"
                const empresaNome = u.empresa_id
                  ? empresasMap.get(u.empresa_id) ?? "—"
                  : "Todas"
                return (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <TableCell>
                      <Link
                        href={`/usuarios/${u.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-white/80">
                          {u.iniciais ?? u.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-white hover:underline">
                          {u.nome}
                        </span>
                      </Link>
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
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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
