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
  formatDate,
  formatDateLong,
  formatCPF,
  formatTelefone,
} from "./pdf-utils"

/**
 * Dados pré-formatados pra renderizar uma fatura. Tudo que o PDF precisa
 * vem já resolvido (nomes, valores numéricos, datas ISO). O componente é
 * pure render — sem chamadas externas.
 */
export type FaturaData = {
  empresaNome: string
  empresaCor: string
  empresaSlug: string
  empresaLogoPath: string | null
  vendaIdentificador: string
  dataVenda: string
  faturaNumero: string
  dataEmissao: string
  cliente: {
    nome: string
    cpf: string | null
    cnpj: string | null
    email: string | null
    telefone: string | null
  }
  parcela: {
    numero: number
    total: number
    /** Taxa em % cobrada do cliente sobre o valor base. 0 = sem taxa.
     *  Quando > 0, exibida no resumo abaixo do Subtotal. */
    taxaCobranca: number
    /** Valor BASE (sem taxa) — usado pra calcular o subtotal/quanto da
     *  taxa foi acrescentado. Em parcelas geradas com taxa, o valor já
     *  vem inflado; o base é = valor / (1+taxa/100). */
    valorBase: number
    /**
     * Ajustes opcionais exibidos entre Subtotal e Total. Cada um traz o
     * percentual (sobre o valorBase) e o valor monetário pra renderizar
     * no formato `Desconto (5,00%): R$ 50,00`.
     *
     * - `desconto` ABATE do total (linha em verde).
     * - `juros` e `multa` ACRESCENTAM ao total (linhas em vermelho).
     *
     * Quando `valor === 0` (ou o campo é `undefined`), a linha não
     * renderiza. O campo `valor` na parcela já vem com tudo aplicado
     * (subtotal − desconto + juros + multa + taxa).
     */
    desconto?: { percentual: number; valor: number }
    juros?: { percentual: number; valor: number }
    multa?: { percentual: number; valor: number }
    /**
     * Linhas estruturadas pra renderizar na descrição. Cada item é
     * um produto da venda, com 3 sub-linhas opcionais. A primeira
     * (`produto`) sempre aparece em negrito; `datasViagem` e
     * `camposExtras` aparecem em texto suave abaixo.
     */
    itens: Array<{
      produto: string
      datasViagem: string | null
      camposExtras: string | null
    }>
    valor: number
    dataVencimento: string
    formaPagamento: string
    statusLabel: string
  }
  instrucaoPagamento: string | null
  /**
   * Bloco PIX — chave + BR Code (Pix copia e cola) + QR como data URL
   * PNG já renderizado pelo server. Quando null, o bloco PIX não é
   * exibido (caller pode pular pra faturas que não aceitam PIX).
   */
  pix: {
    chave: string
    chaveLabel: string
    qrDataUrl: string
    brCode: string
  } | null
  /**
   * Dados bancários — exibidos como alternativa ao PIX. Quando null,
   * o bloco de transferência não aparece.
   */
  dadosBancarios: {
    banco: string
    agencia: string
    conta: string
    titular: string
    cnpjTitular: string
  } | null
}

// Paleta do template:
//  - NAVY: borda ao redor + header da tabela
//  - YELLOW: badge "FATURA" pop-out
//  - LINE: cinza claro pra divisor pontilhado/tabela
const NAVY = "#1A1F4D"
const YELLOW = "#F4B81C"
const LINE = "#E5E7EB"
const BORDA = 28 // largura da moldura navy ao redor

