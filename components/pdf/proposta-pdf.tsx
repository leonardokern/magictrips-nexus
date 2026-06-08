import React from "react"
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Image,
} from "@react-pdf/renderer"
import type { PropostaParaPDF } from "@/app/(dashboard)/propostas/actions"
import { CORES, formatBRL, formatDate, formatTelefone } from "./pdf-utils"

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: CORES.texto,
    backgroundColor: CORES.branco,
    paddingBottom: 52,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    minHeight: 72,
  },
  headerLeft: {
    flex: 1,
    backgroundColor: "#111827",
    paddingHorizontal: 28,
    paddingVertical: 18,
    justifyContent: "center",
  },
  headerRight: {
    width: 110,
    backgroundColor: "#1f2937",
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  empresaNome: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    letterSpacing: 0.3,
  },
  docLabel: {
    fontSize: 6.5,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginTop: 4,
  },
  propId: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    textAlign: "center",
  },
  propIdLabel: {
    fontSize: 5.5,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 3,
  },

  // ── Faixa de info ────────────────────────────────────────────────────────
  infoBar: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 28,
    paddingVertical: 12,
    gap: 20,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 5.5,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 8,
    color: CORES.texto,
    fontFamily: "Helvetica-Bold",
  },
  infoValueNormal: {
    fontSize: 8,
    color: CORES.texto,
  },

  // ── Body ─────────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 28,
    paddingTop: 18,
  },

  // ── Seção ────────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#64748b",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },

  // ── Tabela de produtos ────────────────────────────────────────────────────
  table: {
    width: "100%",
    marginBottom: 16,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#111827",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  th: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  td: {
    fontSize: 7.5,
    color: CORES.texto,
  },
  tdSuave: {
    fontSize: 7,
    color: "#64748b",
    marginTop: 1,
  },
  tdBold: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.texto,
  },

  // Colunas
  colN: { width: 20 },
  colProduto: { flex: 3 },
  colDates: { flex: 2 },
  colPax: { width: 28, textAlign: "center" },
  colValor: { flex: 1.5, textAlign: "right" },

  // ── Total box ─────────────────────────────────────────────────────────────
  totalBox: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  totalLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  totalValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  totalBorder: {
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },

  // ── Observações ───────────────────────────────────────────────────────────
  obsBox: {
    backgroundColor: "#f8fafc",
    borderLeftWidth: 2.5,
    borderLeftColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 16,
  },
  obsText: {
    fontSize: 7.5,
    color: "#475569",
    lineHeight: 1.45,
  },

  // ── Validade ──────────────────────────────────────────────────────────────
  validadeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  validadeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f59e0b",
  },
  validadeText: {
    fontSize: 7,
    color: "#92400e",
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111827",
    paddingHorizontal: 28,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    flex: 1,
  },
  footerEmpresa: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
  },
  footerConfidencial: {
    fontSize: 5.5,
    color: "#6b7280",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  footerRight: {
    alignItems: "flex-end",
  },
  footerAgente: {
    fontSize: 6.5,
    color: "#9ca3af",
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function duracao(inicio: string | null, fim: string | null): string {
  if (!inicio && !fim) return "—"
  if (inicio && fim) return `${formatDate(inicio)} → ${formatDate(fim)}`
  if (inicio) return `A partir de ${formatDate(inicio)}`
  return `Até ${formatDate(fim)}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

type Props = {
  proposta: PropostaParaPDF
  logoPath?: string | null
}

export function PropostaPDF({ proposta, logoPath }: Props) {
  const totalFormatado = formatBRL(proposta.valorTotal)

  return (
    <Document
      title={`Proposta ${proposta.identificador}`}
      author={proposta.empresaNome}
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {logoPath ? (
              <Image src={logoPath} style={{ width: 90, height: 28, objectFit: "contain", marginBottom: 4 }} />
            ) : (
              <Text style={s.empresaNome}>{proposta.empresaNome}</Text>
            )}
            <Text style={s.docLabel}>Proposta Comercial</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.propId}>{proposta.identificador}</Text>
            <Text style={s.propIdLabel}>Nº Proposta</Text>
          </View>
        </View>

        {/* ── Barra de informações ─────────────────────────────────────────── */}
        <View style={s.infoBar}>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Cliente</Text>
            <Text style={s.infoValue}>{proposta.clienteNome}</Text>
            {proposta.clienteEmail && (
              <Text style={s.infoValueNormal}>{proposta.clienteEmail}</Text>
            )}
            {proposta.clienteTelefone && (
              <Text style={s.infoValueNormal}>{formatTelefone(proposta.clienteTelefone)}</Text>
            )}
          </View>

          {(proposta.origem || proposta.destino) && (
            <View style={s.infoBlock}>
              {proposta.origem && proposta.destino ? (
                <>
                  <Text style={s.infoLabel}>Roteiro</Text>
                  <Text style={s.infoValue}>{proposta.origem} → {proposta.destino}</Text>
                </>
              ) : proposta.destino ? (
                <>
                  <Text style={s.infoLabel}>Destino</Text>
                  <Text style={s.infoValue}>{proposta.destino}</Text>
                </>
              ) : (
                <>
                  <Text style={s.infoLabel}>Origem</Text>
                  <Text style={s.infoValue}>{proposta.origem}</Text>
                </>
              )}
            </View>
          )}

          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Data</Text>
            <Text style={s.infoValue}>{formatDate(proposta.dataProposta)}</Text>
          </View>

          {proposta.validade && (
            <View style={s.infoBlock}>
              <Text style={s.infoLabel}>Válida até</Text>
              <Text style={[s.infoValue, { color: "#92400e" }]}>{formatDate(proposta.validade)}</Text>
            </View>
          )}
        </View>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <View style={s.body}>

          {/* Seção produtos */}
          <Text style={s.sectionTitle}>Itens da proposta</Text>

          <View style={s.table}>
            {/* Cabeçalho */}
            <View style={s.tableHead}>
              <Text style={[s.th, s.colN]}>#</Text>
              <Text style={[s.th, s.colProduto]}>Produto / Descrição</Text>
              <Text style={[s.th, s.colDates]}>Período</Text>
              <Text style={[s.th, s.colPax]}>PAX</Text>
              <Text style={[s.th, s.colValor]}>Valor</Text>
            </View>

            {/* Linhas */}
            {proposta.produtos.map((produto, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, s.colN]}>{produto.ordem}</Text>
                <View style={s.colProduto}>
                  <Text style={s.tdBold}>
                    {produto.tipoNome}
                    {produto.destino ? ` — ${produto.destino}` : ""}
                  </Text>
                  {produto.fornecedorNome && (
                    <Text style={s.tdSuave}>{produto.fornecedorNome}</Text>
                  )}
                  {produto.descricao && (
                    <Text style={[s.tdSuave, { marginTop: 2 }]}>{produto.descricao}</Text>
                  )}
                </View>
                <Text style={[s.td, s.colDates]}>{duracao(produto.dataInicio, produto.dataFim)}</Text>
                <Text style={[s.td, s.colPax, { textAlign: "center" }]}>{produto.pax}</Text>
                <Text style={[s.tdBold, s.colValor]}>{formatBRL(produto.valorVenda)}</Text>
              </View>
            ))}
          </View>

          {/* Total */}
          <View style={s.totalBorder}>
            <Text style={s.totalLabel}>Total da proposta</Text>
            <Text style={s.totalValue}>{totalFormatado}</Text>
          </View>

          {/* Validade */}
          {proposta.validade && (
            <View style={[s.validadeBox, { marginTop: 10 }]}>
              <View style={s.validadeDot} />
              <Text style={s.validadeText}>
                Esta proposta é válida até <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatDate(proposta.validade)}</Text>.
                {" "}Após essa data os valores podem ser alterados sem aviso prévio.
              </Text>
            </View>
          )}

          {/* Observações */}
          {proposta.observacoes && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 10 }]}>Observações</Text>
              <View style={s.obsBox}>
                <Text style={s.obsText}>{proposta.observacoes}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Footer fixo ──────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerEmpresa}>{proposta.empresaNome}</Text>
            <Text style={s.footerConfidencial}>Documento confidencial · Proposta comercial</Text>
          </View>
          <View style={s.footerRight}>
            <Text style={s.footerAgente}>{proposta.agenteNome}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
