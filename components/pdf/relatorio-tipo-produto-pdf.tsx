import React from "react"
import {
  Document,
  Image,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import { CORES, formatBRL } from "./pdf-utils"
import type { RelatorioTipoProdutoDados } from "@/lib/relatorios/tipo-produto"

const DEEP = CORES.nexusDeep // #004E5A
const BRIGHT = CORES.nexusBright // #1498D5

// ─── Estilos ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: CORES.texto,
    paddingTop: 0,
    paddingBottom: 42,
    backgroundColor: CORES.branco,
  },
  // ── Header (faixa branca com logo) ──────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: CORES.branco,
  },
  logo: { height: 30, objectFit: "contain" },
  headerRight: { alignItems: "flex-end" },
  confidencial: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: DEEP,
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  confidencialSub: {
    fontSize: 5.5,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // ── Faixa de título (deep + accent bright) ──────────────────────────────
  titleBar: {
    backgroundColor: DEEP,
    borderBottomWidth: 2.5,
    borderBottomColor: BRIGHT,
    paddingHorizontal: 32,
    paddingVertical: 11,
  },
  titulo: { fontSize: 15, fontFamily: "Helvetica-Bold", color: CORES.branco, letterSpacing: 0.4 },
  subtitulo: {
    fontSize: 7,
    color: "#bfe3f5",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    marginTop: 3,
  },
  body: { paddingHorizontal: 32, paddingTop: 16 },
  // ── Meta strip ──────────────────────────────────────────────────────────
  metaStrip: {
    flexDirection: "row",
    backgroundColor: CORES.fundoCard,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: CORES.divisor,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  metaItem: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: CORES.divisor,
    paddingRight: 12,
    marginRight: 12,
  },
  metaItemLast: { flex: 1 },
  metaLabel: {
    fontSize: 5.5,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metaValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: CORES.texto },
  metaValueNormal: { fontSize: 8.5, color: CORES.texto },
  // ── KPIs (cards brancos com accent no topo) ─────────────────────────────
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: CORES.divisor,
    borderTopWidth: 2.5,
    backgroundColor: CORES.branco,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 9,
  },
  kpiLabel: {
    fontSize: 5.5,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  kpiValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  // ── Section title ───────────────────────────────────────────────────────
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    color: DEEP,
    marginBottom: 6,
  },
  // ── Tabela ──────────────────────────────────────────────────────────────
  table: {
    width: "100%",
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: CORES.divisor,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: DEEP,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    backgroundColor: CORES.fundoCard,
  },
  tableRowTotal: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1.5,
    borderTopColor: DEEP,
    backgroundColor: "#eef4f5",
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
  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    paddingTop: 5,
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
  logoPath,
  geradoEm,
}: {
  dados: RelatorioTipoProdutoDados
  logoPath: string | null
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
        {/* ── Header com logo ────────────────────────────────────── */}
        <View style={s.header} fixed>
          {logoPath ? (
            <Image src={logoPath} style={s.logo} />
          ) : (
            <Text style={[s.titulo, { color: DEEP }]}>Nexus</Text>
          )}
          <View style={s.headerRight}>
            <Text style={s.confidencial}>Confidencial</Text>
            <Text style={s.confidencialSub}>Documento interno · não compartilhar</Text>
          </View>
        </View>

        {/* ── Faixa de título ────────────────────────────────────── */}
        <View style={s.titleBar} fixed>
          <Text style={s.titulo}>Relatório de Vendas</Text>
          <Text style={s.subtitulo}>Por tipo de produto · {tipoProdutoNome}</Text>
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
            <View style={[s.kpiCard, { borderTopColor: DEEP }]}>
              <Text style={s.kpiLabel}>Total vendido</Text>
              <Text style={[s.kpiValue, { color: DEEP }]}>{formatBRL(totais.valorVenda)}</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: "#9ca3af" }]}>
              <Text style={s.kpiLabel}>Custo total</Text>
              <Text style={[s.kpiValue, { color: CORES.texto }]}>{formatBRL(totais.valorCusto)}</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: "#10b981" }]}>
              <Text style={s.kpiLabel}>RAV total</Text>
              <Text style={[s.kpiValue, { color: "#059669" }]}>{formatBRL(totais.ravTotal)}</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: BRIGHT }]}>
              <Text style={s.kpiLabel}>Margem (RAV / venda)</Text>
              <Text style={[s.kpiValue, { color: BRIGHT }]}>{margem}</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: "#f59e0b" }]}>
              <Text style={s.kpiLabel}>Comissões</Text>
              <Text style={[s.kpiValue, { color: "#b45309" }]}>{formatBRL(totais.comissao)}</Text>
            </View>
          </View>

          {/* ── Detalhamento ─────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Detalhamento das vendas</Text>
            <View style={s.table}>
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