const styles = StyleSheet.create({
  // Página recebe fundo navy; o conteúdo branco fica num View interno
  // com margens iguais a `BORDA` em cada lado, criando o efeito de
  // moldura grossa.
  //
  // `paddingTop` é maior que BORDA (28 → 56) por uma razão chave: quando
  // o conteúdo quebra pra uma 2ª página, o `paddingTop` do `card` (View)
  // NÃO reaplica — só o `Page.padding` repete em toda página. Sem isso,
  // a página 2 tinha o conteúdo grudado na linha azul superior. O efeito
  // colateral é uma faixa navy mais alta no topo (28pt a mais), mas isso
  // soluciona o problema de respiro consistente em todas as páginas.
  page: {
    fontFamily: FONTE_NEXUS,
    fontSize: 9,
    color: NAVY,
    paddingTop: BORDA + 28,
    paddingBottom: BORDA,
    paddingHorizontal: BORDA,
    backgroundColor: NAVY,
  },

  // Card branco principal — todo o miolo da fatura mora aqui.
  card: {
    flex: 1,
    backgroundColor: CORES.branco,
    // `paddingTop: 56` — feedback do cliente jun/2026: o logo+nome da
    // empresa estavam muito próximos do traço navy superior. 56pt dá
    // ~20pt a mais de respiro entre a moldura azul e a primeira linha
    // de conteúdo (topRow com logo + empresaNome).
    //
    // `paddingBottom: 110` reserva espaço para o `footerStack`
    // (position: absolute) — sem isso, conteúdo de fluxo (PIX /
    // transferência) sobrepunha o rodapé. ~110pt = altura do footer
    // (agradecimento ~30 + gap 10 + contatos ~30) + offset bottom: 28
    // + folga visual.
    paddingTop: 56,
    paddingHorizontal: 36,
    paddingBottom: 110,
    position: "relative",
  },

  // ── Badge amarelo "FATURA" — ancorada na borda superior direita ──
  // Posicionada com TOP NEGATIVO de modo a "estourar" pra cima da
  // borda navy, criando o efeito do template. A altura é ajustada pra
  // que a porção amarela visível DENTRO do card (abaixo da borda navy)
  // tenha aproximadamente o mesmo respiro acima e abaixo da palavra
  // "FATURA". `justifyContent: center` centraliza o texto no recorte
  // visível (BORDA é "comido" pela moldura navy).
  faturaBadge: {
    position: "absolute",
    top: -BORDA, // sobe até cortar a borda navy
    right: 60,
    width: 110,
    height: BORDA + 60, // 28 escondidos atrás da borda + 60 visíveis
    backgroundColor: YELLOW,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: BORDA, // empurra o texto pro centro do recorte visível
  },
  faturaBadgeTxt: {
    fontSize: 16,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
    letterSpacing: 0.6,
  },

  // ── Topo: logo + nome da empresa ─────────────────────────────────
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  // Logo da empresa renderizada solo (sem fundo) — a imagem cuida do
  // próprio estilo. Aumentamos o tamanho pra dar peso visual já que
  // não tem mais a caixa azul ao redor.
  // Logo maior já que não tem mais texto ao lado.
  logoImg: { width: 72, height: 72, objectFit: "contain" },
  // Fallback quando não há arquivo de logo: caixa azul com a inicial.
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
  // empresaNome / empresaTagline removidos — só a logo no topo agora.

  // ── Meta (número/data) ──────────────────────────────────────────
  meta: { marginBottom: 18 },
  metaLabel: {
    fontSize: 10,
    fontFamily: FONTE_NEXUS,
    fontWeight: "bold",
    color: NAVY,
  },
  metaValue: { fontSize: 9.5, color: NAVY, marginTop: 1, marginBottom: 8 },

  // ── Bill To / Ship To ────────────────────────────────────────────
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

  // ── Tabela ───────────────────────────────────────────────────────
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
  // Sub-linhas da descrição (datas + campos personalizados).
  // Mais sutil — tom mais claro e fonte menor.
  tdSub: {
    fontSize: 8,
    color: NAVY,
    opacity: 0.65,
    marginTop: 2,
    lineHeight: 1.4,
  },

  // ── Totais ───────────────────────────────────────────────────────
  totaisBox: {
    alignItems: "flex-end",
    marginTop: 8,
    marginBottom: 14,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
    minWidth: 200,
  },
  totalLabel: { fontSize: 10, color: NAVY, width: 110, textAlign: "right" },
  totalValor: {
    fontSize: 10,
    color: NAVY,
    width: 80,
    textAlign: "right",
  },
  // Versão compacta — usada em Desconto / Taxa pra dar menos peso
  // visual abaixo do Subtotal.
  totalRowSmall: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
    minWidth: 200,
  },
  totalLabelSmall: {
    fontSize: 8,
    color: NAVY,
    opacity: 0.7,
    width: 110,
    textAlign: "right",
  },
  totalValorSmall: {
    fontSize: 8,
    color: NAVY,
    opacity: 0.7,
    width: 80,
    textAlign: "right",
  },
  // Linhas de ajuste (desconto/juros/multa) — mesma estrutura compacta
  // do `totalRowSmall`. Decisão jun/2026: sem cores semânticas (vermelho/
  // verde) — tudo em navy igual o Subtotal pra leitura sóbria e firme.
  // Os sinais `+ / −` ao lado do valor já comunicam o sentido.
  totalLabelDesconto: {
    fontSize: 8,
    color: NAVY,
    width: 130,
    textAlign: "right",
  },
  totalValorDesconto: {
    // Valor SEM bold (decisão jun/2026) — alinha com o estilo do label,
    // dando uma leitura mais leve. Os sinais `+ / −` continuam.
    fontSize: 8,
    color: NAVY,
    width: 80,
    textAlign: "right",
  },
  totalLabelAcrescimo: {
    fontSize: 8,
    color: NAVY,
    width: 130,
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

  // ── Divisor pontilhado ──────────────────────────────────────────
  // @react-pdf não suporta border-style: dotted/dashed, então emulamos
  // com uma linha de pontos via texto repetido em tamanho pequeno.
  dotted: {
    fontSize: 6,
    color: NAVY,
    opacity: 0.4,
    marginVertical: 16,
    letterSpacing: 1.5,
  },

  // ── Pagamento + Notas ───────────────────────────────────────────
  pagamentoRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 18,
  },
  // PIX: QR à esquerda + chave à direita
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
  // Dados bancários — bloco compacto pra balancear visualmente o
  // peso do PIX (que tem QR code grande). Labels minúsculos, valores
  // levemente reduzidos pra que toda a coluna caiba sem alongar a
  // página.
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

  // ── Footer ──────────────────────────────────────────────────────
  // Stack vertical: mensagem em cima (full-width) + linha de contatos
  // embaixo. Compacta mais que o layout em duas colunas e libera
  // espaço vertical pro conteúdo do meio (PIX/transferência).
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
  // Linha horizontal com os 3 contatos centralizados.
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
  // Círculo navy com glifo/letra branca — emula os ícones do template.
  contatoIcone: {
    width: 20,
    height: 20,
    backgroundColor: NAVY,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  // contatoIconeTxt removido — os ícones agora são SVGs.
})

