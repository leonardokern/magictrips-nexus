import { type NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { buildRelatorioTipoProduto } from "@/lib/relatorios/tipo-produto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function brDate(iso: string): string {
  if (!ISO_RE.test(iso)) return ""
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export async function POST(req: NextRequest) {
  const user = await requireCurrentUser()
  if (!can(user, "relatorios", "ver")) {
    return NextResponse.json(
      { error: "Sem permissão para gerar relatórios." },
      { status: 403 },
    )
  }

  let body: { tipoProdutoId?: unknown; dataInicio?: unknown; dataFim?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 })
  }

  const tipoProdutoId = typeof body.tipoProdutoId === "string" ? body.tipoProdutoId : ""
  const dataInicio = typeof body.dataInicio === "string" ? body.dataInicio : ""
  const dataFim = typeof body.dataFim === "string" ? body.dataFim : ""

  if (!tipoProdutoId) {
    return NextResponse.json({ error: "Selecione um tipo de produto." }, { status: 400 })
  }
  if (!ISO_RE.test(dataInicio) || !ISO_RE.test(dataFim)) {
    return NextResponse.json({ error: "Informe um intervalo de datas válido." }, { status: 400 })
  }
  if (dataInicio > dataFim) {
    return NextResponse.json({ error: "Data inicial maior que a final." }, { status: 400 })
  }

  const supabase = await createClient()
  const res = await buildRelatorioTipoProduto(supabase, { tipoProdutoId, dataInicio, dataFim })
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  const { tipoProdutoNome, campos, linhas, totais } = res.data

  const wb = new ExcelJS.Workbook()
  wb.creator = "Nexus · Magic Trips"
  wb.created = new Date()

  const ws = wb.addWorksheet(tipoProdutoNome.slice(0, 28) || "Relatório", {
    views: [{ state: "frozen", ySplit: 4 }],
  })

  const MONEY = '"R$" #,##0.00'

  // Definição de colunas (dinâmica): identidade → 1 coluna por campo
  // customizado do tipo → valores financeiros. `kind` controla formatação
  // e quais entram nos totais.
  type Linha = (typeof linhas)[number]
  type ColDef = {
    header: string
    width: number
    kind: "date" | "text" | "money"
    get: (l: Linha) => string | number | null
  }

  const isoToDate = (iso: string): Date | null => {
    const [y, m, d] = iso.split("-").map(Number)
    return y ? new Date(y, (m ?? 1) - 1, d ?? 1) : null
  }

  const cols: ColDef[] = [
    { header: "Data", width: 12, kind: "date", get: (l) => l.dataVenda || "" },
    { header: "ID Nexus", width: 11, kind: "text", get: (l) => l.identificador },
    { header: "Empresa", width: 14, kind: "text", get: (l) => l.empresa },
    { header: "Cliente", width: 24, kind: "text", get: (l) => l.cliente },
    { header: "Vendedor(a)", width: 20, kind: "text", get: (l) => l.vendedor },
    { header: "Fornecedor", width: 20, kind: "text", get: (l) => l.fornecedor },
    { header: "Destino", width: 18, kind: "text", get: (l) => l.destino },
    { header: "Localizador", width: 14, kind: "text", get: (l) => l.localizador },
    { header: "Início viagem", width: 12, kind: "date", get: (l) => l.dataInicioViagem || "" },
    { header: "Fim viagem", width: 12, kind: "date", get: (l) => l.dataFimViagem || "" },
    // Uma coluna por campo customizado do tipo, com o valor de cada venda.
    ...campos.map(
      (c): ColDef => ({
        header: c.nome,
        width: 18,
        kind: "text",
        get: (l) => l.valoresCampos[c.id] ?? "",
      }),
    ),
    { header: "Valor Venda", width: 15, kind: "money", get: (l) => l.valorVenda },
    { header: "Custo", width: 15, kind: "money", get: (l) => l.valorCusto },
    { header: "RAV", width: 13, kind: "money", get: (l) => l.rav },
    { header: "RAV Extra Cliente", width: 15, kind: "money", get: (l) => l.ravExtraCliente },
    { header: "RAV Extra Fornec.", width: 16, kind: "money", get: (l) => l.ravExtraFornecedor },
    { header: "RAV Total", width: 14, kind: "money", get: (l) => l.ravTotal },
    { header: "Comissão", width: 16, kind: "money", get: (l) => l.comissao },
  ]
  const LAST_COL = cols.length
  const firstMoneyIdx = cols.findIndex((c) => c.kind === "money") // 0-based
  ws.columns = cols.map((c) => ({ width: c.width }))

  // Letra da coluna Excel (1 → A, 27 → AA…), pra montar fórmulas SUM.
  const colLetter = (n: number): string => {
    let s = ""
    while (n > 0) {
      const m = (n - 1) % 26
      s = String.fromCharCode(65 + m) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }

  // ── Faixa-título (linha 1) ──────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, LAST_COL)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `Relatório de Vendas · ${tipoProdutoNome}`
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } }
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF004E5A" } }
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
  ws.getRow(1).height = 26

  // ── Subtítulo período (linha 2) ─────────────────────────────────────────
  ws.mergeCells(2, 1, 2, LAST_COL)
  const periodoCell = ws.getCell(2, 1)
  periodoCell.value = `Período: ${brDate(dataInicio)} a ${brDate(dataFim)}   ·   ${totais.qtdProdutos} produto(s) em ${totais.qtdVendas} venda(s)   ·   Apenas vendas aprovadas`
  periodoCell.font = { name: "Calibri", size: 10, color: { argb: "FF595959" } }
  periodoCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
  ws.getRow(2).height = 18

  // Linha 3 em branco como respiro
  ws.getRow(3).height = 6

  // ── Cabeçalho da tabela (linha 4) ───────────────────────────────────────
  const headRow = ws.getRow(4)
  cols.forEach((c, i) => {
    headRow.getCell(i + 1).value = c.header
  })
  headRow.height = 20
  headRow.eachCell((cell, col) => {
    if (col > LAST_COL) return
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF595959" } }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    }
  })

  // ── Linhas de dados ─────────────────────────────────────────────────────
  let rowIdx = 5
  for (const l of linhas) {
    const row = ws.getRow(rowIdx)
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      const raw = c.get(l)
      if (c.kind === "date") {
        cell.value = typeof raw === "string" && raw ? isoToDate(raw) : null
        cell.numFmt = "dd/mm/yyyy"
      } else if (c.kind === "money") {
        cell.value = typeof raw === "number" ? raw : 0
        cell.numFmt = MONEY
      } else {
        cell.value = raw === "" ? null : raw
      }
    })
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > LAST_COL) return
      cell.font = { name: "Calibri", size: 10 }
      cell.alignment = { vertical: "middle" }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      }
    })
    rowIdx++
  }

  // ── Linha de totais ─────────────────────────────────────────────────────
  if (linhas.length > 0) {
    const totalRow = ws.getRow(rowIdx)
    // Label "TOTAL" na coluna imediatamente antes do 1º valor financeiro.
    if (firstMoneyIdx > 0) totalRow.getCell(firstMoneyIdx).value = "TOTAL"
    cols.forEach((c, i) => {
      if (c.kind !== "money") return
      const L = colLetter(i + 1)
      const cell = totalRow.getCell(i + 1)
      cell.value = { formula: `SUM(${L}5:${L}${rowIdx - 1})` }
      cell.numFmt = MONEY
    })
    const totalFrom = Math.max(1, firstMoneyIdx)
    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > LAST_COL || col < totalFrom) return
      cell.font = { name: "Calibri", size: 10, bold: true }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAEAEA" } }
      cell.alignment = { vertical: "middle", horizontal: "right" }
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
      }
    })
  } else {
    ws.mergeCells(rowIdx, 1, rowIdx, LAST_COL)
    const vazio = ws.getCell(rowIdx, 1)
    vazio.value = "Nenhuma venda aprovada encontrada nesse período para o tipo selecionado."
    vazio.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF888888" } }
    vazio.alignment = { vertical: "middle", horizontal: "center" }
    ws.getRow(rowIdx).height = 22
  }

  const buffer = await wb.xlsx.writeBuffer()

  const slug = tipoProdutoNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30)
  const filename = `relatorio-${slug || "tipo-produto"}-${dataInicio}_${dataFim}.xlsx`

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
