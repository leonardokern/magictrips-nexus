import React from "react"
import {
  Document,
  Image,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import type { VendaParaPDF } from "@/app/(dashboard)/vendas/actions"
import {
  CORES,
  corEmpresa,
  formatBRL,
  formatDate,
  formatCPF,
  formatTelefone,
  COBRANCA_TIPO_LABEL,
} from "./pdf-utils"

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: CORES.texto,
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 0,
    backgroundColor: CORES.branco,
  },
  // Header colorido
  headerBand: {
    paddingHorizontal: 36,
    paddingVertical: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  empresaNome: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    letterSpacing: 0.5,
  },
  docTitulo: {
    fontSize: 9,
    color: CORES.branco,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    opacity: 0.85,
    marginTop: 3,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerRightLabel: {
    fontSize: 7,
    color: CORES.branco,
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerRightValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    marginTop: 2,
  },
  // Corpo
  body: {
    paddingHorizontal: 36,
    paddingTop: 20,
  },
  // Info strip abaixo do header
  infoStrip: {
    flexDirection: "row",
    backgroundColor: CORES.fundoCard,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 0,
  },
  infoItem: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: CORES.divisor,
    paddingRight: 12,
    marginRight: 12,
  },
  infoItemLast: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 6,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.texto,
  },
  infoValueNormal: {
    fontSize: 8.5,
    color: CORES.texto,
  },
  // Seção
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  sectionTitleBar: {
    width: 2.5,
    height: 10,
    borderRadius: 1,
  },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: CORES.textoSuave,
  },
  // Grid 2-3 colunas
  grid2: {
    flexDirection: "row",
    gap: 10,
  },
  grid3: {
    flexDirection: "row",
    gap: 10,
  },
  gridCol: {
    flex: 1,
    backgroundColor: CORES.fundoCard,
    borderRadius: 3,
    padding: 8,
  },
  gridLabel: {
    fontSize: 6,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 8.5,
    color: CORES.texto,
  },
  // Produto card
  produtoCard: {
    border: 0.5,
    borderColor: CORES.divisor,
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",
  },
  produtoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  produtoTipo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  produtoValor: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: CORES.branco,
  },
  produtoBody: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  produtoField: {
    width: "33%",
    paddingBottom: 5,
    paddingRight: 8,
  },
  produtoFieldLabel: {
    fontSize: 6,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 1.5,
  },
  produtoFieldValue: {
    fontSize: 7.5,
    color: CORES.texto,
  },
  // Tabela de passageiros
  table: {
    width: "100%",
    borderRadius: 4,
    overflow: "hidden",
    border: 0.5,
    borderColor: CORES.divisor,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: CORES.fundoTabela,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    backgroundColor: CORES.fundoCard,
  },
  th: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  td: {
    fontSize: 7.5,
    color: CORES.texto,
  },
  tdSuave: {
    fontSize: 7.5,
    color: CORES.textoSuave,
  },
  // Cobrança
  cobrancaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: CORES.divisor,
  },
  cobrancaTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 7,
    marginTop: 2,
  },
  cobrancaTotalLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: CORES.texto,
  },
  cobrancaTotalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: CORES.texto,
  },
  // Observações
  obsBox: {
    backgroundColor: CORES.fundoCard,
    borderRadius: 3,
    padding: 8,
  },
  obsText: {
    fontSize: 7.5,
    color: CORES.textoSuave,
    lineHeight: 1.5,
  },
  // Assinatura
  assinaturaRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
  },
  assinaturaBox: {
    flex: 1,
    borderTopWidth: 0.5,
    borderTopColor: CORES.texto,
    paddingTop: 5,
  },
  assinaturaLabel: {
    fontSize: 6.5,
    color: CORES.textoSuave,
  },
  // Footer
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    paddingTop: 5,
  },
  footerText: {
    fontSize: 6,
    color: CORES.textoSuave,
  },
  // Badge de status
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
})

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function SectionTitle({
  title,
  cor,
}: {
  title: string
  cor: string
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionTitleBar, { backgroundColor: cor }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.produtoField}>
      <Text style={styles.produtoFieldLabel}>{label}</Text>
      <Text style={styles.produtoFieldValue}>{value || "—"}</Text>
    </View>
  )
}

