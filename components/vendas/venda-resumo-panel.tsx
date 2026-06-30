"use client"

import { type ReactNode, useState } from "react"
import Image from "next/image"
import { CheckCircle, AlertTriangle, ChevronDown, ExternalLink, FileDown, Paperclip, Pencil } from "lucide-react"
import { toast } from "sonner"
import { formatBRL } from "@/lib/utils/sum-parser"
import { COBRANCA_TIPO_LABEL, PGTO_FORMA_LABEL } from "@/lib/schemas/venda"
import type { VendaDetalhes } from "@/app/(dashboard)/vendas/actions"
import { obterUrlAnexo } from "@/app/(dashboard)/vendas/anexos-actions"
import { RevisaoComprovanteLink } from "./comprovante-cobranca-upload"
import { AlteracaoComparisonCard } from "./alteracao-comparison-card"
import { cn } from "@/lib/utils"

function formatDateBR(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/** Em alteração, números podem ser negativos e o sinal importa. Prefixa
 *  +/- explicitamente; em vendas normais delega pro formatBRL padrão. */
function formatDelta(valor: number, delta: boolean): string {
  if (!delta) return formatBRL(valor) || "—"
  if (Math.abs(valor) < 0.01) return formatBRL(0)
  const formatted = formatBRL(Math.abs(valor))
  return valor > 0 ? `+ ${formatted}` : `- ${formatted}`
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
    p.ravComissionado > 0 ||
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

                {/* RAV comissionado */}
                {p.ravComissionado > 0 && (
                  <MiniStat
                    label="RAV Comissionado"
                    value={formatBRL(p.ravComissionado)}
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
                    {p.pgtoNumParcelasReal > 1 && (
                      <MiniStat
                        label="Parcelas"
                        value={
                          p.pgtoValorParcela
                            ? `${p.pgtoNumParcelasReal}× ${formatBRL(p.pgtoValorParcela)}`
                            : `${p.pgtoNumParcelasReal}×`
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
  compact,
}: {
  label: string
  value: ReactNode
  accent?: "amber" | "bright"
  compact?: boolean
}) {
  const valueClass =
    accent === "amber"
      ? "text-amber-300"
      : accent === "bright"
        ? "text-nexus-bright"
        : "text-white/80"

  return (
    <div>
      <p className={cn("mb-0.5 uppercase tracking-wider text-white/35", compact ? "text-[9px]" : "text-[10px]")}>
        {label}
      </p>
      <p className={cn(compact ? "text-xs" : "text-sm", valueClass)}>{value}</p>
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
  /** Render prop que injeta os botões de alteração no banner — evita import
   *  circular com VerVendaOriginalButton (que importa VendaResumoPanel). */
  renderAlteracaoBotoes?: (alteracoes: VendaDetalhes["alteracoesAprovadas"]) => React.ReactNode
  /** Override de preview: quando true, ignora o desfluxo nos cálculos
   *  exibidos (usado pelo switch "Desconsiderar desfluxo" no modal de
   *  validação). NÃO altera o banco — só a visão. Default: usa
   *  `detalhes.desfluxoAplicado` direto. */
  desconsiderarDesfluxo?: boolean
  /** Conteúdo customizado pra renderizar acima dos botões de PDF na
   *  coluna sticky. Ex: switch de desconsiderar desfluxo no validar. */
  acimaDosBotoes?: React.ReactNode
}

export function VendaResumoPanel({
  detalhes: d,
  mostraComissao,
  vendaId,
  mostraRelatorio,
  renderAlteracaoBotoes,
  desconsiderarDesfluxo,
  acimaDosBotoes,
}: Props) {
  const ehAlteracao = d.tipoVenda === "alteracao_valores"
  const temAlteracaoAprovada =
    !ehAlteracao && (d.alteracoesAprovadas?.length ?? 0) > 0
  const totalVenda = d.produtos.reduce((a, p) => a + p.valorVenda, 0)
  const totalCusto = d.produtos.reduce((a, p) => a + p.valorCusto, 0)
  // RAV total = Venda − Custo (campo `rav`). As 3 fatias (Extra Cliente,
  // Extra Fornecedor, Comissionado) são uma DECOMPOSIÇÃO do RAV — elas
  // somam ele, não somam por cima. Os subtotais ficam pra exibir o
  // breakdown na coluna direita.
  const totalRavBase = d.produtos.reduce((a, p) => a + p.rav, 0)
  const totalRavExtraCliente = d.produtos.reduce(
    (a, p) => a + p.ravExtraCliente,
    0,
  )
  const totalRavExtraFornecedor = d.produtos.reduce(
    (a, p) => a + p.ravExtraFornecedor,
    0,
  )
  const totalRavComissionado = d.produtos.reduce(
    (a, p) => a + p.ravComissionado,
    0,
  )
  const totalRav = totalRavBase
  // Desfluxo: quando aplicado, sobrepõe valor_custo com custo_efetivo =
  // custo_base × (1 + %/100), reduzindo RAV e comissão. valor_custo real
  // continua no banco (parcelas_pagar usam o real).
  // Override de preview pelo switch "Desconsiderar desfluxo" no validar.
  const desfluxoAtivoEfetivo = desconsiderarDesfluxo
    ? false
    : d.desfluxoAplicado
  const desfluxoPercentualEfetivo = desfluxoAtivoEfetivo
    ? d.desfluxoPercentual
    : 0
  const desfluxoCustoExtra =
    (d.produtos.reduce((a, p) => a + p.valorCusto, 0) *
      desfluxoPercentualEfetivo) /
    100
  // Taxas de cobrança (PagSeguro/Cielo/faturado): % cobrado do cliente
  // que a agência repassa pra plataforma. É CUSTO da agência — entra no
  // custo efetivo, reduz RAV e comissão. Cada item de cobrança tem sua
  // própria taxa aplicada ao valor base (sem somar com a inflação que já
  // foi pro cliente no campo `valor`).
  const totalTaxasCobranca = d.cobranca.reduce(
    (a, c) => a + (c.valor * (c.taxaCobranca ?? 0)) / 100,
    0,
  )
  // Comissão = RAV total × % do agente. Recalculada AQUI em vez de somar
  // `p.comissao` armazenado em DB — garante que vendas antigas (gravadas com
  // base que excluía rav_extra_fornecedor) também exibam o valor correto
  // pela regra atual.
  //
  // Em alteração: Δ Comissão = comissão_efetiva − comissão_original.
  // A comissão pode mudar por DOIS motivos: RAV mudou OU a % mudou (troca
  // de origem). Calcular apenas (%_nova × ΔRAV) ignora o caso em que só a
  // origem mudou — o usuário verá Δ=0 mesmo com comissão muito diferente.
  // Por isso, em alteração, calculamos os dois lados (original e efetivo)
  // e subtraímos. Em venda original (não-alteração), basta `% × RAV total`.
  const totalComissao = (() => {
    if (!ehAlteracao || !d.vendaOriginal) {
      // Custo efetivo (com desfluxo + taxas de cobrança) reduz o RAV
      // antes da comissão.
      const ravComDeducoes = totalRav - desfluxoCustoExtra - totalTaxasCobranca
      return ((d.comissaoPercentual ?? 0) * ravComDeducoes) / 100
    }
    const ravOriginal = d.vendaOriginal.produtos.reduce(
      // RAV total = soma do campo `rav`. Os 3 extras são decomposição.
      (a, p) => a + p.rav,
      0,
    )
    const ravEfetivo = ravOriginal + totalRav // totalRav aqui é o Δ
    const comissaoNova = (d.comissaoPercentual ?? 0) * ravEfetivo / 100
    const comissaoAntiga =
      (d.vendaOriginal.comissaoPercentual ?? 0) * ravOriginal / 100
    return comissaoNova - comissaoAntiga
  })()
  const totalCobranca = d.cobranca.reduce((a, c) => a + c.valor, 0)
  const margemRav =
    totalVenda > 0 ? ((totalRav / totalVenda) * 100).toFixed(1) : null

  // Quando é alteração, totalizamos os valores ORIGINAIS pra exibir o
  // subtítulo "orig R$ X → efet R$ Y" em cada linha do painel de
  // resultado. Mantém o validador com o cenário completo sem precisar
  // alternar pra outra tela.
  const orig = ehAlteracao && d.vendaOriginal ? d.vendaOriginal : null
  const origVenda = orig?.produtos.reduce((a, p) => a + p.valorVenda, 0) ?? 0
  const origCusto = orig?.produtos.reduce((a, p) => a + p.valorCusto, 0) ?? 0
  const origRav =
    orig?.produtos.reduce(
      // RAV total = soma do campo `rav`. Os 3 extras são decomposição.
      (a, p) => a + p.rav,
      0,
    ) ?? 0
  const origComissao = ((orig?.comissaoPercentual ?? 0) * origRav) / 100
  const efetVenda = origVenda + totalVenda
  const efetCusto = origCusto + totalCusto
  const efetRav = origRav + totalRav
  const efetComissao = ((d.comissaoPercentual ?? 0) * efetRav) / 100

  return (
    <div className="space-y-4">
      {/* Banner de alteração(ões) aprovada(s) — só aparece na venda ORIGINAL
          que já teve mudança consolidada por cima. Link abre o modal da
          alteração mais recente; relatório consolidado vive lá. */}
      {temAlteracaoAprovada && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2.5 text-sm text-amber-300">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 shrink-0" />
            <span>
              Esta venda tem{" "}
              <strong>
                {d.alteracoesAprovadas.length}{" "}
                {d.alteracoesAprovadas.length === 1
                  ? "alteração aprovada"
                  : "alterações aprovadas"}
              </strong>
              . O relatório consolidado é gerado a partir da alteração.
            </span>
          </div>
          {renderAlteracaoBotoes && (
            <div className="flex flex-wrap items-center gap-2">
              {renderAlteracaoBotoes(d.alteracoesAprovadas)}
            </div>
          )}
        </div>
      )}

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

      {/* Banner explicativo quando alteração — vem ANTES do card de
          comparação pra introduzir o contexto antes de mostrar os
          números. Deixa claro pro validador que os valores em "Produtos"
          e "Resultado financeiro" são DELTAS, não absolutos. */}
      {ehAlteracao && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-sm text-amber-300/85">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium text-amber-300">Esta é uma alteração de venda</p>
            <p className="mt-0.5 text-amber-300/70">
              Os valores em &ldquo;Produtos&rdquo; e &ldquo;Resultado financeiro&rdquo;
              abaixo representam apenas as <strong>diferenças</strong> em relação
              à venda original. O comparativo Original → Δ → Efetivo está logo abaixo.
            </p>
          </div>
        </div>
      )}

      {/* Card de comparação Original → Δ → Efetivo (só em alterações). */}
      {ehAlteracao && d.vendaOriginal && (
        <AlteracaoComparisonCard
          vendaOriginal={{
            id: d.vendaOriginal.id,
            identificador: d.vendaOriginal.identificador,
            clienteNome: d.vendaOriginal.clienteNome,
            origem: d.vendaOriginal.origem,
            comissaoPercentual: d.vendaOriginal.comissaoPercentual,
            produtos: d.vendaOriginal.produtos.map((p) => ({
              tipo_produto_nome: p.tipoProdutoNome,
              fornecedor_nome: p.fornecedorNome,
              valor_venda: p.valorVenda,
              valor_custo: p.valorCusto,
              rav: p.rav,
            })),
          }}
          alteracao={{
            clienteNome: d.clienteNome,
            origem: d.origem,
            comissaoPercentual: d.comissaoPercentual,
            produtos: d.produtos.map((p) => ({
              tipo_produto_nome: p.tipoNome,
              fornecedor_nome: p.fornecedorNome,
              valor_venda: p.valorVenda,
              valor_custo: p.valorCusto,
              rav: p.rav,
            })),
          }}
        />
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
                    <th className="px-3 py-2 text-right">{ehAlteracao ? "Δ Venda" : "Venda"}</th>
                    <th className="px-3 py-2 text-right">{ehAlteracao ? "Δ Custo" : "Custo"}</th>
                    <th className="px-3 py-2 text-right">{ehAlteracao ? "Δ RAV" : "RAV"}</th>
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

          {/* Pagamento ao fornecedor — vem ANTES da cobrança pra espelhar
              a ordem do Step 6 da wizard (Produtos → Pagamento → Cobrança). */}
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

          {/* Cobrança ao cliente */}
          {d.cobranca.length > 0 && (
            <Bloco titulo="Cobrança do cliente">
              <div className="space-y-3">
                {d.cobranca.map((c, i) => (
                  <CobrancaItemCard key={i} item={c} />
                ))}

                {/* Total cobrado — soma o que o cliente efetivamente paga
                    (base + taxa de cada item). Quando algum item tem taxa,
                    mostra "base + R$ X taxas" abaixo em texto fino pra
                    explicar a composição. */}
                {(() => {
                  const totalTaxas = d.cobranca.reduce(
                    (a, c) => a + (c.valor * (c.taxaCobranca ?? 0)) / 100,
                    0,
                  )
                  const totalComTaxa = totalCobranca + totalTaxas
                  const temAlgumaTaxa = totalTaxas > 0.005
                  return (
                    <div className="space-y-0.5 border-t border-white/[0.06] pt-3">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span className="text-white/85">Total cobrado</span>
                        <span className="tabular-nums text-white">
                          {formatBRL(totalComTaxa)}
                        </span>
                      </div>
                      {temAlgumaTaxa && (
                        <p className="text-right text-[10px] tabular-nums text-white/40">
                          {formatBRL(totalCobranca)} + {formatBRL(totalTaxas)} taxas
                        </p>
                      )}
                    </div>
                  )
                })()}
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

          {/* Anexos — bloco SEMPRE visível pro gerente conferir o que o
              agente subiu. Quando vazio, mostra estado central "sem anexos". */}
          <Bloco
            titulo={
              d.anexos.length > 0
                ? `Anexos (${d.anexos.length})`
                : "Anexos"
            }
          >
            {d.anexos.length > 0 ? (
              <AnexosBloco anexos={d.anexos} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-6 text-center">
                <Paperclip className="h-4 w-4 text-white/30" />
                <p className="text-xs text-white/45">
                  Nenhum anexo foi adicionado a esta venda.
                </p>
              </div>
            )}
          </Bloco>

          {/* Observações */}
          {d.observacoes && (
            <Bloco titulo="Observações">
              <p className="text-sm text-white/70">{d.observacoes}</p>
            </Bloco>
          )}
        </div>

        {/* ── Coluna direita — painel financeiro (sticky) ──────── */}
        <div className="space-y-4 lg:col-span-1 lg:sticky lg:top-0">
          <div className={cn(
            "rounded-xl border p-5",
            ehAlteracao
              ? "border-amber-500/20 bg-amber-500/[0.04]"
              : "border-white/[0.08] bg-white/[0.03]",
          )}>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              {ehAlteracao ? "Resultado da alteração" : "Resultado financeiro"}
            </p>

            <div className={cn(
              "rounded-lg border px-4 py-3",
              ehAlteracao
                ? "border-amber-500/25 bg-amber-500/[0.07]"
                : "border-nexus-bright/20 bg-nexus-bright/[0.07]",
            )}>
              <p className="mb-0.5 text-[11px] text-white/45">
                {ehAlteracao ? "Δ Receita" : "Total da venda"}
              </p>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatDelta(totalVenda, ehAlteracao)}
              </p>
              {ehAlteracao && (
                <OrigEfet original={origVenda} efetivo={efetVenda} />
              )}
            </div>

            {/* Métricas — espelha layout do Step 6 do wizard. Custo/RAV
                exibidos em BASE (sem deduções); deduções (desfluxo + taxa
                de cobrança) aparecem em bloco âmbar logo abaixo com seus
                próprios "Custo efetivo / RAV Efetivo". */}
            <div className="mt-4 space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/55">
                    {ehAlteracao ? "Δ Custo" : "Custo total"}
                  </span>
                  <span className="tabular-nums text-white/75">
                    {formatDelta(totalCusto, ehAlteracao)}
                  </span>
                </div>
                {ehAlteracao && (
                  <OrigEfet
                    original={origCusto}
                    efetivo={efetCusto}
                    align="right"
                  />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/55">
                    {ehAlteracao ? "Δ RAV" : "RAV total"}
                  </span>
                  <span className="tabular-nums text-white/85">
                    {formatDelta(totalRav, ehAlteracao)}
                  </span>
                </div>
                {ehAlteracao && (
                  <OrigEfet
                    original={origRav}
                    efetivo={efetRav}
                    align="right"
                  />
                )}
              </div>

              {/* Breakdown do RAV — SEMPRE as 3 fatias quando totalRav > 0,
                  mesmo que zero. O "RAV cheio" já está em "RAV total" acima. */}
              {totalRav > 0 && (
                <div className="space-y-1 border-l border-white/[0.05] pl-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">RAV extra cliente</span>
                    <span className="tabular-nums text-white/55">
                      {formatBRL(totalRavExtraCliente)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">RAV extra fornecedor</span>
                    <span className="tabular-nums text-white/55">
                      {formatBRL(totalRavExtraFornecedor)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">RAV comissionado</span>
                    <span className="tabular-nums text-white/55">
                      {formatBRL(totalRavComissionado)}
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Deduções (desfluxo + taxa de cobrança) — só em vendas normais
                e quando há algum efeito. Espelha o bloco âmbar do Step 6
                da wizard: linhas por dedução + Custo efetivo + RAV Efetivo. */}
            {!ehAlteracao &&
              ((desfluxoAtivoEfetivo && d.desfluxoPercentual > 0) ||
                totalTaxasCobranca > 0) && (
                <div className="mt-4 space-y-1 text-sm">
                  {desfluxoAtivoEfetivo && d.desfluxoPercentual > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-amber-300/85">
                        Desfluxo ({d.desfluxoMeses}{" "}
                        {d.desfluxoMeses === 1 ? "mês" : "meses"}):
                      </span>
                      <span className="tabular-nums text-amber-300/85">
                        {d.desfluxoPercentual
                          .toFixed(2)
                          .replace(".", ",")}
                        %
                      </span>
                    </div>
                  )}
                  {totalTaxasCobranca > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-amber-300/85">Taxa de cobrança:</span>
                      <span className="tabular-nums text-amber-300/85">
                        {formatBRL(totalTaxasCobranca)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300/85">Custo efetivo:</span>
                    <span className="tabular-nums text-amber-300/85">
                      {formatBRL(
                        totalCusto + desfluxoCustoExtra + totalTaxasCobranca,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300/85">RAV Efetivo:</span>
                    <span className="tabular-nums text-amber-300/85">
                      {formatBRL(
                        totalRav - desfluxoCustoExtra - totalTaxasCobranca,
                      )}
                    </span>
                  </div>
                </div>
              )}

            {mostraComissao && (
              <div className="mt-4 space-y-1 border-t border-white/[0.06] pt-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/55">
                    {ehAlteracao ? "Δ Comissão Agente" : "Comissão Agente"}
                    {d.comissaoPercentual != null && (
                      <span className="ml-1 text-white/35">
                        ({d.comissaoPercentual}%)
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums",
                      !ehAlteracao &&
                        desfluxoAtivoEfetivo &&
                        d.desfluxoPercentual > 0
                        ? "text-amber-300"
                        : "text-white/85",
                    )}
                  >
                    {formatDelta(totalComissao, ehAlteracao)}
                  </span>
                </div>
                {ehAlteracao && (
                  <OrigEfet
                    original={origComissao}
                    efetivo={efetComissao}
                    align="right"
                  />
                )}
              </div>
            )}

            {/* Margem RAV — não faz sentido em delta. Em vendas normais
                reflete RAV efetivo quando há deduções (mesma família visual
                das outras métricas, sem destaque de cor). */}
            {!ehAlteracao && (() => {
              const ravParaMargem =
                totalRav - desfluxoCustoExtra - totalTaxasCobranca
              const margemEfetiva =
                totalVenda > 0
                  ? ((ravParaMargem / totalVenda) * 100).toFixed(1)
                  : null
              return (
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-sm">
                  <span className="text-white/55">Margem RAV</span>
                  <span className="tabular-nums text-white/70">
                    {margemEfetiva !== null ? `${margemEfetiva}%` : "—"}
                  </span>
                </div>
              )
            })()}

            {/* Total cobrado = o que o cliente paga, somando taxas das
                plataformas. Divergência ainda compara contra o total
                de venda BASE (sem taxa), que é o que foi vendido. */}
            <div className={cn("border-t border-white/[0.06] pt-3.5", ehAlteracao ? "mt-4" : "mt-2.5")}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">
                  {ehAlteracao ? "Δ Total cobrado" : "Total cobrado"}
                </span>
                <span className="tabular-nums text-white/85">
                  {formatDelta(
                    totalCobranca + (ehAlteracao ? 0 : totalTaxasCobranca),
                    ehAlteracao,
                  )}
                </span>
              </div>
              {!ehAlteracao &&
                totalVenda > 0 &&
                totalCobranca > 0 &&
                Math.abs(totalCobranca - totalVenda) > 0.01 && (
                  <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1.5 text-[11px] leading-snug text-amber-300/90">
                    Cobrança ({formatBRL(totalCobranca)}) difere do total da
                    venda ({formatBRL(totalVenda)}).
                  </p>
                )}
            </div>
          </div>

          {/* Slot pra conteúdo extra acima dos botões de PDF (ex: switch
              "Desconsiderar desfluxo" no modal de validação). */}
          {acimaDosBotoes}

          {/* Botões de PDF.
              - Comprovante: NÃO aparece em alterações (o documento da
                alteração é a própria alteração; relatório fala por ela).
              - Relatório: na ORIGINAL que tem alteração aprovada fica
                disabled — o relatório consolidado vive na alteração
                (onde os deltas já estão somados na visão final). */}
          {vendaId && (
            <div className="flex flex-col gap-2">
              {!ehAlteracao && (
                <a
                  href={`/api/vendas/${vendaId}/comprovante`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                >
                  <FileDown className="mr-2 h-3.5 w-3.5" />
                  Comprovante
                </a>
              )}
              {mostraRelatorio && temAlteracaoAprovada ? (
                <button
                  type="button"
                  disabled
                  title="Esta venda tem alteração aprovada — abra o relatório a partir da alteração mais recente."
                  className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/35"
                >
                  <FileDown className="mr-2 h-3.5 w-3.5" />
                  Relatório
                </button>
              ) : mostraRelatorio ? (
                <a
                  href={`/api/vendas/${vendaId}/relatorio`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] px-3 py-2 text-sm text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
                >
                  <FileDown className="mr-2 h-3.5 w-3.5" />
                  Relatório
                </a>
              ) : null}
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

/**
 * Subtítulo "orig R$ X → efet R$ Y" exibido abaixo de cada linha do
 * painel de Resultado da alteração. Dá ao validador o cenário completo
 * (antes/depois) além do delta. Usa cor apagada pra não competir com a
 * linha principal.
 */
function OrigEfet({
  original,
  efetivo,
  align = "left",
}: {
  original: number
  efetivo: number
  align?: "left" | "right"
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-[11px] tabular-nums text-white/40",
        align === "right" && "justify-end",
      )}
    >
      <span>orig {formatBRL(original)}</span>
      <span className="text-white/25">→</span>
      <span className="text-white/65">efet {formatBRL(efetivo)}</span>
    </p>
  )
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
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
          {pax.cpf && (
            <MiniStat
              label="Identificação"
              value={formatCPF(pax.cpf)}
              compact
            />
          )}
          {pax.dataNascimento && (
            <MiniStat
              label="Nascimento"
              value={formatDateBR(pax.dataNascimento)}
              compact
            />
          )}
          {pax.passaporte && (
            <MiniStat label="Passaporte" value={pax.passaporte} compact />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card de pagamento ao fornecedor ─────────────────────────────────────────

type ProdutoDetalhes = VendaDetalhes["produtos"][number]

function PgtoFornecedorCard({ produto: p }: { produto: ProdutoDetalhes }) {
  const formaLabel =
    p.pgtoForma === "cartao_agencia" && p.pgtoCartaoNome
      ? `Cartão Agência — ${p.pgtoCartaoNome}`
      : PGTO_FORMA_LABEL[p.pgtoForma as keyof typeof PGTO_FORMA_LABEL] ??
        p.pgtoForma ??
        "—"
  // Parcelas calculadas pra cartao_agencia (faturado já vem do array).
  const showParcelasCartao =
    p.pgtoForma === "cartao_agencia" && p.pgtoNumParcelas > 1
  const totalPgto = p.pgtoValorTotal ?? 0
  const extra = p.pgtoPrimeiraParcelaExtra || 0
  const baseParcela = showParcelasCartao
    ? (totalPgto - p.pgtoEntrada - extra) / p.pgtoNumParcelas
    : 0
  const primeiraParcela = baseParcela + extra
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5">
      {/* Cabeçalho: tipo + fornecedor */}
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
            <span>
              {formaLabel}
              {(p.pgtoForma === "cartao_agencia" ||
                p.pgtoForma === "faturado") &&
                p.pgtoNumParcelasReal > 1 && (
                  <span className="ml-1 text-white/55">
                    · {p.pgtoNumParcelasReal}x
                  </span>
                )}
            </span>
          }
        />
        {p.pgtoValorTotal != null && p.pgtoValorTotal > 0 && (
          <MiniStat label="Valor total" value={formatBRL(p.pgtoValorTotal)} />
        )}
        {p.pgtoForma === "cartao_agencia" && p.pgtoDataDebito && (
          <MiniStat
            label="Data de entrada"
            value={formatDateBR(p.pgtoDataDebito)}
          />
        )}
        {p.pgtoForma === "cartao_agencia" && p.pgtoEntrada > 0 && (
          <MiniStat label="Entrada" value={formatBRL(p.pgtoEntrada)} />
        )}
        {showParcelasCartao && (
          <MiniStat
            label="Parcelas"
            value={
              extra > 0
                ? `${p.pgtoNumParcelas}x — 1ª ${formatBRL(primeiraParcela)} · demais ${formatBRL(baseParcela)}`
                : `${p.pgtoNumParcelas}x de ${formatBRL(baseParcela)}`
            }
          />
        )}
        {extra > 0 && (
          <MiniStat
            label="Taxa na 1ª parcela"
            value={
              <span className="text-nexus-bright">{formatBRL(extra)}</span>
            }
          />
        )}
      </div>

      {/* Parcelas detalhadas — faturado: vem do array. Cartão agência:
          geradas em runtime. Mesmo padrão visual do Step 6 (wizard). */}
      {(() => {
        type Linha = { ordem: number; valor: number; data: string | null }
        let linhas: Linha[] = []
        if (p.pgtoForma === "faturado" && p.pgtoParcelasFaturado.length > 0) {
          linhas = p.pgtoParcelasFaturado
        } else if (showParcelasCartao) {
          linhas = Array.from({ length: p.pgtoNumParcelas }, (_, i) => ({
            ordem: i + 1,
            valor: i === 0 ? primeiraParcela : baseParcela,
            data: null,
          }))
        }
        if (linhas.length < 2) return null
        return (
          <div className="mt-3 border-t border-white/[0.05] pt-2.5">
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">
              Parcelas
            </p>
            <ul className="space-y-0.5">
              {linhas.map((l) => (
                <li
                  key={l.ordem}
                  className="flex items-baseline gap-2 text-[11px]"
                >
                  <span className="w-4 shrink-0 text-right tabular-nums text-white/45">
                    {l.ordem}.
                  </span>
                  <span className="shrink-0 tabular-nums text-white/55">
                    {l.data ? formatDateBR(l.data) : "—"}
                  </span>
                  <span
                    className="mx-1 flex-1 border-b border-dotted border-white/[0.12]"
                    aria-hidden
                  />
                  <span className="shrink-0 tabular-nums text-white/80">
                    {formatBRL(l.valor)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Card de item de cobrança ─────────────────────────────────────────────────

type CobrancaItem = VendaDetalhes["cobranca"][number]

function CobrancaItemCard({ item: c }: { item: CobrancaItem }) {
  const tipoLabel =
    COBRANCA_TIPO_LABEL[c.tipo as keyof typeof COBRANCA_TIPO_LABEL] ?? c.tipo
  const taxa = c.taxaCobranca ?? 0
  const totalComTaxa = c.valor + (c.valor * taxa) / 100
  const temTaxa = taxa > 0

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5">
      {/* Cabeçalho: tipo + nº de parcelas + plataforma (pill) + valor.
          Quando há taxa, mostra total c/ taxa em destaque e "base + X%"
          abaixo em texto fino — é o que o cliente efetivamente paga. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-white/85">{tipoLabel}</span>
          {c.parcelas > 1 && (
            <span className="text-[12px] text-white/45">· {c.parcelas}x</span>
          )}
          {c.plataforma && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/55">
              {c.plataforma}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="tabular-nums text-sm text-white">
            {formatBRL(temTaxa ? totalComTaxa : c.valor)}
          </p>
          {temTaxa && (
            <p className="text-[10px] tabular-nums text-white/40">
              {formatBRL(c.valor)} + {taxa.toString().replace(".", ",")}% taxa
            </p>
          )}
        </div>
      </div>

      {/* Grade de detalhes — só Datas / Destino / Taxa adquirente / Líquido.
          (Plataforma + parcelas migraram pro header; link migrou pra baixo.) */}
      {(c.dataInicio ||
        c.dataPrimeiroRecebimento ||
        c.fornecedorDestino ||
        (c.taxaAdquirente != null && c.taxaAdquirente > 0) ||
        (c.valorLiquido != null && c.valorLiquido > 0)) && (
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
          {c.dataInicio && (
            <MiniStat label="Início" value={formatDateBR(c.dataInicio)} />
          )}
          {c.dataPrimeiroRecebimento && (
            <MiniStat
              label="1º recebimento"
              value={formatDateBR(c.dataPrimeiroRecebimento)}
            />
          )}
          {c.fornecedorDestino && (
            <MiniStat label="Destino" value={c.fornecedorDestino} />
          )}
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
      )}

      {/* URL do link de pagamento — só link_externo. Vira âncora clicável. */}
      {c.plataformaLink && c.tipo === "link_externo" && (
        <a
          href={c.plataformaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-[11px] text-nexus-bright hover:text-nexus-bright-soft hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{c.plataformaLink}</span>
        </a>
      )}

      {/* Detalhamento das parcelas — mesmo padrão da wizard:
          "1.  10/07/2026 ........ R$ 540,00" */}
      {c.parcelasDetalhe && c.parcelasDetalhe.length > 1 && (
        <div className="mt-3 border-t border-white/[0.05] pt-2.5">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">
            Parcelas
          </p>
          <ul className="space-y-0.5">
            {c.parcelasDetalhe.map((p) => (
              <li
                key={p.ordem}
                className="flex items-baseline gap-2 text-[11px]"
              >
                <span className="w-4 shrink-0 text-right tabular-nums text-white/45">
                  {p.ordem}.
                </span>
                <span className="shrink-0 tabular-nums text-white/55">
                  {p.data ? formatDateBR(p.data) : "—"}
                </span>
                <span
                  className="mx-1 flex-1 border-b border-dotted border-white/[0.12]"
                  aria-hidden
                />
                <span className="shrink-0 tabular-nums text-white/80">
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
