import React from "react"
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import { CORES, formatBRL } from "./pdf-utils"
import type { RelatorioTipoProdutoDados } from "@/lib/relatorios/tipo-produto"

// Cor primária da marca (header + KPI principal). Como o relatório pode
// abranger as duas empresas, usamos o azul-petróleo institucional Nexus.
const COR = CORES.nexusDeep

// ─── Estilos (espelham o padrão do Relatório/Comprovante de Venda) ──────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: CORES.texto,
    paddingTop: 28,
    paddingBottom: 42,
    paddingHorizontal: 0,
    backgroundColor: CORES.branco,
  },
  // ── Header (faixa full-bleed colorida + caixa escura "Confidencial")
  headerRow: { flexDirection: "row", marginTop: -28 },
  headerLeft: {
    flexGrow: 1,
    backgroundColor: COR,
    paddingHorizontal: 32,
    paddingVertical: 12,
    justifyContent: "center",
  },
  headerRight: {
    width: 168,
    paddingHorizontal: 14,
    paddingVertical: 2,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  marca: { fontSize: 17, fontFamily: "Helvetica-Bold", color: CORES.branco, letterSpacing: 0.5 },
  docTitulo: {
    fontSize: 8,
    color: CORES.branco,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    opacity: 0.8,
    marginTop: 4,
  },
  confidencialLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  confidencialSub: {
    fontSize: 5.5,
    color: CORES.branco,
    opacity: 0.65,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  body: { paddingHorizontal: 32, paddingTop: 16 },
  // ── Meta strip
  metaStrip: {
    flexDirection: "row",
    backgroundColor: CORES.fundoCard,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  metaItem: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: CORES.divisor,
    paddingRight: 10,
    marginRight: 10,
  },
  metaItemLast: { flex: 1 },
  metaLabel: {
    fontSize: 5.5,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  metaValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: CORES.texto },
  metaValueNormal: { fontSize: 8, color: CORES.texto },
  // ── KPIs
  kpiRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  kpiCard: { flex: 1, borderRadius: 3, padding: 8, alignItems: "center" },
  kpiLabel: { fontSize: 5.5, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
  kpiValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  // ── Section title
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: CORES.textoSuave,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: CORES.divisor,
  },
  // ── Tabela
  table: {
    width: "100%",
    borderRadius: 3,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: CORES.divisor,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    paddingHorizontal: 7,
    paddingVertical: 4.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    backgroundColor: CORES.fundoCard,
  },
  tableRowTotal: {
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: "#9ca3af",
    backgroundColor: CORES.fundoTabela,
  },
  th: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: { fontSize: 7.5, color: CORES.texto },
  tdSuave: { fontSize: 7.5, color: CORES.textoSuave },
  tdBold: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CORES.texto },
  vazio: {
    paddingVertical: 26,
    textAlign: "center",
    fontSize: 8,
    color: CORES.textoSuave,
  },
  // ── Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    paddingTop: 4,
  },
  footerText: { fontSize: 6, color: CORES.textoSuave },
})

// Larguras das colunas (landscape A4) — somam 100%.
const COLS = {
  data: "7%",
  id: "7%",
  empresa: "8%",
  cliente: "16%",
  vendedor: "13%",
  fornecedor: "13%",
  destino: "11%",
  valor: "8.5%",
  custo: "8.5%",
  rav: "8.5%",
  comissao: "8.5%",
} as const

