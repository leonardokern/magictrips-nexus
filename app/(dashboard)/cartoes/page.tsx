import type { Metadata } from "next"
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
import { NovoCartaoButton } from "@/components/cartoes/novo-cartao-button"
import { CartaoRowActions } from "@/components/cartoes/cartao-row-actions"

export const metadata: Metadata = {
  title: "Cartões da Agência",
}

export default async function CartoesPage() {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver cartões.
      </div>
    )
  }

  const supabase = await createClient()
  const [{ data: cartoes }, { data: empresas }, { data: usuarios }] =
    await Promise.all([
      supabase
        .from("cartoes")
        .select(
          "id, nome, banco, empresa_id, usuario_id, dia_vencimento, dia_fechamento, ativo, created_at",
        )
        .order("ativo", { ascending: false })
        .order("nome"),
      supabase
        .from("empresas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("usuarios")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
    ])

  const empresasMap = new Map((empresas ?? []).map((e) => [e.id, e.nome]))
  const usuariosMap = new Map((usuarios ?? []).map((u) => [u.id, u.nome]))
  const empresasList = empresas ?? []
  const usuariosList = usuarios ?? []

  const podeEditar = can(user, "cartoes", "editar")
  const podeExcluir = can(user, "cartoes", "excluir")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Cartões da Agência
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Cartões usados pra pagar fornecedores. Cada cartão é vinculado a
            uma empresa e a um usuário responsável.
          </p>
        </div>

        {can(user, "cartoes", "criar") && (
          <NovoCartaoButton empresas={empresasList} usuarios={usuariosList} />
        )}
      </div>

      {/* ── Desktop: tabela ─────────────────────────────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Cartão</TableHead>
              <TableHead className="text-white/55">Banco</TableHead>
              <TableHead className="text-white/55">Empresa</TableHead>
              <TableHead className="text-white/55">Responsável</TableHead>
              <TableHead className="text-right text-white/55">
                Fechamento
              </TableHead>
              <TableHead className="text-right text-white/55">
                Vencimento
              </TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!cartoes || cartoes.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-sm text-white/45"
                >
                  Nenhum cartão cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              cartoes.map((c) => (
                <TableRow
                  key={c.id}
                  className="border-white/[0.06] hover:bg-white/[0.025]"
                >
                  <TableCell className="font-medium text-white">
                    {c.nome}
                  </TableCell>
                  <TableCell className="text-sm text-white/75">
                    {c.banco || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-white/75">
                    {empresasMap.get(c.empresa_id) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-white/75">
                    {usuariosMap.get(c.usuario_id) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-white/75">
                    {c.dia_fechamento ? `dia ${c.dia_fechamento}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-white/75">
                    dia {c.dia_vencimento}
                  </TableCell>
                  <TableCell>
                    {c.ativo ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                        Ativo
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/55">
                        Inativo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <CartaoRowActions
                      cartao={{
                        id: c.id,
                        nome: c.nome,
                        banco: c.banco,
                        empresa_id: c.empresa_id,
                        usuario_id: c.usuario_id,
                        dia_vencimento: c.dia_vencimento,
                        dia_fechamento: c.dia_fechamento,
                        ativo: c.ativo,
                      }}
                      empresas={empresasList}
                      usuarios={usuariosList}
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

      {/* ── Mobile: cards ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {!cartoes || cartoes.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center text-sm text-white/45">
            Nenhum cartão cadastrado.
          </div>
        ) : (
          cartoes.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">
                    {c.nome}
                  </p>
                  {c.banco && (
                    <p className="mt-0.5 text-xs text-white/55">{c.banco}</p>
                  )}
                </div>
                {c.ativo ? (
                  <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                    Ativo
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/55">
                    Inativo
                  </span>
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-white/40">Empresa</span>
                  <p className="text-white/80">{empresasMap.get(c.empresa_id) ?? "—"}</p>
                </div>
                <div>
                  <span className="text-white/40">Responsável</span>
                  <p className="text-white/80">{usuariosMap.get(c.usuario_id) ?? "—"}</p>
                </div>
                <div>
                  <span className="text-white/40">Fechamento</span>
                  <p className="tabular-nums text-white/80">
                    {c.dia_fechamento ? `dia ${c.dia_fechamento}` : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-white/40">Vencimento</span>
                  <p className="tabular-nums text-white/80">dia {c.dia_vencimento}</p>
                </div>
              </div>

              <div className="mt-3 flex justify-end border-t border-white/[0.04] pt-3">
                <CartaoRowActions
                  cartao={{
                    id: c.id,
                    nome: c.nome,
                    banco: c.banco,
                    empresa_id: c.empresa_id,
                    usuario_id: c.usuario_id,
                    dia_vencimento: c.dia_vencimento,
                    dia_fechamento: c.dia_fechamento,
                    ativo: c.ativo,
                  }}
                  empresas={empresasList}
                  usuarios={usuariosList}
                  podeEditar={podeEditar}
                  podeExcluir={podeExcluir}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
