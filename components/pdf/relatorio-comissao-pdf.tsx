import React from "react"
import { Document, Image, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { CORES, formatBRL } from "./pdf-utils"
import type { RelatorioComissaoDados } from "@/lib/relatorios/comissao"

const DEEP = CORES.nexusDeep
const BRIGHT = CORES.nexusBright

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: CORES.texto,
    paddingTop: 0,
    paddingBottom: 42,
    backgroundColor: CORES.branco,
  },
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
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    color: DEEP,
    marginBottom: 6,
  },
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
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
  },
  tableRowAlt: {
    flexDirection: "row",
    alignItems: "center",
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
  tdZero: { fontSize: 7.5, color: CORES.textoSuave },
  vazio: {
    paddingVertical: 26,
    textAlign: "center",
    fontSize: 8,
    color: CORES.textoSuave,
  },
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

const COLS = {
  agente: "26%",
  empresa: "14%",
  vendas: "7%",
  produtos: "7%",
  valorVenda: "14%",
  rav: "14%",
  comissao: "14%",
  pct: "4%",
} as const

function brDate(iso: string): string {
  if (!iso || iso.length !== 10) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function RelatorioComissaoPDF({
  dados,
  logoPath,
  geradoEm,
}: {
  dados: RelatorioComissaoDados
  logoPath: string | null
  geradoEm: string
}) {
  const { filtros, agentes, totais } = dados

  return (
    <Document title="Relatório de Comissão" author="Nexus · Magic Trips" subject="Comissões por agente (Uso Interno)">
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
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

        {/* Title bar */}
        <View style={s.titleBar} fixed>
          <Text style={s.titulo}>Relatório de Comissão</Text>
          <Text style={s.subtitulo}>Por agente · vendas aprovadas no período</Text>
        </View>

        <View style={s.body}>
          {/* Meta strip */}
          <View style={s.metaStrip}>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Período</Text>
              <Text style={s.metaValue}>
                {brDate(filtros.dataInicio)} a {brDate(filtros.dataFim)}
              </Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Agentes</Text>
              <Text style={s.metaValueNormal}>
                {totais.qtdAgentes} total · {totais.qtdAgentesComVendas} com vendas
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

          {/* KPIs */}
          <View style={s.kpiRow}>
            <View style={[s.kpiCard, { borderTopColor: DEEP }]}>
              <Text style={s.kpiLabel}>Total vendido</Text>
              <Text style={[s.kpiValue, { color: DEEP }]}>{formatBRL(totais.valorVenda)}</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: "#10b981" }]}>
              <Text style={s.kpiLabel}>RAV total (base)</Text>
              <Text style={[s.kpiValue, { color: "#059669" }]}>{formatBRL(totais.ravTotal)}</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: "#f59e0b" }]}>
              <Text style={s.kpiLabel}>Total de comissões</Text>
              <Text style={[s.kpiValue, { color: "#b45309" }]}>{formatBRL(totais.comissao)}</Text>
            </View>
            <View style={[s.kpiCard, { borderTopColor: BRIGHT }]}>
              <Text style={s.kpiLabel}>Agentes com vendas</Text>
              <Text style={[s.kpiValue, { color: BRIGHT }]}>
                {totais.qtdAgentesComVendas} / {totais.qtdAgentes}
              </Text>
            </View>
          </View>

          {/* Tabela */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Detalhamento por agente</Text>
            <View style={s.table}>
              <View style={s.tableHead} fixed>
                <Text style={[s.th, { width: COLS.agente }]}>Agente</Text>
                <Text style={[s.th, { width: COLS.empresa }]}>Empresa</Text>
                <Text style={[s.th, { width: COLS.vendas, textAlign: "center" }]}>Vendas</Text>
                <Text style={[s.th, { width: COLS.produtos, textAlign: "center" }]}>Prod.</Text>
                <Text style={[s.th, { width: COLS.valorVenda, textAlign: "right" }]}>Valor Vendido</Text>
                <Text style={[s.th, { width: COLS.rav, textAlign: "right" }]}>RAV (base)</Text>
                <Text style={[s.th, { width: COLS.comissao, textAlign: "right" }]}>Comissão</Text>
                <Text style={[s.th, { width: COLS.pct, textAlign: "right" }]}>%</Text>
              </View>

              {agentes.length === 0 ? (
                <Text style={s.vazio}>Nenhum agente ativo encontrado.</Text>
              ) : (
                agentes.map((a, i) => {
                  const semVendas = a.qtdVendas === 0
                  const rowStyle = i % 2 === 0 ? s.tableRow : s.tableRowAlt
                  const valorStyle = semVendas ? s.tdZero : s.td
                  const boldStyle = semVendas ? s.tdZero : s.tdBold
                  return (
                    <View key={a.usuarioId} style={rowStyle} wrap={false}>
                      <Text style={[s.td, { width: COLS.agente }]}>{a.nomeAgente}</Text>
                      <Text style={[s.tdSuave, { width: COLS.empresa }]}>{a.empresa || "—"}</Text>
                      <Text style={[valorStyle, { width: COLS.vendas, textAlign: "center" }]}>
                        {a.qtdVendas}
                      </Text>
                      <Text style={[valorStyle, { width: COLS.produtos, textAlign: "center" }]}>
                        {a.qtdProdutos}
                      </Text>
                      <Text style={[valorStyle, { width: COLS.valorVenda, textAlign: "right" }]}>
                        {semVendas ? "—" : formatBRL(a.valorVenda)}
                      </Text>
                      <Text style={[valorStyle, { width: COLS.rav, textAlign: "right" }]}>
                        {semVendas ? "—" : formatBRL(a.ravTotal)}
                      </Text>
                      <Text style={[boldStyle, { width: COLS.comissao, textAlign: "right" }]}>
                        {formatBRL(a.comissao)}
                      </Text>
                      <Text style={[s.tdSuave, { width: COLS.pct, textAlign: "right" }]}>
                        {a.percentualMedio != null ? `${a.percentualMedio.toFixed(1)}%` : "—"}
                      </Text>
                    </View>
                  )
                })
              )}

              {agentes.length > 0 && (
                <View style={s.tableRowTotal}>
                  <Text style={[s.tdBold, { width: COLS.agente }]}>TOTAL</Text>
                  <Text style={[s.tdBold, { width: COLS.empresa }]} />
                  <Text style={[s.tdBold, { width: COLS.vendas, textAlign: "center" }]}>
                    {totais.qtdVendas}
                  </Text>
                  <Text style={[s.tdBold, { width: COLS.produtos, textAlign: "center" }]}>
                    {totais.qtdProdutos}
                  </Text>
                  <Text style={[s.tdBold, { width: COLS.valorVenda, textAlign: "right" }]}>
                    {formatBRL(totais.valorVenda)}
                  </Text>
                  <Text style={[s.tdBold, { width: COLS.rav, textAlign: "right" }]}>
                    {formatBRL(totais.ravTotal)}
                  </Text>
                  <Text style={[s.tdBold, { width: COLS.comissao, textAlign: "right" }]}>
                    {formatBRL(totais.comissao)}
                  </Text>
                  <Text style={[s.tdSuave, { width: COLS.pct, textAlign: "right" }]} />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Nexus · Magic Trips · Relatório de Comissão · {geradoEm} · CONFIDENCIAL
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
