import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Building2,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  ShoppingCart,
  User,
  Users,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { formatBRL } from "@/lib/utils/sum-parser"
import { formatCpf } from "@/lib/utils/formatters"
import { AprovarVendaButton } from "@/components/vendas/aprovar-venda-button"

export const metadata: Metadata = { title: "Venda" }

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pendente_validacao: "Aguardando aprovação",
  aprovado: "Aprovada",
  cancelado: "Cancelada",
}

const STATUS_CHIP: Record<string, string> = {
  rascunho: "border-white/15 bg-white/[0.04] text-white/55",
  pendente_validacao: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  aprovado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cancelado: "border-rose-500/30 bg-rose-500/10 text-rose-300",
}

export default async function VendaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "ler")) notFound()

  const { id } = await params
  const supabase = await createClient()

  const { data: v } = await supabase
    .from("vendas")
    .select(
      `
      id, data_venda, status, pax, indicacao_percentual, origem, observacoes,
      empresa_id, created_at, aprovado_por, data_aprovacao,
      empresa:empresas(nome, slug),
      cliente:clientes(id, nome, cpf, email, telefone, tipo),
      agente:usuarios!vendas_usuario_id_fkey(nome, email),
      aprovador:usuarios!vendas_aprovado_por_fkey(nome)
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (!v) notFound()

  const [
    { data: produtos },
    { data: passageiros },
    { data: cobranca },
  ] = await Promise.all([
    supabase
      .from("venda_produtos")
      .select(
        "id, ordem, tipo_produto_nome, fornecedor_nome, destino, localizador, data_inicio_viagem, valor_venda, valor_custo, rav, comissao_vendedor, pgto_forma, pgto_num_parcelas, pgto_valor_total",
      )
      .eq("venda_id", id)
      .order("ordem"),
    supabase
      .from("venda_passageiros")
      .select("id, nome, cpf, data_nascimento, ordem")
      .eq("venda_id", id)
      .order("ordem"),
    supabase
      .from("cobranca_cliente")
      .select(
        `
        id, valor_total, observacoes,
        itens:cobranca_cliente_itens(id, tipo, valor_total, num_parcelas, valor_parcela, plataforma_link)
      `,
      )
      .eq("venda_id", id)
      .maybeSingle(),
  ])

  const totalVenda = (produtos ?? []).reduce(
    (acc, p) => acc + Number(p.valor_venda ?? 0),
    0,
  )
  const totalCusto = (produtos ?? []).reduce(
    (acc, p) => acc + Number(p.valor_custo ?? 0),
    0,
  )
  const totalComissao = (produtos ?? []).reduce(
    (acc, p) => acc + Number(p.comissao_vendedor ?? 0),
    0,
  )
  const totalRav = (produtos ?? []).reduce(
    (acc, p) => acc + Number(p.rav ?? 0),
    0,
  )
  const lucroBruto = totalVenda - totalCusto - totalComissao

  return (
    <div className="space-y-6">
      <Link
        href="/vendas"
        className="inline-flex items-center text-sm text-white/55 hover:text-white"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Vendas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Venda · {v.cliente?.nome ?? "—"}
          </h2>
          <span
            className={
              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
              (STATUS_CHIP[v.status] ?? STATUS_CHIP.rascunho)
            }
          >
            {STATUS_LABEL[v.status] ?? v.status}
          </span>
        </div>

        {/* Botão de aprovação — só aparece para quem pode aprovar e a venda está pendente */}
        {can(user, "vendas", "aprovar") && v.status === "pendente_validacao" && (
          <AprovarVendaButton
            vendaId={v.id}
            clienteNome={v.cliente?.nome ?? "—"}
            totalVenda={formatBRL(totalVenda)}
          />
        )}
      </div>

      <p className="text-sm text-white/55">
        Criada em {formatDateBR(v.data_venda)} · ID {v.id.slice(0, 8)}
      </p>

      {/* Banner de aprovação */}
      {v.status === "aprovado" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-sm text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            Aprovada por{" "}
            <strong>
              {(v.aprovador as { nome: string } | null)?.nome ?? "—"}
            </strong>
            {v.data_aprovacao && (
              <> em {formatDateBR(v.data_aprovacao.slice(0, 10))}</>
            )}
          </span>
        </div>
      )}

      {/* Identificação */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Building2 className="h-4 w-4 text-nexus-bright" />
              Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-white">
              {v.empresa?.nome ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <User className="h-4 w-4 text-nexus-bright" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium text-white">
              {v.cliente?.id ? (
                <Link
                  href={`/clientes/${v.cliente.id}`}
                  className="hover:underline"
                >
                  {v.cliente.nome}
                </Link>
              ) : (
                v.cliente?.nome ?? "—"
              )}
            </p>
            <p className="font-mono text-xs text-white/45">
              {v.cliente?.cpf ? formatCpf(v.cliente.cpf) : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <CalendarDays className="h-4 w-4 text-nexus-bright" />
              Detalhes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-white/75">
            <p>
              Agente:{" "}
              <span className="text-white">{v.agente?.nome ?? "—"}</span>
            </p>
            <p>
              PAX: <span className="text-white">{v.pax}</span>
            </p>
            <p>
              Indicação:{" "}
              <span className="text-white">
                {v.indicacao_percentual
                  ? `${Number(v.indicacao_percentual).toFixed(0)}%`
                  : "—"}
              </span>
            </p>
            {v.origem && (
              <p>
                Origem: <span className="text-white">{v.origem}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Produtos */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <ShoppingCart className="h-4 w-4 text-nexus-bright" />
            Produtos ({(produtos ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Fornecedor</th>
                  <th className="px-3 py-2 text-left">Destino</th>
                  <th className="px-3 py-2 text-left">Início</th>
                  <th className="px-3 py-2 text-right">Venda</th>
                  <th className="px-3 py-2 text-right">Custo</th>
                  <th className="px-3 py-2 text-right">RAV</th>
                  <th className="px-3 py-2 text-right">Comissão</th>
                  <th className="px-3 py-2 text-left">Pgto fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {(produtos ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-3 py-2 text-white/55">{p.ordem}</td>
                    <td className="px-3 py-2 text-white/85">
                      {p.tipo_produto_nome}
                    </td>
                    <td className="px-3 py-2 text-white/65">
                      {p.fornecedor_nome}
                      {p.localizador && (
                        <span className="ml-2 font-mono text-[10px] text-white/40">
                          {p.localizador}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-white/65">
                      {p.destino ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-white/65">
                      {p.data_inicio_viagem
                        ? formatDateBR(p.data_inicio_viagem)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/85">
                      {formatBRL(Number(p.valor_venda))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/55">
                      {formatBRL(Number(p.valor_custo))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/65">
                      {p.rav ? formatBRL(Number(p.rav)) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/65">
                      {p.comissao_vendedor
                        ? formatBRL(Number(p.comissao_vendedor))
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-white/55">
                      {p.pgto_forma ?? "—"}
                      {p.pgto_num_parcelas && p.pgto_num_parcelas > 1 && (
                        <span className="ml-1 text-white/40">
                          {p.pgto_num_parcelas}x
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-white/[0.03] font-medium">
                  <td className="px-3 py-2 text-white/65" colSpan={5}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white">
                    {formatBRL(totalVenda)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/65">
                    {formatBRL(totalCusto)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/85">
                    {formatBRL(totalRav)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/85">
                    {formatBRL(totalComissao)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cobrança */}
      {cobranca && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <CreditCard className="h-4 w-4 text-nexus-bright" />
              Cobrança do cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {(cobranca.itens as unknown as Array<{
                id: string
                tipo: string
                valor_total: number
                num_parcelas: number
                plataforma_link: string | null
              }> | null)?.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between rounded border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                >
                  <span className="text-white/75">
                    {it.tipo}
                    {it.num_parcelas > 1 && (
                      <span className="ml-2 text-xs text-white/45">
                        {it.num_parcelas}x
                      </span>
                    )}
                    {it.plataforma_link && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-white/40">
                        via {it.plataforma_link}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-white">
                    {formatBRL(Number(it.valor_total))}
                  </span>
                </li>
              ))}
              <li className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 font-medium">
                <span className="text-white/85">Total cobrado</span>
                <span className="tabular-nums text-white">
                  {formatBRL(Number(cobranca.valor_total))}
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Passageiros */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Users className="h-4 w-4 text-nexus-bright" />
            Passageiros ({(passageiros ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2 text-sm">
            {(passageiros ?? []).map((p) => (
              <li
                key={p.id}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/80"
              >
                {p.nome}
                {p.cpf && (
                  <span className="ml-2 font-mono text-[10px] text-white/45">
                    {formatCpf(p.cpf)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Resultado */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-base text-white">Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <ResultadoBox label="Venda" value={formatBRL(totalVenda)} />
            <ResultadoBox label="Custo" value={formatBRL(totalCusto)} muted />
            <ResultadoBox
              label="Comissão vendedor"
              value={formatBRL(totalComissao)}
              muted
            />
            <ResultadoBox
              label="Lucro bruto"
              value={formatBRL(lucroBruto)}
              accent={lucroBruto >= 0 ? "emerald" : "rose"}
            />
          </div>
        </CardContent>
      </Card>

      {v.observacoes && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/75">{v.observacoes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ResultadoBox({
  label,
  value,
  muted,
  accent,
}: {
  label: string
  value: string
  muted?: boolean
  accent?: "emerald" | "rose"
}) {
  const valueColor =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "rose"
        ? "text-rose-300"
        : muted
          ? "text-white/65"
          : "text-white"
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${valueColor}`}>
        {value}
      </p>
    </div>
  )
}

function formatDateBR(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