function ProdutoCard({
  produto,
  cor,
}: {
  produto: VendaParaPDF["produtos"][0]
  cor: string
}) {
  const fields: { label: string; value: string }[] = []
  if (produto.destino) fields.push({ label: "Destino", value: produto.destino })
  // Campos customizados do tipo de produto (preenchidos na venda)
  for (const ce of produto.camposExtras) {
    fields.push({ label: ce.nome, value: ce.valor })
  }
  if (produto.localizador)
    fields.push({ label: "Localizador", value: produto.localizador })
  if (produto.localizadorFornecedor)
    fields.push({
      label: "Loc. Fornecedor",
      value: produto.localizadorFornecedor,
    })

  return (
    <View style={styles.produtoCard}>
      <View style={[styles.produtoHeader, { backgroundColor: cor }]}>
        <Text style={styles.produtoTipo}>{produto.tipoNome}</Text>
        <Text style={styles.produtoValor}>{formatBRL(produto.valorVenda)}</Text>
      </View>
      {fields.length > 0 && (
        <View style={styles.produtoBody}>
          {fields.map((f, i) => (
            <Field key={i} label={f.label} value={f.value} />
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Documento principal ──────────────────────────────────────────────────────

export function ComprovantePDF({ venda: v, logoPath }: { venda: VendaParaPDF; logoPath: string | null }) {
  const cor = v.empresaCorPrimaria
  const totalVenda = v.produtos.reduce((a, p) => a + p.valorVenda, 0)
  const totalCobranca = v.cobranca.reduce((a, c) => a + c.valor, 0)
  const hoje = new Date().toLocaleDateString("pt-BR")

  return (
    <Document
      title={`Comprovante de Venda — ${v.clienteNome}`}
      author={v.empresaNome}
      subject="Comprovante de Venda"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header colorido ──────────────────────────────────────── */}
        <View style={[styles.headerBand, { backgroundColor: cor }]}>
          {/* Logo + textos lado a lado */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {logoPath && (
              <Image
                src={logoPath}
                style={{ height: 90, objectFit: "contain", objectPositionX: 0 }}
              />
            )}
            <View>
              <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 0.4 }}>
                {v.empresaNome}
              </Text>
              <Text style={{ fontSize: 8, color: "#ffffff", opacity: 0.85, textTransform: "uppercase", letterSpacing: 1.3, marginTop: 4 }}>
                Comprovante de Venda {v.identificador}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightLabel}>Total da venda</Text>
            <Text style={styles.headerRightValue}>{formatBRL(totalVenda)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Info strip ──────────────────────────────────────────── */}
          <View style={styles.infoStrip}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Identificador</Text>
              <Text style={styles.infoValue}>{v.identificador}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Data da venda</Text>
              <Text style={styles.infoValue}>{formatDate(v.dataVenda)}</Text>
            </View>
            {(v.dataInicioViagem || v.dataFimViagem) && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Período da viagem</Text>
                <Text style={styles.infoValue}>
                  {v.dataFimViagem
                    ? `${formatDate(v.dataInicioViagem)} – ${formatDate(v.dataFimViagem)}`
                    : formatDate(v.dataInicioViagem)}
                </Text>
              </View>
            )}
            <View style={styles.infoItemLast}>
              <Text style={styles.infoLabel}>Agente responsável</Text>
              <Text style={styles.infoValue}>{v.agenteNome}</Text>
            </View>
          </View>

          {/* ── Cliente ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionTitle title="Dados do cliente" cor={cor} />
            <View style={styles.grid2}>
              <View style={styles.gridCol}>
                <Text style={styles.gridLabel}>Nome completo</Text>
                <Text style={styles.gridValue}>{v.clienteNome}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.gridLabel}>CPF</Text>
                <Text style={styles.gridValue}>{formatCPF(v.clienteCPF)}</Text>
              </View>
            </View>
            <View style={[styles.grid2, { marginTop: 6 }]}>
              <View style={styles.gridCol}>
                <Text style={styles.gridLabel}>E-mail</Text>
                <Text style={styles.gridValue}>{v.clienteEmail || "—"}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.gridLabel}>Telefone</Text>
                <Text style={styles.gridValue}>
                  {formatTelefone(v.clienteTelefone)}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Produtos ────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionTitle
              title={`Serviços contratados (${v.produtos.length})`}
              cor={cor}
            />
            {v.produtos.map((p, i) => (
              <ProdutoCard key={i} produto={p} cor={cor} />
            ))}
          </View>

          {/* ── Passageiros ─────────────────────────────────────────── */}
          {v.passageiros.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                title={`Passageiros (${v.passageiros.length})`}
                cor={cor}
              />
              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 3 }]}>Nome completo</Text>
                  <Text style={[styles.th, { flex: 2 }]}>CPF</Text>
                  <Text style={[styles.th, { flex: 2 }]}>
                    Data de nascimento
                  </Text>
                </View>
                {v.passageiros.map((p, i) => (
                  <View
                    key={i}
                    style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  >
                    <Text style={[styles.td, { flex: 3 }]}>{p.nome}</Text>
                    <Text style={[styles.tdSuave, { flex: 2 }]}>
                      {formatCPF(p.cpf)}
                    </Text>
                    <Text style={[styles.tdSuave, { flex: 2 }]}>
                      {formatDate(p.dataNascimento)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Cobrança ────────────────────────────────────────────── */}
          {v.cobranca.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title="Forma de cobrança" cor={cor} />
              <View
                style={{
                  border: 0.5,
                  borderColor: CORES.divisor,
                  borderRadius: 4,
                  paddingHorizontal: 10,
                  paddingTop: 4,
                  paddingBottom: 2,
                }}
              >
                {v.cobranca.map((c, i) => (
                  <View key={i} style={styles.cobrancaRow}>
                    <View>
                      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: CORES.texto }}>
                        {COBRANCA_TIPO_LABEL[c.tipo] ?? c.tipo}
                      </Text>
                      <Text style={{ fontSize: 7, color: CORES.textoSuave, marginTop: 1 }}>
                        {c.parcelas > 1
                          ? `${c.parcelas}x de ${formatBRL(c.valorParcela ?? c.valor / c.parcelas)}`
                          : "À vista"}
                        {c.dataPrimeiroRecebimento && c.tipo !== "cartao_credito" && c.tipo !== "cartao_debito"
                          ? ` · Venc. ${formatDate(c.dataPrimeiroRecebimento)}`
                          : ""}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: CORES.texto }}>
                      {formatBRL(c.valor)}
                    </Text>
                  </View>
                ))}
                <View style={styles.cobrancaTotal}>
                  <Text style={styles.cobrancaTotalLabel}>Total cobrado</Text>
                  <Text style={[styles.cobrancaTotalValue, { color: cor }]}>
                    {formatBRL(totalCobranca)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Observações ─────────────────────────────────────────── */}
          {v.observacoes && (
            <View style={styles.section}>
              <SectionTitle title="Observações" cor={cor} />
              <View style={styles.obsBox}>
                <Text style={styles.obsText}>{v.observacoes}</Text>
              </View>
            </View>
          )}

          {/* ── Aprovação ───────────────────────────────────────────── */}
          {v.status === "aprovado" && v.aprovadoPorNome && (
            <View
              style={{
                backgroundColor: "#d1fae5",
                borderRadius: 4,
                padding: 8,
                marginBottom: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 7.5, color: "#065f46" }}>
                ✓ Aprovada por{" "}
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {v.aprovadoPorNome}
                </Text>
                {v.dataAprovacao && ` em ${formatDate(v.dataAprovacao)}`}
              </Text>
            </View>
          )}

          {/* ── Assinatura ──────────────────────────────────────────── */}
          <View style={{ marginTop: 20, marginBottom: 40 }}>
            <View style={styles.assinaturaRow}>
              <View style={styles.assinaturaBox}>
                <Text style={styles.assinaturaLabel}>
                  Assinatura do cliente
                </Text>
              </View>
              <View style={styles.assinaturaBox}>
                <Text style={styles.assinaturaLabel}>
                  Assinatura do agente · {v.agenteNome}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>
            {v.empresaNome} · Documento gerado em {hoje}
          </Text>
          <Text style={styles.footerText}>
            Este documento é um comprovante de contratação de serviço de
            turismo.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
