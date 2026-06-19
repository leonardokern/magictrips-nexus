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

  const { tipoProdutoNome, linhas, totais } = res.data

  const wb = new ExcelJS.Workbook()
  wb.creator = "Nexus · Magic Trips"
  wb.created = new Date()

  const ws = wb.addWorksheet(tipoProdutoNome.slice(0, 28) || "Relatório", {
    views: [{ state: "frozen", ySplit: 4 }],
  })

  const MONEY = '"R$" #,##0.00'

  ws.columns = [
    { key: "data", width: 12 },
    { key: "id", width: 11 },
    { key: "empresa", width: 14 },
    { key: "cliente", width: 24 },
    { key: "vendedor", width: 20 },
    { key: "fornecedor", width: 20 },
    { key: "destino", width: 18 },
    { key: "localizador", width: 14 },
    { key: "ini_viagem", width: 12 },
    { key: "fim_viagem", width: 12 },
    { key: "detalhes", width: 36 },
    { key: "valor", width: 15 },
    { key: "custo", width: 15 },
    { key: "rav", width: 13 },
    { key: "rav_cli", width: 15 },
    { key: "rav_forn", width: 16 },
    { key: "rav_total", width: 14 },
    { key: "comissao", width: 16 },
  ]
  const LAST_COL = 18

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
  const HEAD = [
    "Data",
    "ID Nexus",
    "Empresa",
    "Cliente",
    "Vendedor(a)",
    "Fornecedor",
    "Destino",
    "Localizador",
    "Início viagem",
    "Fim viagem",
    "Detalhes",
    "Valor Venda",
    "Custo",
    "RAV",
    "RAV Extra Cliente",
    "RAV Extra Fornec.",
    "RAV Total",
    "Comissão",
  ]
  const headRow = ws.getRow(4)
  HEAD.forEach((h, i) => {
    headRow.getCell(i + 1).value = h
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
    const dv = l.dataVenda.split("-").map(Number)
    row.getCell(1).value = dv[0] ? new Date(dv[0], (dv[1] ?? 1) - 1, dv[2] ?? 1) : null
    row.getCell(1).numFmt = "dd/mm/yyyy"
    row.getCell(2).value = l.identificador
    row.getCell(3).value = l.empresa
    row.getCell(4).value = l.cliente
    row.getCell(5).value = l.vendedor
    row.getCell(6).value = l.fornecedor
    row.getCell(7).value = l.destino
    row.getCell(8).value = l.localizador
    if (l.dataInicioViagem) {
      const di = l.dataInicioViagem.split("-").map(Number)
      row.getCell(9).value = di[0] ? new Date(di[0], (di[1] ?? 1) - 1, di[2] ?? 1) : null
      row.getCell(9).numFmt = "dd/mm/yyyy"
    }
    if (l.dataFimViagem) {
      const df = l.dataFimViagem.split("-").map(Number)
      row.getCell(10).value = df[0] ? new Date(df[0], (df[1] ?? 1) - 1, df[2] ?? 1) : null
      row.getCell(10).numFmt = "dd/mm/yyyy"
    }
    row.getCell(11).value = l.detalhes
    row.getCell(12).value = l.valorVenda
    row.getCell(13).value = l.valorCusto
    row.getCell(14).value = l.rav
    row.getCell(15).value = l.ravExtraCliente
    row.getCell(16).value = l.ravExtraFornecedor
    row.getCell(17).value = l.ravTotal
    row.getCell(18).value = l.comissao
    for (let c = 12; c <= 18; c++) row.getCell(c).numFmt = MONEY

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > LAST_COL) return
      cell.font = { name: "Calibri", size: 10 }
      cell.alignment = { vertical: "middle", wrapText: col === 11 }
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
    totalRow.getCell(11).value = "TOTAL"
    totalRow.getCell(12).value = { formula: `SUM(L5:L${rowIdx - 1})` }
    totalRow.getCell(13).value = { formula: `SUM(M5:M${rowIdx - 1})` }
    totalRow.getCell(14).value = { formula: `SUM(N5:N${rowIdx - 1})` }
    totalRow.getCell(15).value = { formula: `SUM(O5:O${rowIdx - 1})` }
    totalRow.getCell(16).value = { formula: `SUM(P5:P${rowIdx - 1})` }
    totalRow.getCell(17).value = { formula: `SUM(Q5:Q${rowIdx - 1})` }
    totalRow.getCell(18).value = { formula: `SUM(R5:R${rowIdx - 1})` }
    for (let c = 12; c <= 18; c++) totalRow.getCell(c).numFmt = MONEY
    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > LAST_COL || col < 11) return
      cell.font = { name: "Calibri", size: 10, bold: true }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAEAEA" } }
      cell.alignment = { vertical: "middle", horizontal: col === 11 ? "right" : "right" }
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
