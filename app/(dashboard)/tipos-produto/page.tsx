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
import { NovoTipoProdutoButton } from "@/components/tipos-produto/novo-tipo-produto-button"
import { GerenciarCamposButton } from "@/components/tipos-produto/gerenciar-campos-button"
import { TipoProdutoRowActions } from "@/components/tipos-produto/tipo-produto-row-actions"
import Image from "next/image"
import {
  TIPO_CAMPO_LABEL,
  type TipoCampo,
  type TipoProdutoVinculoCampo,
} from "@/lib/schemas/tipo-produto"

export const metadata: Metadata = {
  title: "Tipos de Produto",
}

export default async function TiposProdutoPage() {
  const user = await requireCurrentUser()
  if (!can(user, "tipos_produto", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver tipos de produto.
      </div>
    )
  }

  const supabase = await createClient()
  const [{ data: tipos }, { data: campos }, { data: vinculos }] =
    await Promise.all([
      supabase
        .from("tipos_produto")
        .select("id, nome, ativo, icone, created_at")
        .order("nome"),
      supabase
        .from("campos_extra")
        .select("id, nome, tipo_campo")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("tipos_produto_campos")
        .select("tipo_produto_id, campo_id, obrigatorio, ordem"),
    ])

  const camposMap = new Map(
    (campos ?? []).map((c) => [
      c.id,
      { id: c.id, nome: c.nome, tipo_campo: c.tipo_campo as TipoCampo },
    ]),
  )

  // Agrupa vínculos por tipo
  const vinculosPorTipo = new Map<string, TipoProdutoVinculoCampo[]>()
  for (const v of vinculos ?? []) {
    const arr = vinculosPorTipo.get(v.tipo_produto_id) ?? []
    arr.push({
      campo_id: v.campo_id,
      obrigatorio: v.obrigatorio,
      ordem: v.ordem,
    })
    vinculosPorTipo.set(v.tipo_produto_id, arr)
  }
  for (const arr of vinculosPorTipo.values()) {
    arr.sort((a, b) => a.ordem - b.ordem)
  }

  const podeEditar = can(user, "tipos_produto", "editar")
  const podeExcluir = can(user, "tipos_produto", "excluir")
  const camposList = Array.from(camposMap.values())

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Tipos de Produto
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Cada tipo (Aéreo, Hotel, Cruzeiro…) define quais campos extras
            aparecem ao registrar uma venda. Gerencie o catálogo de campos pela
            opção {`"Gerenciar campos"`}.
          </p>
        </div>

        <div className="flex gap-2">
          {can(user, "tipos_produto", "ler") && (
            <GerenciarCamposButton
              podeCriar={can(user, "tipos_produto", "criar")}
              podeEditar={podeEditar}
              podeExcluir={podeExcluir}
            />
          )}
          {can(user, "tipos_produto", "criar") && (
            <NovoTipoProdutoButton camposDisponiveis={camposList} />
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Nome</TableHead>
              <TableHead className="text-white/55">Campos vinculados</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!tipos || tipos.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-sm text-white/45"
                >
                  Nenhum tipo cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              tipos.map((t) => {
                const vinc = vinculosPorTipo.get(t.id) ?? []
                return (
                  <TableRow
                    key={t.id}
                    className="border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {t.icone ? (
                          <div className="relative h-4 w-4 shrink-0">
                            <Image
                              src={`/icons/tipos-produto/${t.icone}.png`}
                              alt={t.nome}
                              fill
                              className="object-contain"
                              style={{ filter: "brightness(0) invert(1)", opacity: 0.55 }}
                            />
                          </div>
                        ) : (
                          <div className="h-4 w-4 shrink-0" />
                        )}
                        <span className="font-medium text-white">{t.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {vinc.length === 0 ? (
                        <span className="text-xs text-white/45">
                          Sem campos vinculados
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {vinc.map((v) => {
                            const campo = camposMap.get(v.campo_id)
                            if (!campo) return null
                            return (
                              <span
                                key={v.campo_id}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/80"
                                title={TIPO_CAMPO_LABEL[campo.tipo_campo]}
                              >
                                {campo.nome}
                                {v.obrigatorio && (
                                  <span className="text-nexus-bright">*</span>
                                )}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.ativo ? (
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
                      <TipoProdutoRowActions
                        tipo={{
                          id: t.id,
                          nome: t.nome,
                          ativo: t.ativo,
                          icone: t.icone ?? null,
                          campos: vinc,
                        }}
                        camposDisponiveis={camposList}
                        podeEditar={podeEditar}
                        podeExcluir={podeExcluir}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
