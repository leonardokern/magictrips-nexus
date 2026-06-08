import React from "react"
import {
  Document,
  Image,
  Link,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import type { VendaParaPDF } from "@/app/(dashboard)/vendas/actions"
import {
  CORES,
  formatBRL,
  formatDate,
  formatCPF,
  formatTelefone,
  PGTO_FORMA_LABEL,
  COBRANCA_TIPO_LABEL,
} from "./pdf-utils"

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: CORES.texto,
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 0,
    backgroundColor: CORES.branco,
  },
  // ── Header
  headerRow: { flexDirection: "row", marginTop: -28 },
  headerLeft: { flex: 3, paddingHorizontal: 28, paddingVertical: 2 },
  headerRight: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 2,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  empresaNome: { fontSize: 16, fontFamily: "Helvetica-Bold", color: CORES.branco },
  docTitulo: {
    fontSize: 8,
    color: CORES.branco,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    opacity: 0.75,
    marginTop: 3,
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
  // ── Body
  body: { paddingHorizontal: 28, paddingTop: 14 },
  // ── Seção genérica
  section: { marginBottom: 14 },
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
  // ── Meta strip
  metaStrip: {
    backgroundColor: CORES.fundoCard,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  metaRowBorder: {
    flexDirection: "row",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    marginBottom: 2,
  },
  metaItem: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: CORES.divisor,
    paddingRight: 8,
    marginRight: 8,
  },
  metaItemLast: { flex: 1 },
  metaLabel: {
    fontSize: 5.5,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  metaValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CORES.texto },
  metaValueNormal: { fontSize: 7.5, color: CORES.texto },
  // ── KPIs
  kpiRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  kpiCard: { flex: 1, borderRadius: 3, padding: 8, alignItems: "center" },
  kpiLabel: { fontSize: 5.5, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
  kpiValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
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
  // ── Card de produto
  prodCard: {
    borderWidth: 0.5,
    borderColor: CORES.divisor,
    borderRadius: 4,
    marginBottom: 7,
    overflow: "hidden",
  },
  prodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  prodBody: { paddingHorizontal: 9, paddingVertical: 7 },
  // ── Grade de campos (3 por linha)
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  fieldCol3: { width: "33.33%", paddingBottom: 5, paddingRight: 6 },
  fieldCol4: { width: "25%", paddingBottom: 5, paddingRight: 6 },
  fieldLabel: {
    fontSize: 5.5,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 1.5,
  },
  fieldValue: { fontSize: 7.5, color: CORES.texto },
  fieldValueBold: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CORES.texto },
  // ── Divider interno de card
  divider: {
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    marginVertical: 6,
  },
  subSectionLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  // ── Card de cobrança
  cobrancaCard: {
    borderWidth: 0.5,
    borderColor: CORES.divisor,
    borderRadius: 3,
    marginBottom: 5,
    overflow: "hidden",
  },
  cobrancaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: CORES.fundoTabela,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: CORES.divisor,
  },
  cobrancaBody: { paddingHorizontal: 8, paddingVertical: 6 },
  // ── Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    paddingTop: 4,
  },
  footerText: { fontSize: 6, color: CORES.textoSuave },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Campo({ label, value, bold, color, width = "33.33%" }: {
  label: string
  value: string
  bold?: boolean
  color?: string
  width?: string
}) {
  if (!value || value === "—") return null
  return (
    <View style={[s.fieldCol3, { width }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={[bold ? s.fieldValueBold : s.fieldValue, color ? { color } : {}]}>
        {value}
      </Text>
    </View>
  )
}

const STATUS_INFO: Record<string, { label: string; bg: string; color: string }> = {
  aprovado: { label: "Aprovada", bg: "#d1fae5", color: "#065f46" },
  pendente_validacao: { label: "Aguardando aprovação", bg: "#fef3c7", color: "#92400e" },
  rascunho: { label: "Rascunho", bg: "#f3f4f6", color: "#6b7280" },
  cancelado: { label: "Cancelada", bg: "#fee2e2", color: "#991b1b" },
}

// ─── Documento principal ──────────────────────────────────────────────────────

export function RelatorioPDF({ venda: v, logoPath }: { venda: VendaParaPDF; logoPath: string | null }) {
  const cor = v.empresaCorPrimaria
  const hoje = new Date().toLocaleDateString("pt-BR")

  const totalVenda    = v.produtos.reduce((a, p) => a + p.valorVenda, 0)
  const totalCusto    = v.produtos.reduce((a, p) => a + p.valorCusto, 0)
  // RAV total = base + extra cliente + extra fornecedor (mesma fórmula
  // usada no wizard, lista, dashboards e resumo panel).
  const totalRav      = v.produtos.reduce(
    (a, p) => a + p.rav + p.ravExtraCliente + p.ravExtraFornecedor,
    0,
  )
  // Comissão recomputada com a regra atual (% × RAV total) — não somar
  // `p.comissao` armazenado, que pode estar com a base antiga.
  const totalComissao =
    v.comissaoPercentual != null
      ? (totalRav * v.comissaoPercentual) / 100
      : v.produtos.reduce((a, p) => a + p.comissao, 0)
  const margemRav     = totalVenda > 0 ? ((totalRav / totalVenda) * 100).toFixed(1) : "—"
  const totalCobranca = v.cobranca.reduce((a, c) => a + c.valor, 0)

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const statusInfo = STATUS_INFO[v.status] ?? STATUS_INFO["rascunho"]!

  return (
    <Document
      title={`Relatório de Venda — ${v.clienteNome}`}
      author={v.empresaNome}
      subject="Relatório de Venda (Uso Interno)"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View style={[s.headerLeft, { backgroundColor: cor, flexDirection: "row", alignItems: "center", gap: 14 }]}>
            {logoPath && (
              <Image
                src={logoPath}
                style={{ height: 90, objectFit: "contain", objectPositionX: 0 }}
              />
            )}
            <View>
              <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: CORES.branco, letterSpacing: 0.4 }}>
                {v.empresaNome}
              </Text>
              <Text style={[s.docTitulo, { marginTop: 4 }]}>
                Relatório de Venda {v.identificador} · Uso Interno
              </Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.confidencialLabel}>Confidencial</Text>
            <Text style={s.confidencialSub}>Não compartilhar</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* ── Meta strip (2 linhas) ────────────────────────────────── */}
          <View style={s.metaStrip}>

            {/* Linha 1: identificador · data · cliente · agente */}
            <View style={s.metaRow}>
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>Identificador</Text>
                <Text style={s.metaValue}>{v.identificador}</Text>
              </View>
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>Data da venda</Text>
                <Text style={s.metaValue}>{formatDate(v.dataVenda)}</Text>
              </View>
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>Cliente</Text>
                <Text style={s.metaValue}>{v.clienteNome}</Text>
              </View>
              <View style={s.metaItemLast}>
                <Text style={s.metaLabel}>Agente</Text>
                <Text style={s.metaValueNormal}>{v.agenteNome}</Text>
              </View>
            </View>

            {/* Linha 2: cpf · email · telefone · origem · pax · status */}
            <View style={s.metaRowBorder}>
              {v.clienteCPF && (
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>CPF</Text>
                  <Text style={s.metaValueNormal}>{formatCPF(v.clienteCPF)}</Text>
                </View>
              )}
              {v.clienteEmail && (
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>E-mail</Text>
                  <Text style={s.metaValueNormal}>{v.clienteEmail}</Text>
                </View>
              )}
              {v.clienteTelefone && (
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Telefone</Text>
                  <Text style={s.metaValueNormal}>{formatTelefone(v.clienteTelefone)}</Text>
                </View>
              )}
              {v.origem && (
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Origem</Text>
                  <Text style={s.metaValueNormal}>{v.origem}</Text>
                </View>
              )}
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>PAX</Text>
                <Text style={s.metaValueNormal}>{v.pax}</Text>
              </View>
              <View style={s.metaItemLast}>
                <Text style={s.metaLabel}>Status</Text>
                <View style={{
                  backgroundColor: statusInfo.bg,
                  borderRadius: 8,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  alignSelf: "flex-start",
                  marginTop: 1,
                }}>
                  <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: statusInfo.color, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
            </View>

          </View>

          {/* ── KPIs ─────────────────────────────────────────────────── */}
          <View style={s.kpiRow}>
            <View style={[s.kpiCard, { backgroundColor: cor + "18", borderWidth: 0.5, borderColor: cor + "44" }]}>
              <Text style={[s.kpiLabel, { color: cor }]}>Total da venda</Text>
              <Text style={[s.kpiValue, { color: cor }]}>{formatBRL(totalVenda)}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: "#f3f4f6", borderWidth: 0.5, borderColor: CORES.divisor }]}>
              <Text style={[s.kpiLabel, { color: CORES.textoSuave }]}>Custo total</Text>
              <Text style={[s.kpiValue, { color: CORES.texto }]}>{formatBRL(totalCusto)}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: "#ecfdf5", borderWidth: 0.5, borderColor: "#a7f3d0" }]}>
              <Text style={[s.kpiLabel, { color: "#065f46" }]}>RAV total</Text>
              <Text style={[s.kpiValue, { color: "#065f46" }]}>{formatBRL(totalRav)}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: "#fffbeb", borderWidth: 0.5, borderColor: "#fde68a" }]}>
              <Text style={[s.kpiLabel, { color: "#92400e" }]}>
                Comissão{v.comissaoPercentual != null ? ` (${v.comissaoPercentual}%)` : ""}
              </Text>
              <Text style={[s.kpiValue, { color: "#92400e" }]}>{formatBRL(totalComissao)}</Text>
            </View>
          </View>

          {/* ── Resumo financeiro (tabela) ────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Resumo financeiro por produto</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.th, { flex: 2 }]}>Produto</Text>
                <Text style={[s.th, { flex: 1.2, textAlign: "right" }]}>Venda</Text>
                <Text style={[s.th, { flex: 1.2, textAlign: "right" }]}>Custo</Text>
                <Text style={[s.th, { flex: 1, textAlign: "right" }]}>RAV</Text>
                <Text style={[s.th, { flex: 0.8, textAlign: "right" }]}>Margem</Text>
              </View>
              {v.produtos.map((p, i) => {
                const margem = p.valorVenda > 0
                  ? ((p.rav / p.valorVenda) * 100).toFixed(1) + "%"
                  : "—"
                return (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <View style={{ flex: 2 }}>
                      <Text style={s.tdBold}>{p.tipoNome}</Text>
                      {p.destino && (
                        <Text style={[s.tdSuave, { fontSize: 6.5, marginTop: 1 }]}>{p.destino}</Text>
                      )}
                    </View>
                    <Text style={[s.td,      { flex: 1.2, textAlign: "right" }]}>{formatBRL(p.valorVenda)}</Text>
                    <Text style={[s.tdSuave, { flex: 1.2, textAlign: "right" }]}>{formatBRL(p.valorCusto)}</Text>
                    <Text style={[s.td,      { flex: 1,   textAlign: "right" }]}>{formatBRL(p.rav)}</Text>
                    <Text style={[s.tdSuave, { flex: 0.8, textAlign: "right" }]}>{margem}</Text>
                  </View>
                )
              })}
              <View style={s.tableRowTotal}>
                <Text style={[s.tdBold, { flex: 2 }]}>Total</Text>
                <Text style={[s.tdBold, { flex: 1.2, textAlign: "right" }]}>{formatBRL(totalVenda)}</Text>
                <Text style={[s.tdSuave, { flex: 1.2, textAlign: "right" }]}>{formatBRL(totalCusto)}</Text>
                <Text style={[s.tdBold, { flex: 1,   textAlign: "right" }]}>{formatBRL(totalRav)}</Text>
                <Text style={[s.tdSuave, { flex: 0.8, textAlign: "right" }]}>
                  {margemRav !== "—" ? `${margemRav}%` : "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Detalhe completo por produto ─────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Detalhe dos produtos</Text>
            {v.produtos.map((p, i) => (
              <View key={i} style={s.prodCard}>
                {/* Cabeçalho do card */}
                <View style={s.prodHeader}>
                  <View>
                    <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: CORES.branco }}>
                      {p.tipoNome}
                      {p.fornecedorNome ? (
                        <Text style={{ fontFamily: "Helvetica", color: "#9ca3af" }}>  · {p.fornecedorNome}</Text>
                      ) : null}
                    </Text>
                    {p.destino && (
                      <Text style={{ fontSize: 6.5, color: "#9ca3af", marginTop: 1 }}>{p.destino}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: CORES.branco }}>
                    {formatBRL(p.valorVenda)}
                  </Text>
                </View>

                <View style={s.prodBody}>
                  {/* Identificação do produto: datas (emissão, viagem) + localizadores */}
                  {(p.dataEmissao || p.dataInicio || p.dataFim || p.localizador || p.localizadorFornecedor) && (
                    <>
                      <Text style={s.subSectionLabel}>Identificação</Text>
                      <View style={s.fieldGrid}>
                        {p.dataEmissao && <Campo label="Emissão" value={formatDate(p.dataEmissao)} />}
                        {p.dataInicio && <Campo label="Início viagem" value={formatDate(p.dataInicio)} />}
                        {p.dataFim && <Campo label="Fim viagem" value={formatDate(p.dataFim)} />}
                        {p.localizador && <Campo label="Localizador" value={p.localizador} />}
                        {p.localizadorFornecedor && <Campo label="Loc. Fornecedor" value={p.localizadorFornecedor} />}
                      </View>
                      <View style={s.divider} />
                    </>
                  )}

                  {/* Detalhes personalizados do tipo (Companhia, Trecho, etc.) */}
                  {p.camposExtras.length > 0 && (
                    <>
                      <Text style={s.subSectionLabel}>Detalhes do tipo</Text>
                      <View style={s.fieldGrid}>
                        {p.camposExtras.map((ce, j) => (
                          <Campo key={j} label={ce.nome} value={ce.valor} />
                        ))}
                      </View>
                      <View style={s.divider} />
                    </>
                  )}

                  {/* Financeiro do produto */}
                  <Text style={s.subSectionLabel}>Financeiro</Text>
                  <View style={s.fieldGrid}>
                    <Campo label="Valor venda" value={formatBRL(p.valorVenda)} bold width="25%" />
                    <Campo label="Valor custo" value={formatBRL(p.valorCusto)} width="25%" />
                    <Campo label="RAV" value={formatBRL(p.rav)} width="25%" />
                    <Campo
                      label="Margem RAV"
                      value={p.valorVenda > 0 ? `${((p.rav / p.valorVenda) * 100).toFixed(1)}%` : "—"}
                      width="25%"
                    />
                    {p.ravExtraCliente > 0 && (
                      <Campo label="RAV Extra Cliente" value={formatBRL(p.ravExtraCliente)} color="#1498D5" width="25%" />
                    )}
                    {p.ravExtraFornecedor > 0 && (
                      <Campo label="RAV Extra Fornecedor" value={formatBRL(p.ravExtraFornecedor)} color="#1498D5" width="25%" />
                    )}
                    {p.tipoComissao && <Campo label="Tipo comissão" value={p.tipoComissao} width="25%" />}
                  </View>

                  {/* Pagamento ao fornecedor — sempre visível */}
                  <View style={s.divider} />
                  <Text style={s.subSectionLabel}>Pagamento ao fornecedor</Text>
                  <View style={s.fieldGrid}>
                    <Campo
                      label="Forma"
                      value={p.pgtoForma ? (PGTO_FORMA_LABEL[p.pgtoForma] ?? p.pgtoForma) : "—"}
                      width="25%"
                    />
                    {p.pgtoCartaoNome && <Campo label="Cartão" value={p.pgtoCartaoNome} width="25%" />}
                    {p.pgtoValorTotal != null && (
                      <Campo label="Valor total" value={formatBRL(p.pgtoValorTotal)} bold width="25%" />
                    )}
                    {p.pgtoEntrada > 0 && (
                      <Campo label="Entrada" value={formatBRL(p.pgtoEntrada)} width="25%" />
                    )}
                    <Campo
                      label="Parcelas"
                      value={p.pgtoNumParcelas > 1
                        ? `${p.pgtoNumParcelas}× ${p.pgtoValorParcela ? formatBRL(p.pgtoValorParcela) : ""}`
                        : "À vista"}
                      width="25%"
                    />
                    {p.pgtoDataDebito && (
                      <Campo label="Data de entrada" value={formatDate(p.pgtoDataDebito)} width="25%" />
                    )}
                    {p.pgtoPrimeiraParcelaExtra > 0 && (
                      <Campo
                        label="Taxa 1ª parcela"
                        value={formatBRL(p.pgtoPrimeiraParcelaExtra)}
                        width="25%"
                      />
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* ── Cobrança do cliente ───────────────────────────────────── */}
          {v.cobranca.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Cobrança do cliente</Text>
              {v.cobranca.map((c, i) => (
                <View key={i} style={s.cobrancaCard}>
                  <View style={s.cobrancaHeader}>
                    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CORES.texto }}>
                      {COBRANCA_TIPO_LABEL[c.tipo] ?? c.tipo}
                    </Text>
                    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CORES.texto }}>
                      {formatBRL(c.valor)}
                    </Text>
                  </View>
                  <View style={s.cobrancaBody}>
                    <View style={s.fieldGrid}>
                      <Campo
                        label="Parcelas"
                        value={c.parcelas > 1
                          ? `${c.parcelas}× ${c.valorParcela ? formatBRL(c.valorParcela) : ""}`
                          : "À vista"}
                        width="25%"
                      />
                      {c.dataInicio && (
                        <Campo label="Início" value={formatDate(c.dataInicio)} width="25%" />
                      )}
                      {c.dataPrimeiroRecebimento && (
                        <Campo label="1º recebimento" value={formatDate(c.dataPrimeiroRecebimento)} width="25%" />
                      )}
                      {c.fornecedorDestino && (
                        <Campo label="Destino" value={c.fornecedorDestino} width="25%" />
                      )}
                      {c.plataforma && (
                        <Campo label="Plataforma" value={c.plataforma} width="25%" />
                      )}
                      {c.taxaAdquirente != null && c.taxaAdquirente > 0 && (
                        <Campo label="Taxa adquirente" value={`${c.taxaAdquirente}%`} color="#92400e" width="25%" />
                      )}
                      {c.valorLiquido != null && c.valorLiquido > 0 && (
                        <Campo label="Valor líquido" value={formatBRL(c.valorLiquido)} bold width="25%" />
                      )}
                    </View>
                    {/* Link de pagamento (link_externo) — fora da grid pra
                        ocupar a linha inteira e ser clicável. */}
                    {c.plataformaLink && c.tipo === "link_externo" && (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 6.5, color: CORES.textoSuave, marginBottom: 1 }}>
                          LINK DE PAGAMENTO
                        </Text>
                        <Link
                          src={c.plataformaLink}
                          style={{ fontSize: 7.5, color: "#1498D5", textDecoration: "underline" }}
                        >
                          {c.plataformaLink}
                        </Link>
                      </View>
                    )}
                    {/* Detalhamento das parcelas — quando o operador
                        customizou valor e/ou data por parcela. */}
                    {c.parcelasDetalhe && c.parcelasDetalhe.length > 0 && (
                      <View style={{ marginTop: 5 }}>
                        <Text style={{ fontSize: 6.5, color: CORES.textoSuave, marginBottom: 2 }}>
                          PARCELAS PLANEJADAS
                        </Text>
                        {c.parcelasDetalhe.map((p) => (
                          <View
                            key={p.ordem}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              paddingVertical: 1.5,
                              borderBottomWidth: 0.25,
                              borderBottomColor: CORES.divisor,
                            }}
                          >
                            <Text style={{ fontSize: 7.5, color: CORES.textoSuave }}>
                              Parcela {p.ordem}
                              {p.data ? `  ·  ${formatDate(p.data)}` : ""}
                            </Text>
                            <Text style={{ fontSize: 7.5, color: CORES.texto }}>
                              {formatBRL(p.valor)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Comprovante de pagamento — nome do arquivo + nota */}
                    {c.comprovanteStoragePath && c.comprovanteNomeArquivo && (
                      <View
                        style={{
                          marginTop: 4,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 6.5, color: CORES.textoSuave }}>
                          COMPROVANTE
                        </Text>
                        <Text style={{ fontSize: 7.5, color: CORES.texto }}>
                          {c.comprovanteNomeArquivo}
                        </Text>
                      </View>
                    )}
                    {c.observacoes && (
                      <Text style={{ fontSize: 7, color: CORES.textoSuave, marginTop: 3 }}>
                        Obs: {c.observacoes}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
              {/* Total cobrado */}
              <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                borderTopWidth: 0.5,
                borderTopColor: CORES.divisor,
                paddingTop: 5,
                marginTop: 2,
              }}>
                <Text style={s.tdBold}>Total cobrado</Text>
                <Text style={[s.tdBold, { color: cor }]}>{formatBRL(totalCobranca)}</Text>
              </View>
              {/* Alerta de divergência */}
              {Math.abs(totalCobranca - totalVenda) > 0.01 && (
                <View style={{
                  backgroundColor: "#fffbeb",
                  borderWidth: 0.5,
                  borderColor: "#fde68a",
                  borderRadius: 3,
                  padding: 5,
                  marginTop: 4,
                }}>
                  <Text style={{ fontSize: 7, color: "#92400e" }}>
                    ⚠ Cobrança ({formatBRL(totalCobranca)}) difere do total da venda ({formatBRL(totalVenda)}).
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Passageiros ───────────────────────────────────────────── */}
          {v.passageiros.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Passageiros ({v.passageiros.length})</Text>
              <View style={s.table}>
                <View style={s.tableHead}>
                  <Text style={[s.th, { flex: 3 }]}>Nome</Text>
                  <Text style={[s.th, { flex: 2 }]}>CPF</Text>
                  <Text style={[s.th, { flex: 2 }]}>Nascimento</Text>
                  <Text style={[s.th, { flex: 2 }]}>Passaporte</Text>
                </View>
                {v.passageiros.map((p, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.td, { flex: 3 }]}>{p.nome || "—"}</Text>
                    <Text style={[s.tdSuave, { flex: 2 }]}>{formatCPF(p.cpf)}</Text>
                    <Text style={[s.tdSuave, { flex: 2 }]}>{formatDate(p.dataNascimento)}</Text>
                    <Text style={[s.tdSuave, { flex: 2 }]}>{p.passaporte || "—"}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Anexos (listagem nominal) ────────────────────────────── */}
          {v.anexos.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Anexos ({v.anexos.length})</Text>
              <View style={s.table}>
                <View style={s.tableHead}>
                  <Text style={[s.th, { flex: 4 }]}>Nome do arquivo</Text>
                  <Text style={[s.th, { flex: 1 }]}>Tipo</Text>
                  <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Tamanho</Text>
                </View>
                {v.anexos.map((a, i) => {
                  const isPdf = a.mimeType === "application/pdf"
                  const tamanhoMB = (a.tamanhoBytes / (1024 * 1024)).toFixed(2)
                  return (
                    <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                      <Text style={[s.td, { flex: 4 }]}>{a.nomeArquivo}</Text>
                      <Text style={[s.tdSuave, { flex: 1 }]}>{isPdf ? "PDF" : "Imagem"}</Text>
                      <Text style={[s.tdSuave, { flex: 1, textAlign: "right" }]}>{tamanhoMB} MB</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* ── Aprovação ─────────────────────────────────────────────── */}
          {v.status === "aprovado" && v.aprovadoPorNome && (
            <View style={{
              backgroundColor: "#d1fae5",
              borderRadius: 3,
              padding: 7,
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 7.5, color: "#065f46" }}>
                ✓ Aprovada por{" "}
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{v.aprovadoPorNome}</Text>
                {v.dataAprovacao && ` em ${formatDate(v.dataAprovacao)}`}
              </Text>
            </View>
          )}

          {/* ── Motivo de revisão ─────────────────────────────────────── */}
          {v.motivoRevisao && (
            <View style={{
              backgroundColor: "#fffbeb",
              borderRadius: 3,
              padding: 7,
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 7, color: "#92400e", fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
                Revisão solicitada
              </Text>
              <Text style={{ fontSize: 7, color: "#92400e" }}>{v.motivoRevisao}</Text>
            </View>
          )}

          {/* ── Observações ───────────────────────────────────────────── */}
          {v.observacoes && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Observações</Text>
              <View style={{
                backgroundColor: CORES.fundoCard,
                borderRadius: 3,
                padding: 8,
              }}>
                <Text style={{ fontSize: 7.5, color: CORES.textoSuave, lineHeight: 1.5 }}>
                  {v.observacoes}
                </Text>
              </View>
            </View>
          )}

        </View>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {v.empresaNome} · Relatório de Venda · {hoje} · CONFIDENCIAL
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
