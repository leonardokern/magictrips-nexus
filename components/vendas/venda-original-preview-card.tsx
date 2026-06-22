"use client"

import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Receipt,
  ShoppingCart,
  Sparkles,
  User,
  UserCheck,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBRL } from "@/lib/utils/sum-parser"
import type { VendaOriginalCompleta } from "@/app/(dashboard)/vendas/actions-alteracao"

type Props = {
  venda: VendaOriginalCompleta
}

/**
 * Card read-only com cliente, agente, data, produtos e totais de uma venda
 * original — exibido no passo de verificação antes de iniciar a alteração.
 */
export function VendaOriginalPreviewCard({ venda }: Props) {
  const totalVenda = venda.produtos.reduce(
    (acc, p) => acc + Number(p.valor_venda ?? 0),
    0,
  )
  const totalCusto = venda.produtos.reduce(
    (acc, p) => acc + Number(p.valor_custo ?? 0),
    0,
  )
  const totalRav = venda.produtos.reduce(
    (acc, p) => acc + Number(p.rav ?? 0),
    0,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-nexus-bright/20 bg-nexus-bright/[0.04] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-nexus-bright/30 bg-nexus-bright/10">
            <Receipt className="h-4 w-4 text-nexus-bright" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Venda original
            </p>
            <p className="font-mono text-sm font-semibold text-white">
              {venda.identificador}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Total
          </p>
          <p className="text-base font-semibold tabular-nums text-white">
            {formatBRL(totalVenda)}
          </p>
        </div>
      </div>

      {/* Linha 1 — Cliente e Agente (cards principais) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile icon={User} label="Cliente" value={venda.cliente.nome} />
        <InfoTile
          icon={UserCheck}
          label="Agente"
          value={venda.agente.nome}
        />
      </div>

      {/* Linha 2 — Data, Origem e Status (cards menores) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SmallTile
          icon={CalendarDays}
          label="Data da venda"
          value={formatDateBr(venda.data_venda)}
        />
        <SmallTile
          icon={Sparkles}
          label="Origem"
          value={venda.origem || "—"}
        />
        <SmallTile
          icon={BadgeCheck}
          label="Status"
          value={venda.status === "aprovado" ? "Aprovada" : venda.status}
          tone={venda.status === "aprovado" ? "emerald" : "neutral"}
        />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
          <ShoppingCart className="h-3.5 w-3.5" />
          Produtos ({venda.produtos.length})
        </h4>
        <div className="space-y-2">
          {venda.produtos.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] bg-white/[0.015] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {p.tipo_produto_nome}
                </p>
                <p className="truncate text-[11px] text-white/45">
                  {p.fornecedor_nome || "—"}
                  {p.localizador ? ` · ${p.localizador}` : ""}
                </p>
                {(p.data_inicio_viagem || p.data_fim_viagem) && (
                  <p className="mt-0.5 truncate text-[11px] text-white/55">
                    Viagem{" "}
                    {p.data_inicio_viagem
                      ? formatDateBr(p.data_inicio_viagem)
                      : "—"}
                    {" → "}
                    {p.data_fim_viagem ? formatDateBr(p.data_fim_viagem) : "—"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4 text-right">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    Venda
                  </p>
                  <p className="text-sm tabular-nums text-white">
                    {formatBRL(Number(p.valor_venda ?? 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    Custo
                  </p>
                  <p className="text-sm tabular-nums text-rose-300/85">
                    {formatBRL(Number(p.valor_custo ?? 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    RAV
                  </p>
                  <p className="text-sm tabular-nums font-medium text-emerald-300">
                    {formatBRL(Number(p.rav ?? 0))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-end gap-4 border-t border-white/[0.06] pt-3 text-sm">
          <span className="text-white/45">
            Custo total{" "}
            <span className="tabular-nums text-rose-300/85">
              {formatBRL(totalCusto)}
            </span>
          </span>
          <span className="text-white/45">
            RAV total{" "}
            <span className="tabular-nums font-medium text-emerald-300">
              {formatBRL(totalRav)}
            </span>
          </span>
          <span className="text-white/85">
            Venda{" "}
            <span className="tabular-nums font-semibold text-white">
              {formatBRL(totalVenda)}
            </span>
          </span>
        </div>
      </div>

      {/* Passageiros — lista completa cadastrada na venda */}
      {venda.passageiros.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
            <Users className="h-3.5 w-3.5" />
            Passageiros ({venda.passageiros.length})
          </h4>
          <ul className="space-y-2">
            {venda.passageiros.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-md border border-white/[0.04] bg-white/[0.015] px-3 py-2"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-medium text-white/70">
                  {iniciais(p.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {p.nome || "(sem nome)"}
                  </p>
                  <p className="truncate text-[11px] text-white/45">
                    {[
                      p.cpf ? `CPF ${p.cpf}` : null,
                      p.data_nascimento
                        ? `Nasc. ${formatDateBr(p.data_nascimento)}`
                        : null,
                      p.passaporte ? `Passaporte ${p.passaporte}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem dados adicionais"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cobrança do cliente — só aparece se a venda foi cadastrada com
          uma cobrança (algumas vendas antigas podem não ter). */}
      {venda.cobranca && venda.cobranca.itens.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
              <CreditCard className="h-3.5 w-3.5" />
              Cobrança ({venda.cobranca.itens.length})
            </h4>
            <span className="text-sm font-semibold tabular-nums text-white">
              {formatBRL(Number(venda.cobranca.valor_total ?? 0))}
            </span>
          </div>
          <ul className="space-y-2">
            {venda.cobranca.itens.map((it) => (
              <li
                key={it.id}
                className="rounded-md border border-white/[0.04] bg-white/[0.015] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">
                    {COBRANCA_LABEL[it.tipo] ?? it.tipo}
                    {it.plataforma && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-white/45">
                        · {it.plataforma}
                      </span>
                    )}
                  </span>
                  <span className="text-sm tabular-nums text-white/85">
                    {formatBRL(Number(it.valor_total ?? 0))}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/45">
                  <span>
                    {it.num_parcelas}x
                    {it.valor_parcela != null && (
                      <> de {formatBRL(Number(it.valor_parcela))}</>
                    )}
                  </span>
                  {it.taxa_adquirente != null && (
                    <span>
                      Taxa {Number(it.taxa_adquirente).toFixed(2)}%
                    </span>
                  )}
                  {it.valor_liquido != null && (
                    <span>
                      Líquido {formatBRL(Number(it.valor_liquido))}
                    </span>
                  )}
                  {it.data_primeiro_recebimento && (
                    <span>
                      1º recebimento {formatDateBr(it.data_primeiro_recebimento)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {venda.cobranca.observacoes && (
            <p className="mt-3 border-t border-white/[0.04] pt-2 text-[11px] text-white/55">
              {venda.cobranca.observacoes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const COBRANCA_LABEL: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  faturado: "Faturado",
  link_externo: "Link externo",
  outro: "Outro",
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-white/45" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          {label}
        </p>
        <p className="truncate text-sm text-white/85">{value}</p>
      </div>
    </div>
  )
}

function SmallTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone?: "neutral" | "emerald"
}) {
  const isEmerald = tone === "emerald"
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-white/[0.02] px-2.5 py-2",
        isEmerald
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-white/[0.06]",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isEmerald ? "text-emerald-300" : "text-white/45",
        )}
      />
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/45">
          {label}
        </p>
        <p
          className={cn(
            "truncate text-xs",
            isEmerald ? "text-emerald-300" : "text-white/85",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function iniciais(nome: string) {
  if (!nome) return "?"
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

function formatDateBr(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return d && m && y ? `${d}/${m}/${y}` : iso
}