// Linha pontilhada com largura "infinita" — repete o caractere até
// preencher a tela. Funciona bem em A4 com margens conhecidas.
const DOTTED_LINE =
  "· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·"

export function FaturaPDF({
  data,
  logoPath,
}: {
  data: FaturaData
  logoPath: string | null
}) {
  // Texto compacto formado por chunks pra evitar problemas de quebra
  // de string longa em widths variáveis.

  return (
    <Document>
      {/* A borda da página (área de padding) usa a cor da empresa
          (cor_primaria) em vez de NAVY pra casar com o tom da logo. */}
      <Page
        size="A4"
        style={[styles.page, { backgroundColor: data.empresaCor }]}
      >
        {/* Card branco com toda a fatura */}
        <View style={styles.card}>
          {/* Badge amarelo "FATURA" — pop-out na borda superior */}
          <View style={styles.faturaBadge}>
            <Text style={styles.faturaBadgeTxt}>FATURA</Text>
          </View>

          {/* Logo da empresa — sem nome/tagline (a empresa já está
              identificada visualmente pela logo + pelo footer). */}
          <View style={styles.topRow}>
            {logoPath ? (
              <Image src={logoPath} style={styles.logoImg} />
            ) : (
              <View style={styles.logoBoxFallback}>
                <Text style={styles.logoInicial}>
                  {data.empresaNome.charAt(0)}
                </Text>
              </View>
            )}
          </View>

          {/* Meta */}
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Número da Fatura</Text>
            <Text style={styles.metaValue}>{data.faturaNumero}</Text>
            <Text style={styles.metaLabel}>Data de Emissão</Text>
            <Text style={styles.metaValue}>
              {formatDateLong(data.dataEmissao)}
            </Text>
          </View>

          {/* Cobrar de + Referência (no lugar do Bill To / Ship To) */}
          <View style={styles.blocosRow}>
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
                <Text style={styles.blocoLinha}>
                  {formatTelefone(data.cliente.telefone)}
                </Text>
              )}
            </View>
            <View style={styles.bloco}>
              <Text style={styles.blocoTitulo}>Referência</Text>
              <Text style={styles.blocoLinhaForte}>
                Venda {data.vendaIdentificador}
              </Text>
              <Text style={styles.blocoLinha}>
                Parcela {data.parcela.numero} de {data.parcela.total}
              </Text>
              <Text style={styles.blocoLinha}>
                Emitida em {formatDate(data.dataVenda)}
              </Text>
              <Text style={styles.blocoLinha}>
                Vencimento {formatDate(data.parcela.dataVencimento)}
              </Text>
            </View>
          </View>

          {/* Tabela */}
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={{ ...styles.th, flex: 1 }}>Descrição</Text>
              <Text style={{ ...styles.th, width: 110, textAlign: "right" }}>
                Valor
              </Text>
            </View>
            {/* Cada item da parcela vira sua própria linha-View com
                `wrap={false}` — assim um produto (com suas datas + campos
                extras) nunca quebra entre páginas. O valor da parcela
                aparece na PRIMEIRA linha (rowspan visual). */}
            {data.parcela.itens.map((item, i) => (
              <View key={i} style={styles.tableRow} wrap={false}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tdBold}>{item.produto}</Text>
                  {item.datasViagem && (
                    <Text style={styles.tdSub}>
                      Viagem: {item.datasViagem}
                    </Text>
                  )}
                  {item.camposExtras && (
                    <Text style={styles.tdSub}>{item.camposExtras}</Text>
                  )}
                </View>
                {i === 0 && (
                  <Text style={{ ...styles.tdBold, width: 110, textAlign: "right" }}>
                    {formatBRL(data.parcela.valor)}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Totais — Subtotal (valor BASE sem taxa) + linha de Taxa
              quando aplicável + Total final. */}
          <View style={styles.totaisBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValor}>
                {formatBRL(data.parcela.valorBase)}
              </Text>
            </View>
            {data.parcela.taxaCobranca > 0 && (
              <View style={styles.totalRowSmall}>
                <Text style={styles.totalLabelSmall}>
                  Taxa de cobrança ({data.parcela.taxaCobranca.toFixed(2).replace(".", ",")}%):
                </Text>
                <Text style={styles.totalValorSmall}>
                  {formatBRL(
                    data.parcela.valor -
                      data.parcela.valorBase +
                      (data.parcela.desconto?.valor ?? 0) -
                      (data.parcela.juros?.valor ?? 0) -
                      (data.parcela.multa?.valor ?? 0),
                  )}
                </Text>
              </View>
            )}
            {/* Juros/Multa COMBINADOS — uma linha só (decisão jun/2026). */}
            <View style={styles.totalRowSmall}>
              <Text style={styles.totalLabelAcrescimo}>Juros/Multa:</Text>
              <Text style={styles.totalValorAcrescimo}>
                +{" "}
                {formatBRL(
                  (data.parcela.juros?.valor ?? 0) +
                    (data.parcela.multa?.valor ?? 0),
                )}
              </Text>
            </View>
            {/* Desconto */}
            <View style={styles.totalRowSmall}>
              <Text style={styles.totalLabelDesconto}>Desconto:</Text>
              <Text style={styles.totalValorDesconto}>
                − {formatBRL(data.parcela.desconto?.valor ?? 0)}
              </Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValor}>
                {formatBRL(data.parcela.valor)}
              </Text>
            </View>
          </View>

          {/* Divisor pontilhado */}
          <Text style={styles.dotted}>{DOTTED_LINE}</Text>

          {/* Como pagar — PIX (com QR Code + chave) à esquerda, dados
              bancários à direita. Ambos os blocos são opcionais, mas
              quando exibidos ocupam o lugar do antigo "Forma de pagamento". */}
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
                      <Text style={styles.pixDicaTitulo}>
                        Aponte a sua câmera
                      </Text>
                      <Text style={styles.pixDica}>
                        ou copie e cole a chave PIX abaixo
                      </Text>
                      <Text style={styles.pixLabel}>Chave PIX</Text>
                      <Text style={styles.pixChave}>
                        {data.pix.chaveLabel}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {data.dadosBancarios && (
                <View style={styles.bloco}>
                  <Text
                    style={{
                      ...styles.blocoTitulo,
                      textAlign: data.pix ? "right" : "left",
                    }}
                  >
                    Pagar por transferência
                  </Text>
                  <View
                    style={{ alignItems: data.pix ? "flex-end" : "flex-start" }}
                  >
                    <Text style={styles.bankLabel}>Titular</Text>
                    <Text style={styles.bankValue}>
                      {data.dadosBancarios.titular}
                    </Text>
                    <Text style={styles.bankLabel}>Banco</Text>
                    <Text style={styles.bankValue}>
                      {data.dadosBancarios.banco}
                    </Text>
                    <Text style={styles.bankLabel}>Agência / Conta</Text>
                    <Text style={styles.bankValue}>
                      Ag. {data.dadosBancarios.agencia} · Conta{" "}
                      {data.dadosBancarios.conta}
                    </Text>
                    <Text style={styles.bankLabel}>CNPJ do titular</Text>
                    <Text style={styles.bankValue}>
                      {data.dadosBancarios.cnpjTitular}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Footer fixo no rodapé do card — mensagem em cima ocupando
              toda a largura e os 3 contatos em linha embaixo. Layout
              vertical libera mais respiro vertical pro conteúdo do meio
              (Pagar com PIX / por transferência). */}
          <View style={styles.footerStack}>
            <Text style={styles.agradecimentoCenter}>
              Agradecemos a sua preferência!
              {"\n"}
              Em caso de dúvidas, entre em contato com seu atendente{" "}
              {data.empresaNome}.
            </Text>
            <View style={styles.contatoRow}>
              <Link
                src="https://magictrips.com.br/"
                style={{ ...styles.contatoLinha, textDecoration: "none" }}
              >
                <View style={styles.contatoIcone}>
                  <IconeGlobe />
                </View>
                <Text style={styles.contatoTxt}>magictrips.com.br</Text>
              </Link>
              <Link
                src="https://instagram.com/magictripsbrasil"
                style={{ ...styles.contatoLinha, textDecoration: "none" }}
              >
                <View style={styles.contatoIcone}>
                  <IconeInstagram />
                </View>
                <Text style={styles.contatoTxt}>/magictripsbrasil</Text>
              </Link>
              <Link
                src="mailto:contato@magictrips.com.br"
                style={{ ...styles.contatoLinha, textDecoration: "none" }}
              >
                <View style={styles.contatoIcone}>
                  <IconeEnvelope />
                </View>
                <Text style={styles.contatoTxt}>
                  contato@magictrips.com.br
                </Text>
              </Link>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// ─── Ícones SVG inline (12pt) ────────────────────────────────────────────────
// Renderizados dentro do círculo navy de 20pt. Stroke branco pra contraste.
// Coordenadas em viewBox 24x24 (padrão Lucide / Heroicons).

const IconeGlobe = () => (
  <Svg width="12" height="12" viewBox="0 0 24 24">
    <Path
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
      stroke={CORES.branco}
      strokeWidth={1.8}
      fill="none"
    />
    <Path
      d="M2 12h20"
      stroke={CORES.branco}
      strokeWidth={1.8}
      fill="none"
    />
    <Path
      d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      stroke={CORES.branco}
      strokeWidth={1.8}
      fill="none"
    />
  </Svg>
)

const IconeInstagram = () => (
  <Svg width="12" height="12" viewBox="0 0 24 24">
    <Rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="5"
      stroke={CORES.branco}
      strokeWidth={1.8}
      fill="none"
    />
    <Path
      d="M16 11.37a4 4 0 1 1-7.914 1.26 4 4 0 0 1 7.914-1.26z"
      stroke={CORES.branco}
      strokeWidth={1.8}
      fill="none"
    />
    <Path
      d="M17.5 6.5h0"
      stroke={CORES.branco}
      strokeWidth={2.2}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
)

const IconeEnvelope = () => (
  <Svg width="12" height="12" viewBox="0 0 24 24">
    <Rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
      stroke={CORES.branco}
      strokeWidth={1.8}
      fill="none"
    />
    <Path
      d="M3 7l9 6 9-6"
      stroke={CORES.branco}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
)
