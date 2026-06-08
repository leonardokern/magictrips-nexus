"use client"

import { useState } from "react"
import Image from "next/image"
import { CheckCircle, AlertTriangle, ChevronDown, ExternalLink, FileDown, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { formatBRL } from "@/lib/utils/sum-parser"
import { COBRANCA_TIPO_LABEL, PGTO_FORMA_LABEL } from "@/lib/schemas/venda"
import type { VendaDetalhes } from "@/app/(dashboard)/vendas/actions"
import { obterUrlAnexo } from "@/app/(dashboard)/vendas/anexos-actions"
import { RevisaoComprovanteLink } from "./comprovante-cobranca-upload"
import { cn } from "@/lib/utils"

function formatDateBR(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
        {titulo}
      </p>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="text-sm text-white/85">{value || "—"}</p>
    </div>
  )
}


type Produto = VendaDetalhes["produtos"][number]

// ─── Linha de produto expansível ────────────────────────────────────────────

function ProdutoRow({ p }: { p: Produto }) {
  const [open, setOpen] = useState(false)

  const temDetalhes =
    p.camposExtras.length > 0 ||
    !!p.fornecedorNome ||
    !!p.localizador ||
    !!p.localizadorFornecedor ||
    !!p.destino ||
    !!p.dataEmissao ||
    p.ravExtraCliente > 0 ||
    p.ravExtraFornecedor > 0 ||
    !!p.pgtoForma

  return (
    <>
      {/* Linha principal */}
      <tr
        className={cn(
          "border-b border-white/[0.04] last:border-0",
          temDetalhes && "cursor-pointer hover:bg-white/[0.025]",
        )}
        onClick={() => temDetalhes && setOpen((o) => !o)}
      >
        <td className="px-3 py-2 text-white/85">
          <span className="flex items-center gap-1.5">
            {temDetalhes && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-white/35 transition-transform duration-150",
                  open && "rotate-180",
                )}
              />
            )}
            {!temDetalhes && <span className="h-3.5 w-3.5 shrink-0" />}
            {p.icone && (
              <span className="relative block h-3.5 w-3.5 shrink-0">
                <Image
                  src={`/icons/tipos-produto/${p.icone}.png`}
                  alt={p.tipoNome}
                  fill
                  className="object-contain"
                  style={{ filter: "brightness(0) invert(1)", opacity: 0.5 }}
                />
              </span>
            )}
            {p.tipoNome}
            {p.destino && (
              <span className="ml-1 text-[11px] text-white/40">
                · {p.destino}
              </span>
            )}
          </span>
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-white/85">
          {formatBRL(p.valorVenda)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-white/55">
          {formatBRL(p.valorCusto)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-white/70">
          {formatBRL(p.rav)}
        </td>
      </tr>

      {/* Painel expandido */}
      {open && (
        <tr className="border-b border-white/[0.04]">
          <td colSpan={4} className="px-3 pb-4 pt-0">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">

                {/* Fornecedor */}
                {p.fornecedorNome && (
                  <MiniStat label="Fornecedor" value={p.fornecedorNome} />
                )}

                {/* Data de emissão do produto (conferência) */}
                {p.dataEmissao && (
                  <MiniStat label="Emissão" value={formatDateBR(p.dataEmissao)} />
                )}

                {/* Datas da viagem deste produto */}
                {p.dataInicio && (
                  <MiniStat
                    label="Início viagem"
                    value={formatDateBR(p.dataInicio)}
                  />
                )}
                {p.dataFim && (
                  <MiniStat
                    label="Fim viagem"
                    value={formatDateBR(p.dataFim)}
                  />
                )}

                {/* Campos personalizados do tipo de produto */}
                {p.camposExtras.map((ce) => (
                  <MiniStat key={ce.nome} label={ce.nome} value={ce.valor} />
                ))}

                {/* Destino */}
                {p.destino && <MiniStat label="Destino" value={p.destino} />}

                {/* Localizadores */}
                {p.localizador && (
                  <MiniStat label="Localizador" value={p.localizador} />
                )}
                {p.localizadorFornecedor && (
                  <MiniStat
                    label="Loc. Fornecedor"
                    value={p.localizadorFornecedor}
                  />
                )}

                {/* RAV extra cliente */}
                {p.ravExtraCliente > 0 && (
                  <MiniStat
                    label="RAV Extra Cliente"
                    value={formatBRL(p.ravExtraCliente)}
                    accent="bright"
                  />
                )}

                {/* RAV extra fornecedor */}
                {p.ravExtraFornecedor > 0 && (
                  <MiniStat
                    label="RAV Extra Fornecedor"
                    value={formatBRL(p.ravExtraFornecedor)}
                    accent="bright"
                  />
                )}

                {/* Tipo de comissão */}
                {p.tipoComissao && (
                  <MiniStat label="Tipo comissão" value={p.tipoComissao} />
                )}

              </div>

              {/* Pagamento ao fornecedor */}
              {p.pgtoForma && (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <p className="mb-2.5 text-[10px] font-medium uppercase tracking-widest text-white/35">
                    Pagamento ao Fornecedor
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                    <MiniStat
                      label="Forma"
                      value={
                        PGTO_FORMA_LABEL[
                          p.pgtoForma as keyof typeof PGTO_FORMA_LABEL
                        ] ?? p.pgtoForma
                      }
                    />
                    {p.pgtoCartaoNome && (
                      <MiniStat label="Cartão" value={p.pgtoCartaoNome} />
                    )}
                    {p.pgtoValorTotal != null && (
                      <MiniStat
                        label="Valor total"
                        value={formatBRL(p.pgtoValorTotal)}
                      />
                    )}
                    {p.pgtoEntrada > 0 && (
                      <MiniStat
                        label="Entrada"
                        value={formatBRL(p.pgtoEntrada)}
                      />
                    )}
                    {p.pgtoNumParcelas > 1 && (
                      <MiniStat
                        label="Parcelas"
                        value={
                          p.pgtoValorParcela
                            ? `${p.pgtoNumParcelas}× ${formatBRL(p.pgtoValorParcela)}`
                            : `${p.pgtoNumParcelas}×`
                        }
                      />
                    )}
                    {p.pgtoDataDebito && (
                      <MiniStat
                        label="Data de entrada"
                        value={formatDateBR(p.pgtoDataDebito)}
                      />
                    )}
                    {p.pgtoPrimeiraParcelaExtra > 0 && (
                      <MiniStat
                        label="Taxa 1ª parcela"
                        value={formatBRL(p.pgtoPrimeiraParcelaExtra)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: "amber" | "bright"
}) {
  const valueClass =
    accent === "amber"
      ? "text-amber-300"
      : accent === "bright"
        ? "text-nexus-bright"
        : "text-white/80"

  return (
    <div>
      <p className="mb-0.5 text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </p>
      <p className={cn("text-sm", valueClass)}>{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  detalhes: VendaDetalhes
  mostraComissao: boolean
  /** ID da venda — quando fornecido, exibe botões de PDF na coluna sticky. */
  vendaId?: string
  /** Exibe o botão de Relatório (restrito a Admin/Gerente). */
  mostraRelatorio?: boolean
}

export function VendaResumoPanel({ detalhes: d, mostraComissao, vendaId, mostraRelatorio }: Props) {
  const totalVenda = d.produtos.reduce((a, p) => a + p.valorVenda, 0)
  const totalCusto = d.produtos.reduce((a, p) => a + p.valorCusto, 0)
  // RAV total = RAV base (venda - custo) + RAV Extra Cliente + RAV Extra Fornecedor
  const totalRavBase = d.produtos.reduce((a, p) => a + p.rav, 0)
  const totalRavExtraCliente = d.produtos.reduce(
    (a, p) => a + p.ravExtraCliente,
    0,
  )
  const totalRavExtraFornecedor = d.produtos.reduce(
    (a, p) => a + p.ravExtraFornecedor,
    0,
  )
  const totalRav = totalRavBase + totalRavExtraCliente + totalRavExtraFornecedor
  // Comissão = RAV total × % do agente. Recalculada AQUI em vez de somar
  // `p.comissao` armazenado em DB — garante que vendas antigas (gravadas com
  // base que excluía rav_extra_fornecedor) também exibam o valor correto
  // pela regra atual.
  const totalComissao = ((d.comissaoPercentual ?? 0) * totalRav) / 100
  const totalCobranca = d.cobranca.reduce((a, c) => a + c.valor, 0)
  const margemRav =
    totalVenda > 0 ? ((totalRav / totalVenda) * 100).toFixed(1) : null

  return (
    <div className="space-y-4">
      {/* Banners de estado */}
      {d.status === "aprovado" && d.aprovadoPorNome && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-sm text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            Aprovada por <strong>{d.aprovadoPorNome}</strong>
            {d.dataAprovacao && <> em {formatDateBR(d.dataAprovacao)}</>}
          </span>
        </div>
      )}

      {d.motivoRevisao && d.status !== "aprovado" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Revisão solicitada</p>
            <p className="mt-0.5 text-amber-300/75">{d.motivoRevisao}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* ── Coluna esquerda ──────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Identificação */}
          <Bloco titulo="Identificação">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Stat label="Empresa" value={d.empresaNome} />
              <Stat label="Data da venda" value={formatDateBR(d.dataVenda)} />
              <Stat label="Cliente" value={d.clienteNome} />
              <Stat label="Agente" value={d.agenteNome} />
              <Stat label="PAX" value={`${d.pax} passageiro(s)`} />
              {d.origem && <Stat label="Origem do lead" value={d.origem} />}
            </div>
          </Bloco>

          {/* Produtos */}
          <Bloco titulo={`Produtos (${d.produtos.length})`}>
            <p className="mb-3 text-[11px] text-white/30">
              Clique em um produto para ver os detalhes completos.
            </p>
            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-right">Venda</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2 text-right">RAV</th>
                  </tr>
                </thead>
                <tbody>
                  {d.produtos.map((p, i) => (
                    <ProdutoRow key={i} p={p} />
                  ))}
                  <tr className="bg-white/[0.03] font-medium">
                    <td className="px-3 py-2 text-white/55">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white">
                      {formatBRL(totalVenda)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/65">
                      {formatBRL(totalCusto)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/85">
                      {formatBRL(totalRav)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Bloco>

          {/* Cobrança ao cliente */}
          {d.cobranca.length > 0 && (
            <Bloco titulo="Cobrança do cliente">
              <div className="space-y-3">
                {d.cobranca.map((c, i) => (
                  <CobrancaItemCard key={i} item={c} />
                ))}

                {/* Total */}
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-sm font-medium">
                  <span className="text-white/85">Total cobrado</span>
                  <span className="tabular-nums text-white">
                    {formatBRL(totalCobranca)}
                  </span>
                </div>
              </div>
            </Bloco>
          )}

          {/* Pagamento ao fornecedor */}
          {d.produtos.some((p) => p.pgtoForma) && (
            <Bloco titulo="Pagamento ao fornecedor">
              <div className="space-y-3">
                {d.produtos
                  .filter((p) => p.pgtoForma)
                  .map((p, i) => (
                    <PgtoFornecedorCard key={i} produto={p} />
                  ))}
              </div>
            </Bloco>
          )}

          {/* Passageiros */}
          {d.passageiros.length > 0 && (
            <Bloco titulo={`Passageiros (${d.passageiros.length})`}>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {d.passageiros.map((pax, i) => (
                  <PassageiroCard key={i} pax={pax} ordem={i + 1} />
                ))}
              </div>
            </Bloco>
          )}

          {/* Anexos — clicáveis, abrem em nova aba (signed URL) */}
          {d.anexos.length > 0 && (
            <Bloco titulo={`Anexos (${d.anexos.length})`}>
              <AnexosBloco anexos={d.anexos} />
            </Bloco>
          )}

          {/* Observações */}
          {d.observacoes && (
            <Bloco titulo="Observações">
              <p className="text-sm text-white/70">{d.observacoes}</p>
            </Bloco>
          )}
        </div>

        {/* ── Coluna direita — painel financeiro (sticky) ──────── */}
        <div className="space-y-4 lg:col-span-1 lg:sticky lg:top-0">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Resultado financeiro
            </p>

            <div className="rounded-lg border border-nexus-bright/20 bg-nexus-bright/[0.07] px-4 py-3">
              <p className="mb-0.5 text-[11px] text-white/45">Total da venda</p>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatBRL(totalVenda) || "—"}
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">Custo total</span>
                <span className="tabular-nums text-white/75">
                  {formatBRL(totalCusto) || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">RAV total</span>
                <span className="tabular-nums text-white/85">
                  {formatBRL(totalRav) || "—"}
                </span>
              </div>
              {/* Breakdown do RAV — só mostra se algum extra (cliente ou
                  fornecedor) > 0. Inclui as 3 linhas existentes (só as > 0). */}
              {(totalRavExtraCliente > 0 || totalRavExtraFornecedor > 0) && (
                <div className="space-y-1 border-l border-white/[0.05] pl-3">
                  {totalRavBase > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/40">RAV</span>
                      <span className="tabular-nums text-white/55">
                        {formatBRL(totalRavBase)}
                      </span>
                    </div>
                  )}
                  {totalRavExtraCliente > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/40">RAV extra cliente</span>
                      <span className="tabular-nums text-white/55">
                        {formatBRL(totalRavExtraCliente)}
                      </span>
                    </div>
                  )}
                  {totalRavExtraFornecedor > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/40">RAV extra fornecedor</span>
                      <span className="tabular-nums text-white/55">
                        {formatBRL(totalRavExtraFornecedor)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">Margem RAV</span>
                <span className="tabular-nums text-white/70">
                  {margemRav !== null ? `${margemRav}%` : "—"}
                </span>
              </div>
            </div>

            {mostraComissao && (
              <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/55">
                    Comissão Agente
                    {d.comissaoPercentual != null && (
                      <span className="ml-1 text-white/35">
                        ({d.comissaoPercentual}%)
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-amber-300">
                    {formatBRL(totalComissao)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-white/[0.06] pt-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">Total cobrado</span>
                <span className="tabular-nums text-white/85">
                  {formatBRL(totalCobranca) || "—"}
                </span>
              </div>
              {totalVenda > 0 &&
                totalCobranca > 0 &&
                Math.abs(totalCobranca - totalVenda) > 0.01 && (
                  <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1.5 text-[11px] leading-snug text-amber-300/90">
                    Cobrança ({formatBRL(totalCobranca)}) difere do total da
                    venda ({formatBRL(totalVenda)}).
                  </p>
                )}
            </div>
          </div>

          {/* Botões de PDF */}
          {vendaId && (
            <div className="flex flex-col gap-2">
              <a
                href={`/api/vendas/${vendaId}/comprovante`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              >
                <FileDown className="mr-2 h-3.5 w-3.5" />
                Comprovante
              </a>
              {mostraRelatorio && (
                <a
                  href={`/api/vendas/${vendaId}/relatorio`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] px-3 py-2 text-sm text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
                >
                  <FileDown className="mr-2 h-3.5 w-3.5" />
                  Relatório
                </a>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Card de passageiro ───────────────────────────────────────────────────────

type Passageiro = VendaDetalhes["passageiros"][number]

function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, "")
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function PassageiroCard({
  pax,
  ordem,
}: {
  pax: Passageiro
  ordem: number
}) {
  const temExtra = !!pax.cpf || !!pax.dataNascimento || !!pax.passaporte

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[10px] font-medium text-white/50">
          {ordem}
        </span>
        <span className="text-sm font-medium text-white/90">
          {pax.nome || <span className="italic text-white/35">Sem nome</span>}
        </span>
      </div>

      {temExtra && (
        <div className="mt-2.5 grid grid-cols-3 gap-x-6 gap-y-2">
          {pax.cpf && (
            <MiniStat label="CPF" value={formatCPF(pax.cpf)} />
          )}
          {pax.dataNascimento && (
            <MiniStat
              label="Nascimento"
              value={formatDateBR(pax.dataNascimento)}
            />
          )}
          {pax.passaporte && (
            <MiniStat label="Passaporte" value={pax.passaporte} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card de pagamento ao fornecedor ─────────────────────────────────────────

type ProdutoDetalhes = VendaDetalhes["produtos"][number]

function PgtoFornecedorCard({ produto: p }: { produto: ProdutoDetalhes }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5">
      {/* Cabeçalho: tipo de produto */}
      <div className="mb-3 flex items-center gap-1.5">
        {p.icone && (
          <span className="relative block h-3.5 w-3.5 shrink-0">
            <Image
              src={`/icons/tipos-produto/${p.icone}.png`}
              alt={p.tipoNome}
              fill
              className="object-contain"
              style={{ filter: "brightness(0) invert(1)", opacity: 0.45 }}
            />
          </span>
        )}
        <span className="text-sm font-medium text-white/85">{p.tipoNome}</span>
        {p.fornecedorNome && (
          <span className="text-[12px] text-white/40">· {p.fornecedorNome}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
        <MiniStat
          label="Forma"
          value={
            PGTO_FORMA_LABEL[p.pgtoForma as keyof typeof PGTO_FORMA_LABEL] ??
            p.pgtoForma ??
            "—"
          }
        />
        {p.pgtoCartaoNome && (
          <MiniStat label="Cartão" value={p.pgtoCartaoNome} />
        )}
        {p.pgtoValorTotal != null && (
          <MiniStat label="Valor total" value={formatBRL(p.pgtoValorTotal)} />
        )}
        {p.pgtoEntrada > 0 && (
          <MiniStat label="Entrada" value={formatBRL(p.pgtoEntrada)} />
        )}
        {p.pgtoNumParcelas > 1 ? (
          <MiniStat
            label="Parcelas"
            value={
              p.pgtoValorParcela
                ? `${p.pgtoNumParcelas}× ${formatBRL(p.pgtoValorParcela)}`
                : `${p.pgtoNumParcelas}×`
            }
          />
        ) : (
          <MiniStat label="Parcelas" value="À vista" />
        )}
        {p.pgtoDataDebito && (
          <MiniStat label="Data débito" value={formatDateBR(p.pgtoDataDebito)} />
        )}
      </div>
    </div>
  )
}

// ─── Card de item de cobrança ─────────────────────────────────────────────────

type CobrancaItem = VendaDetalhes["cobranca"][number]

function CobrancaItemCard({ item: c }: { item: CobrancaItem }) {
  const tipoLabel =
    COBRANCA_TIPO_LABEL[c.tipo as keyof typeof COBRANCA_TIPO_LABEL] ?? c.tipo

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5">
      {/* Cabeçalho: tipo + valor */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/85">{tipoLabel}</span>
        <span className="tabular-nums text-sm text-white">
          {formatBRL(c.valor)}
        </span>
      </div>

      {/* Grade de detalhes */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
        {/* Parcelas */}
        {c.parcelas > 1 && (
          <MiniStat
            label="Parcelas"
            value={
              c.valorParcela
                ? `${c.parcelas}× ${formatBRL(c.valorParcela)}`
                : `${c.parcelas}×`
            }
          />
        )}

        {/* Datas */}
        {c.dataInicio && (
          <MiniStat label="Início" value={formatDateBR(c.dataInicio)} />
        )}
        {c.dataPrimeiroRecebimento && (
          <MiniStat
            label="1º recebimento"
            value={formatDateBR(c.dataPrimeiroRecebimento)}
          />
        )}

        {/* Destino (para faturado / transferência) */}
        {c.fornecedorDestino && (
          <MiniStat label="Destino" value={c.fornecedorDestino} />
        )}

        {/* Plataforma — PagSeguro / Cielo (campo dedicado) */}
        {c.plataforma && <MiniStat label="Plataforma" value={c.plataforma} />}

        {/* URL do link de pagamento — só link_externo. Vira âncora clicável. */}
        {c.plataformaLink && c.tipo === "link_externo" && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              Link de pagamento
            </p>
            <a
              href={c.plataformaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex max-w-full items-center gap-1 break-all text-[12px] text-nexus-bright hover:text-nexus-bright-soft hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{c.plataformaLink}</span>
            </a>
          </div>
        )}

        {/* Taxa e líquido */}
        {c.taxaAdquirente != null && c.taxaAdquirente > 0 && (
          <MiniStat
            label="Taxa adquirente"
            value={`${c.taxaAdquirente}%`}
            accent="amber"
          />
        )}
        {c.valorLiquido != null && c.valorLiquido > 0 && (
          <MiniStat
            label="Valor líquido"
            value={formatBRL(c.valorLiquido)}
            accent="bright"
          />
        )}
      </div>

      {/* Detalhamento das parcelas — só quando o operador customizou */}
      {c.parcelasDetalhe && c.parcelasDetalhe.length > 0 && (
        <div className="mt-2.5 border-t border-white/[0.05] pt-2.5">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">
            Parcelas planejadas
          </p>
          <ul className="space-y-0.5">
            {c.parcelasDetalhe.map((p) => (
              <li
                key={p.ordem}
                className="flex items-center justify-between text-[12px]"
              >
                <span className="text-white/55">
                  Parcela {p.ordem}
                  {p.data && (
                    <span className="ml-2 tabular-nums text-white/45">
                      {formatDateBR(p.data)}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-white/75">
                  {formatBRL(p.valor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Comprovante de pagamento — link clicável */}
      {c.comprovanteStoragePath && c.comprovanteNomeArquivo && (
        <div className="mt-2.5 border-t border-white/[0.05] pt-2.5">
          <RevisaoComprovanteLink
            storagePath={c.comprovanteStoragePath}
            nomeArquivo={c.comprovanteNomeArquivo}
            mimeType={c.comprovanteMimeType ?? "application/pdf"}
          />
        </div>
      )}

      {/* Observações */}
      {c.observacoes && (
        <p className="mt-2.5 border-t border-white/[0.05] pt-2.5 text-[12px] text-white/50">
          {c.observacoes}
        </p>
      )}
    </div>
  )
}

function AnexosBloco({ anexos }: { anexos: VendaDetalhes["anexos"] }) {
  async function onAbrir(anexoId: string) {
    const r = await obterUrlAnexo(anexoId)
    if (!r.ok) {
      toast.error(r.error ?? "Não foi possível abrir o arquivo.")
      return
    }
    if (!r.data) return
    window.open(r.data.url, "_blank", "noopener,noreferrer")
  }

  return (
    <ul className="space-y-2">
      {anexos.map((a) => {
        const isPdf = a.mimeType === "application/pdf"
        const tamanhoMB = (a.tamanhoBytes / (1024 * 1024)).toFixed(2)
        return (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <div
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border " +
                (isPdf
                  ? "border-rose-400/30 bg-rose-400/[0.08] text-rose-300"
                  : "border-nexus-bright/30 bg-nexus-bright/[0.08] text-nexus-bright")
              }
            >
              <Paperclip className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onAbrir(a.id)}
                className="block w-full truncate text-left text-sm font-medium text-white hover:text-nexus-bright"
                title={a.nomeArquivo}
              >
                {a.nomeArquivo}
              </button>
              <p className="mt-0.5 text-[11px] text-white/45">
                {isPdf ? "PDF" : "Imagem"} · {tamanhoMB} MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAbrir(a.id)}
              title="Abrir em nova aba"
              aria-label="Abrir em nova aba"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
