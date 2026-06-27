import React from "react"
import {
  Document,
  Image,
  Link,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer"
import {
  CORES,
  FONTE_NEXUS,
  formatBRL,
  formatDateLong,
  formatCPF,
  formatTelefone,
} from "./pdf-utils"
import type { FaturaAgrupadaData } from "@/app/(dashboard)/financeiro/actions"

const NAVY = "#1A1F4D"
const BLUE = "#1498D5"
const YELLOW = "#F4B81C"
const LINE = "#E5E7EB"
const BORDA = 28

const styles = StyleSheet.create({
  // Moldura navy simétrica: BORDA em todos os lados.
  page: {
    fontFamily: FONTE_NEXUS,
    fontSize: 9,
    color: NAVY,
    paddingTop: BORDA,
    paddingBottom: BORDA,
    paddingHorizontal: BORDA,
    backgroundColor: NAVY,
  },
  card: {
    flex: 1,
    backgroundColor: CORES.branco,
    // Sem paddingTop: feedback jun/2026 — o respiro entre a moldura azul
    // e o conteúdo já vem do `page.paddingTop` (faixa navy + folga),
    // o paddingTop extra no card duplicava a margem visual no topo.
    //
    // `paddingBottom: 110` reserva espaço para o `footerStack`
    // (position: absolute) — sem isso, conteúdo de fluxo
    // (PIX/transferência) sobrepunha o rodapé quando a tabela crescia.
    // ~110pt = altura do footer (agradecimento ~30 + gap 10 + contatoRow
    // ~30) + offset `bottom: 28` + folga visual.
    paddingTop: 0,
    paddingHorizontal: 36,
    paddingBottom: 110,
    position: "relative",
  },
  faturaBadge: {
    position: "absolute",
    top: -BORDA,
    right: 60,
    width: 110,
    height: BORDA + 60,
    backgroundColor: YELLOW,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: BORDA,
  },
  faturaBadgeTxt: {
    fontSize: 16,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
    letterSpacing: 0.6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  logoImg: { width: 72, height: 72, objectFit: "contain" },
  logoBoxFallback: {
    width: 38,
    height: 38,
    backgroundColor: NAVY,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInicial: {
    fontSize: 18,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: CORES.branco,
  },
  meta: { marginBottom: 18 },
  metaLabel: {
    fontSize: 10,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
  },
  metaValue: { fontSize: 9.5, color: NAVY, marginTop: 1, marginBottom: 8 },
  blocosRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 22,
  },
  bloco: { flex: 1 },
  blocoTitulo: {
    fontSize: 10,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
    marginBottom: 8,
  },
  blocoLinhaForte: {
    fontSize: 10,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
    marginBottom: 6,
  },
  blocoLinha: { fontSize: 9, color: NAVY, marginBottom: 5, lineHeight: 1.4 },
  table: { marginBottom: 12 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  th: {
    fontSize: 9,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: CORES.branco,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  td: { fontSize: 9.5, color: NAVY },
  tdBold: {
    fontSize: 9.5,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
  },
  tdPeriodo: {
    fontSize: 8,
    color: BLUE,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 1.4,
  },
  tdCampos: {
    fontSize: 7.5,
    color: "#4B5563",
    marginTop: 1,
    lineHeight: 1.5,
  },
  totaisBox: {
    alignItems: "flex-end",
    marginTop: 8,
    marginBottom: 14,
  },
  // ── Linhas dos totais (Subtotal + ajustes + grand total) ────────
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
    minWidth: 230,
  },
  totalLabel: { fontSize: 10, color: NAVY, width: 140, textAlign: "right" },
  totalValor: { fontSize: 10, color: NAVY, width: 80, textAlign: "right" },
  totalRowSmall: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
    minWidth: 230,
  },
  // Linhas de ajuste — mesma cor do Subtotal (NAVY). Decisão jun/2026:
  // sem cores semânticas, leitura sóbria. Os sinais `+ / −` já comunicam.
  totalLabelDesconto: {
    fontSize: 8,
    color: NAVY,
    width: 140,
    textAlign: "right",
  },
  totalValorDesconto: {
    // Valor sem bold (decisão jun/2026) — leitura mais leve.
    fontSize: 8,
    color: NAVY,
    width: 80,
    textAlign: "right",
  },
  totalLabelAcrescimo: {
    fontSize: 8,
    color: NAVY,
    width: 140,
    textAlign: "right",
  },
  totalValorAcrescimo: {
    fontSize: 8,
    color: NAVY,
    width: 80,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 6,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
    width: 110,
    textAlign: "right",
  },
  grandTotalValor: {
    fontSize: 11,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
    width: 80,
    textAlign: "right",
  },
  dotted: {
    fontSize: 6,
    color: NAVY,
    opacity: 0.4,
    marginVertical: 16,
    letterSpacing: 1.5,
  },
  pagamentoRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 18,
  },
  pixRow: { flexDirection: "row", gap: 12, marginTop: 4, alignItems: "center" },
  pixQr: { width: 90, height: 90, objectFit: "contain" },
  pixDicaTitulo: {
    fontSize: 8.5,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
  },
  pixDica: { fontSize: 8, color: NAVY, opacity: 0.65, marginBottom: 6 },
  pixLabel: {
    fontSize: 6.5,
    color: NAVY,
    opacity: 0.6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  pixChave: {
    fontSize: 9,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
    marginTop: 1,
  },
  bankLabel: {
    fontSize: 6,
    color: NAVY,
    opacity: 0.55,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  bankValue: {
    fontSize: 8,
    color: NAVY,
    marginTop: 1,
  },
  footerStack: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    alignItems: "center",
    gap: 10,
  },
  agradecimentoCenter: {
    fontSize: 9.5,
    color: NAVY,
    fontFamily: FONTE_NEXUS,
    fontStyle: "italic",
    lineHeight: 1.5,
    textAlign: "center",
  },
  contatoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 22,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    width: "100%",
  },
  contatoLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contatoTxt: { fontSize: 9, color: NAVY },
  contatoIcone: {
    width: 20,
    height: 20,
    backgroundColor: NAVY,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
})

const DOTTED_LINE =
  "· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·"

export function FaturaAgrupadaPDF({
  data,
  logoPath,
}: {
  data: FaturaAgrupadaData
  logoPath: string | null
}) {
  return (
    <Document>
      <Page size="A4" style={[styles.page, { backgroundColor: data.empresaCor }]}>
        <View style={styles.card}>
          <View style={styles.faturaBadge}>
            <Text style={styles.faturaBadgeTxt}>FATURA</Text>
          </View>

          <View style={styles.topRow}>
            {logoPath ? (
              <Image src={logoPath} style={styles.logoImg} />
            ) : (
              <View style={styles.logoBoxFallback}>
                <Text style={styles.logoInicial}>{data.empresaNome.charAt(0)}</Text>
              </View>
            )}
          </View>

          {/* Número/data (esquerda) + Cliente (direita) na mesma linha */}
          <View style={styles.blocosRow}>
            <View style={styles.bloco}>
              <Text style={styles.metaLabel}>Número da Fatura</Text>
              <Text style={styles.metaValue}>{data.faturaNumero}</Text>
              <Text style={styles.metaLabel}>Data de Emissão</Text>
              <Text style={styles.metaValue}>{formatDateLong(data.dataEmissao)}</Text>
            </View>
            <View style={styles.bloco}>
              <Text style={styles.blocoTitulo}>Cliente</Text>
              <Text style={styles.blocoLinhaForte}>{data.cliente.nome}</Text>
              <Text style={styles.blocoLinha}>
                {data.cliente.cnpj
                  ? `CNPJ ${data.cliente.cnpj}`
                  : `CPF ${formatCPF(data.cliente.cpf)}`}
              </Text>
              {data.cliente.email && (
                <Text style={styles.blocoLinha}>{data.cliente.email}</Text>
              )}
              {data.cliente.telefone && (
                <Text style={styles.blocoLinha}>{formatTelefone(data.cliente.telefone)}</Text>
              )}
            </View>
          </View>

          {/* Tabela: Descrição + produtos | Vencimento | Parcela | Valor */}
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={{ ...styles.th, flex: 1 }}>Descrição</Text>
              <Text style={{ ...styles.th, width: 68, textAlign: "center" }}>Vencimento</Text>
              <Text style={{ ...styles.th, width: 50, textAlign: "center" }}>Parcela</Text>
              <Text style={{ ...styles.th, width: 80, textAlign: "right" }}>Valor</Text>
            </View>
            {data.parcelas.map((p, i) => (
              // `wrap={false}` — uma linha da tabela (uma parcela com seus
              // produtos+campos extras) nunca é quebrada no meio entre
              // páginas. Se não couber no resto da página atual, a linha
              // INTEIRA é empurrada pra próxima.
              <View key={i} style={styles.tableRow} wrap={false}>
                <View style={{ flex: 1 }}>
                  {p.produtos.map((prod, j) => (
                    <View key={j} style={j > 0 ? { marginTop: 7 } : {}}>
                      <Text style={styles.tdBold}>{prod.produto}</Text>
                      {prod.datasViagem && (
                        <Text style={styles.tdPeriodo}>{prod.datasViagem}</Text>
                      )}
                      {prod.camposExtras && (
                        <Text style={styles.tdCampos}>{prod.camposExtras}</Text>
                      )}
                    </View>
                  ))}
                </View>
                <Text style={{ ...styles.td, width: 68, textAlign: "center" }}>{p.dataVencimento}</Text>
                <Text style={{ ...styles.td, width: 50, textAlign: "center" }}>{p.numeroParcela}</Text>
                <Text style={{ ...styles.tdBold, width: 80, textAlign: "right" }}>{formatBRL(p.valor)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totaisBox}>
            {/* Subtotal — soma das parcelas, antes dos ajustes */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValor}>{formatBRL(data.valorTotal)}</Text>
            </View>
            {/* Juros/Multa COMBINADOS — uma linha só (decisão jun/2026). */}
            <View style={styles.totalRowSmall}>
              <Text style={styles.totalLabelAcrescimo}>Juros/Multa:</Text>
              <Text style={styles.totalValorAcrescimo}>
                +{" "}
                {formatBRL(
                  (data.juros?.valor ?? 0) + (data.multa?.valor ?? 0),
                )}
              </Text>
            </View>
            {/* Desconto */}
            <View style={styles.totalRowSmall}>
              <Text style={styles.totalLabelDesconto}>Desconto:</Text>
              <Text style={styles.totalValorDesconto}>
                − {formatBRL(data.desconto?.valor ?? 0)}
              </Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValor}>{formatBRL(data.valorFinal)}</Text>
            </View>
          </View>

          <Text style={styles.dotted}>{DOTTED_LINE}</Text>

          {(data.pix || data.dadosBancarios) && (
            // `wrap={false}` — bloco "Pagar com PIX / por transferência"
            // não pode ser quebrado entre páginas. Se não couber, é
            // empurrado inteiro pra próxima página.
            <View style={styles.pagamentoRow} wrap={false}>
              {data.pix && (
                <View style={styles.bloco}>
                  <Text style={styles.blocoTitulo}>Pagar com PIX</Text>
                  <View style={styles.pixRow}>
                    <Image src={data.pix.qrDataUrl} style={styles.pixQr} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pixDicaTitulo}>Aponte a sua câmera</Text>
                      <Text style={styles.pixDica}>ou copie e cole a chave PIX abaixo</Text>
                      <Text style={styles.pixLabel}>Chave PIX</Text>
                      <Text style={styles.pixChave}>{data.pix.chaveLabel}</Text>
                    </View>
                  </View>
                </View>
              )}
              {data.dadosBancarios && (
                <View style={styles.bloco}>
                  <Text style={{ ...styles.blocoTitulo, textAlign: data.pix ? "right" : "left" }}>
                    Pagar por transferência
                  </Text>
                  <View style={{ alignItems: data.pix ? "flex-end" : "flex-start" }}>
                    <Text style={styles.bankLabel}>Titular</Text>
                    <Text style={styles.bankValue}>{data.dadosBancarios.titular}</Text>
                    <Text style={styles.bankLabel}>Banco</Text>
                    <Text style={styles.bankValue}>{data.dadosBancarios.banco}</Text>
                    <Text style={styles.bankLabel}>Agência / Conta</Text>
                    <Text style={styles.bankValue}>
                      Ag. {data.dadosBancarios.agencia} · Conta {data.dadosBancarios.conta}
                    </Text>
                    <Text style={styles.bankLabel}>CNPJ do titular</Text>
                    <Text style={styles.bankValue}>{data.dadosBancarios.cnpjTitular}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.footerStack}>
            <Text style={styles.agradecimentoCenter}>
              Agradecemos a sua preferência!{"\n"}
              Em caso de dúvidas, entre em contato com seu atendente {data.empresaNome}.
            </Text>
            <View style={styles.contatoRow}>
              <Link src="https://magictrips.com.br/" style={{ ...styles.contatoLinha, textDecoration: "none" }}>
                <View style={styles.contatoIcone}><IconeGlobe /></View>
                <Text style={styles.contatoTxt}>magictrips.com.br</Text>
              </Link>
              <Link src="https://instagram.com/magictripsbrasil" style={{ ...styles.contatoLinha, textDecoration: "none" }}>
                <View style={styles.contatoIcone}><IconeInstagram /></View>
                <Text style={styles.contatoTxt}>/magictripsbrasil</Text>
              </Link>
              <Link src="mailto:contato@magictrips.com.br" style={{ ...styles.contatoLinha, textDecoration: "none" }}>
                <View style={styles.contatoIcone}><IconeEnvelope /></View>
                <Text style={styles.contatoTxt}>contato@magictrips.com.br</Text>
              </Link>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

const IconeGlobe = () => (
  <Svg width="12" height="12" viewBox="0 0 24 24">
    <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={CORES.branco} strokeWidth={1.8} fill="none" />
    <Path d="M2 12h20" stroke={CORES.branco} strokeWidth={1.8} fill="none" />
    <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={CORES.branco} strokeWidth={1.8} fill="none" />
  </Svg>
)

const IconeInstagram = () => (
  <Svg width="12" height="12" viewBox="0 0 24 24">
    <Rect x="3" y="3" width="18" height="18" rx="5" stroke={CORES.branco} strokeWidth={1.8} fill="none" />
    <Path d="M16 11.37a4 4 0 1 1-7.914 1.26 4 4 0 0 1 7.914-1.26z" stroke={CORES.branco} strokeWidth={1.8} fill="none" />
    <Path d="M17.5 6.5h0" stroke={CORES.branco} strokeWidth={2.2} strokeLinecap="round" fill="none" />
  </Svg>
)

const IconeEnvelope = () => (
  <Svg width="12" height="12" viewBox="0 0 24 24">
    <Rect x="3" y="5" width="18" height="14" rx="2" stroke={CORES.branco} strokeWidth={1.8} fill="none" />
    <Path d="M3 7l9 6 9-6" stroke={CORES.branco} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
)
