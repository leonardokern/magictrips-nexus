import { type NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { buildRelatorioComissao } from "@/lib/relatorios/comissao"

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
    return NextResponse.json({ error: "Sem permissão para gerar relatórios." }, { status: 403 })
  }

  let body: { dataInicio?: unknown; dataFim?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 })
  }

  const dataInicio = typeof body.dataInicio === "string" ? body.dataInicio : ""
  const dataFim = typeof body.dataFim === "string" ? body.dataFim : ""

  if (!ISO_RE.test(dataInicio) || !ISO_RE.test(dataFim)) {
    return NextResponse.json({ error: "Informe um intervalo de datas válido." }, { status: 400 })
  }
  if (dataInicio > dataFim) {
    return NextResponse.json({ error: "Data inicial maior que a final." }, { status: 400 })
  }

  const supabase = await createClient()
  const res = await buildRelatorioComissao(supabase, { dataInicio, dataFim })
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  const { agentes, totais } = res.data

  const wb = new ExcelJS.Workbook()
  wb.creator = "Nexus · Magic Trips"
  wb.created = new Date()

  const ws = wb.addWorksheet("Comissões", { views: [{ state: "frozen", ySplit: 4 }] })

  const MONEY = '"R$" #,##0.00'
  const PCT = '0.00"%"'

  type Agente = (typeof agentes)[number]
  type ColDef = {
    header: string
    width: number
    kind: "text" | "number" | "money" | "pct"
    get: (a: Agente) => string | number | null
  }

  const cols: ColDef[] = [
    { header: "Agente", width: 28, kind: "text", get: (a) => a.nomeAgente },
    { header: "Empresa", width: 16, kind: "text", get: (a) => a.empresa || "" },
    { header: "Vendas", width: 10, kind: "number", get: (a) => a.qtdVendas },
    { header: "Valor Vendido", width: 18, kind: "money", get: (a) => a.valorVenda },
    { header: "RAV (base)", width: 18, kind: "money", get: (a) => a.ravTotal },
    { header: "Comissão", width: 18, kind: "money", get: (a) => a.comissao },
    { header: "% Médio", width: 12, kind: "pct", get: (a) => a.percentualMedio },
  ]

  const LAST_COL = cols.length
  ws.columns = cols.map((c) => ({ width: c.width }))

  const colLetter = (n: number): string => {
    let s = ""
    while (n > 0) {
      const m = (n - 1) % 26
      s = String.fromCharCode(65 + m) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }

  // Título (linha 1)
  ws.mergeCells(1, 1, 1, LAST_COL)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = "Relatório de Comissão"
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } }
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF004E5A" } }
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
  ws.getRow(1).height = 26

  // Subtítulo (linha 2)
  ws.mergeCells(2, 1, 2, LAST_COL)
  const periodoCell = ws.getCell(2, 1)
  periodoCell.value = `Período: ${brDate(dataInicio)} a ${brDate(dataFim)}   ·   Total comissões: R$ ${totais.comissao.toFixed(2).replace(".", ",")}`
  periodoCell.font = { name: "Calibri", size: 10, color: { argb: "FF595959" } }
  periodoCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
  ws.getRow(2).height = 18

  // Respiro (linha 3)
  ws.getRow(3).height = 6

  // Cabeçalho (linha 4)
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

  // Dados
  let rowIdx = 5
  for (const a of agentes) {
    const row = ws.getRow(rowIdx)
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      const raw = c.get(a)
      if (c.kind === "money") {
        cell.value = typeof raw === "number" ? raw : 0
        cell.numFmt = MONEY
      } else if (c.kind === "pct") {
        cell.value = typeof raw === "number" ? raw : null
        if (typeof raw === "number") cell.numFmt = PCT
      } else if (c.kind === "number") {
        cell.value = typeof raw === "number" ? raw : 0
        cell.alignment = { vertical: "middle", horizontal: "center" }
      } else {
        cell.value = raw === "" ? null : raw
      }
    })
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > LAST_COL) return
      cell.font = { name: "Calibri", size: 10 }
      if (!cell.alignment?.horizontal) cell.alignment = { vertical: "middle" }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      }
    })
    rowIdx++
  }

  // Linha de totais
  if (agentes.length > 0) {
    const totalRow = ws.getRow(rowIdx)
    totalRow.getCell(1).value = "TOTAL"

    const moneyCols = [4, 5, 6] // Valor Vendido, RAV, Comissão
    const numberCols = [3]      // Vendas

    for (const ci of numberCols) {
      const L = colLetter(ci)
      totalRow.getCell(ci).value = { formula: `SUM(${L}5:${L}${rowIdx - 1})` }
    }
    for (const ci of moneyCols) {
      const L = colLetter(ci)
      const cell = totalRow.getCell(ci)
      cell.value = { formula: `SUM(${L}5:${L}${rowIdx - 1})` }
      cell.numFmt = MONEY
    }

    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > LAST_COL) return
      cell.font = { name: "Calibri", size: 10, bold: true }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAEAEA" } }
      cell.alignment = { vertical: "middle", horizontal: col <= 2 ? "left" : "right" }
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
      }
    })
  } else {
    ws.mergeCells(rowIdx, 1, rowIdx, LAST_COL)
    const vazio = ws.getCell(rowIdx, 1)
    vazio.value = "Nenhum agente ativo encontrado."
    vazio.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF888888" } }
    vazio.alignment = { vertical: "middle", horizontal: "center" }
    ws.getRow(rowIdx).height = 22
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `relatorio-comissao-${dataInicio}_${dataFim}.xlsx`

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