function brDate(iso: string): string {
  if (!iso || iso.length !== 10) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function RelatorioTipoProdutoPDF({
  dados,
  geradoEm,
}: {
  dados: RelatorioTipoProdutoDados
  geradoEm: string
}) {
  const { tipoProdutoNome, filtros, linhas, totais } = dados
  const margem =
    totais.margemPercentual != null ? `${totais.margemPercentual.toFixed(1)}%` : "—"

  return (
    <Document
      title={`Relatório de Vendas — ${tipoProdutoNome}`}
      author="Nexus · Magic Trips"
      subject="Relatório de Vendas por Tipo de Produto (Uso Interno)"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={s.headerRow} fixed>
          <View style={s.headerLeft}>
            <Text style={s.marca}>Nexus · Magic Trips</Text>
            <Text style={s.docTitulo}>
              Relatório de Vendas por Tipo de Produto · Uso Interno
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.confidencialLabel}>Confidencial</Text>
            <Text style={s.confidencialSub}>Não compartilhar</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Meta strip ───────────────────────────────────────── */}
          <View style={s.metaStrip}>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Tipo de produto</Text>
              <Text style={s.metaValue}>{tipoProdutoNome}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Período</Text>
              <Text style={s.metaValue}>
                {brDate(filtros.dataInicio)} a {brDate(filtros.dataFim)}
              </Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Vendas / Produtos</Text>
              <Text style={s.metaValueNormal}>
                {totais.qtdVendas} venda(s) · {totais.qtdProdutos} produto(s)
              </Text>
            </View>
            <View style={s.metaItemLast}>
              <Text style={s.metaLabel}>Gerado em</Text>
              <Text style={s.metaValueNormal}>{geradoEm}</Text>
            </View>
          </View>

          {/* ── KPIs ─────────────────────────────────────────────── */}
          <View style={s.kpiRow}>
            <View style={[s.kpiCard, { backgroundColor: COR + "18", borderWidth: 0.5, borderColor: COR + "44" }]}>
              <Text style={[s.kpiLabel, { color: COR }]}>Total vendido</Text>
              <Text style={[s.kpiValue, { color: COR }]}>{formatBRL(totais.valorVenda)}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: "#f3f4f6", borderWidth: 0.5, borderColor: CORES.divisor }]}>
              <Text style={[s.kpiLabel, { color: CORES.textoSuave }]}>Custo total</Text>
              <Text style={[s.kpiValue, { color: CORES.texto }]}>{formatBRL(totais.valorCusto)}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: "#ecfdf5", borderWidth: 0.5, borderColor: "#a7f3d0" }]}>
              <Text style={[s.kpiLabel, { color: "#065f46" }]}>RAV total</Text>
              <Text style={[s.kpiValue, { color: "#065f46" }]}>{formatBRL(totais.ravTotal)}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: "#eff6ff", borderWidth: 0.5, borderColor: "#bfdbfe" }]}>
              <Text style={[s.kpiLabel, { color: "#1e40af" }]}>Margem (RAV / venda)</Text>
              <Text style={[s.kpiValue, { color: "#1e40af" }]}>{margem}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: "#fffbeb", borderWidth: 0.5, borderColor: "#fde68a" }]}>
              <Text style={[s.kpiLabel, { color: "#92400e" }]}>Comissões</Text>
              <Text style={[s.kpiValue, { color: "#92400e" }]}>{formatBRL(totais.comissao)}</Text>
            </View>
          </View>

          {/* ── Detalhamento ─────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Detalhamento das vendas</Text>
            <View style={s.table}>
              {/* head (repete a cada página) */}
              <View style={s.tableHead} fixed>
                <Text style={[s.th, { width: COLS.data }]}>Data</Text>
                <Text style={[s.th, { width: COLS.id }]}>ID</Text>
                <Text style={[s.th, { width: COLS.empresa }]}>Empresa</Text>
                <Text style={[s.th, { width: COLS.cliente }]}>Cliente</Text>
                <Text style={[s.th, { width: COLS.vendedor }]}>Vendedor(a)</Text>
                <Text style={[s.th, { width: COLS.fornecedor }]}>Fornecedor</Text>
                <Text style={[s.th, { width: COLS.destino }]}>Destino</Text>
                <Text style={[s.th, { width: COLS.valor, textAlign: "right" }]}>Valor</Text>
                <Text style={[s.th, { width: COLS.custo, textAlign: "right" }]}>Custo</Text>
                <Text style={[s.th, { width: COLS.rav, textAlign: "right" }]}>RAV</Text>
                <Text style={[s.th, { width: COLS.comissao, textAlign: "right" }]}>Comissão</Text>
              </View>

              {linhas.length === 0 ? (
                <Text style={s.vazio}>
                  Nenhuma venda aprovada encontrada nesse período para o tipo selecionado.
                </Text>
              ) : (
                linhas.map((l, i) => (
                  <View key={`${l.vendaId}-${i}`} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                    <Text style={[s.tdSuave, { width: COLS.data }]}>{brDate(l.dataVenda)}</Text>
                    <Text style={[s.tdSuave, { width: COLS.id }]}>{l.identificador || "—"}</Text>
                    <Text style={[s.tdSuave, { width: COLS.empresa }]}>{l.empresa || "—"}</Text>
                    <Text style={[s.td, { width: COLS.cliente }]}>{l.cliente || "—"}</Text>
                    <Text style={[s.tdSuave, { width: COLS.vendedor }]}>{l.vendedor || "—"}</Text>
                    <Text style={[s.tdSuave, { width: COLS.fornecedor }]}>{l.fornecedor || "—"}</Text>
                    <Text style={[s.tdSuave, { width: COLS.destino }]}>{l.destino || "—"}</Text>
                    <Text style={[s.td, { width: COLS.valor, textAlign: "right" }]}>{formatBRL(l.valorVenda)}</Text>
                    <Text style={[s.tdSuave, { width: COLS.custo, textAlign: "right" }]}>{formatBRL(l.valorCusto)}</Text>
                    <Text style={[s.tdBold, { width: COLS.rav, textAlign: "right" }]}>{formatBRL(l.ravTotal)}</Text>
                    <Text style={[s.td, { width: COLS.comissao, textAlign: "right" }]}>{formatBRL(l.comissao)}</Text>
                  </View>
                ))
              )}

              {linhas.length > 0 && (
                <View style={s.tableRowTotal}>
                  <Text style={[s.tdBold, { width: COLS.data }]} />
                  <Text style={[s.tdBold, { width: COLS.id }]} />
                  <Text style={[s.tdBold, { width: COLS.empresa }]} />
                  <Text style={[s.tdBold, { width: COLS.cliente }]}>TOTAL</Text>
                  <Text style={[s.tdBold, { width: COLS.vendedor }]} />
                  <Text style={[s.tdBold, { width: COLS.fornecedor }]} />
                  <Text style={[s.tdBold, { width: COLS.destino }]} />
                  <Text style={[s.tdBold, { width: COLS.valor, textAlign: "right" }]}>{formatBRL(totais.valorVenda)}</Text>
                  <Text style={[s.tdSuave, { width: COLS.custo, textAlign: "right" }]}>{formatBRL(totais.valorCusto)}</Text>
                  <Text style={[s.tdBold, { width: COLS.rav, textAlign: "right" }]}>{formatBRL(totais.ravTotal)}</Text>
                  <Text style={[s.tdBold, { width: COLS.comissao, textAlign: "right" }]}>{formatBRL(totais.comissao)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Nexus · Magic Trips · Relatório por tipo de produto · {geradoEm} · CONFIDENCIAL
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
