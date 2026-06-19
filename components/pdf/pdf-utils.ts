import { StyleSheet } from "@react-pdf/renderer"

// ─── Cores ────────────────────────────────────────────────────────────────────

export const CORES = {
  magicTrips: "#1498D5",
  delMondo: "#1498D5",
  nexusDeep: "#004E5A",
  nexusBright: "#1498D5",
  escuro: "#111827",
  texto: "#1f2937",
  textoSuave: "#6b7280",
  divisor: "#e5e7eb",
  fundoCard: "#f9fafb",
  fundoTabela: "#f3f4f6",
  verde: "#059669",
  vermelho: "#dc2626",
  amarelo: "#d97706",
  branco: "#ffffff",
}

export function corEmpresa(slug: string): string {
  if (slug === "del-mondo") return CORES.delMondo
  return CORES.magicTrips
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "—"
  const n = cpf.replace(/\D/g, "")
  if (n.length !== 11) return cpf
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
}

export function formatTelefone(tel: string | null | undefined): string {
  if (!tel) return "—"
  const n = tel.replace(/\D/g, "")
  if (n.length === 11)
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10)
    return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return tel
}

export const PGTO_FORMA_LABEL: Record<string, string> = {
  faturado: "Faturado",
  cartao: "Cartão",
  pix: "PIX",
  boleto: "Boleto",
  deposito: "Depósito",
  dinheiro: "Dinheiro",
  outro: "Outro",
}

export const COBRANCA_TIPO_LABEL: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  faturado: "Faturado",
  outro: "Outro",
}

// ─── Estilos base compartilhados ──────────────────────────────────────────────

export const baseStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: CORES.texto,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    backgroundColor: CORES.branco,
  },
  // Header da página
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.divisor,
  },
  empresaNome: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  docTipo: {
    fontSize: 7,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  // Seção
  section: {
    marginBottom: 12,
  },
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
  // Grid de stats
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 6,
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 8.5,
    color: CORES.texto,
  },
  // Tabela
  table: {
    width: "100%",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: CORES.fundoTabela,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: CORES.divisor,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: CORES.divisor,
    backgroundColor: CORES.fundoCard,
  },
  tableRowTotal: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: CORES.fundoTabela,
    borderTopWidth: 1,
    borderTopColor: CORES.divisor,
  },
  thCell: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: CORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tdCell: {
    fontSize: 7.5,
    color: CORES.texto,
  },
  tdCellSuave: {
    fontSize: 7.5,
    color: CORES.textoSuave,
  },
  tdCellBold: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.texto,
  },
  // Footer da página
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: CORES.divisor,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 6,
    color: CORES.textoSuave,
  },
})
