import { type NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { getVendasParaExportar } from "@/app/(dashboard)/vendas/export-actions"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
]

/** Espelha exatamente a planilha-modelo Magic Trips:
 *  - Header com fundo cinza-escuro #595959, texto branco, fonte Calibri 11
 *  - Bordas thin nas células
 *  - Coluna data formato dd-mm-yyyy
 *  - Valores em R$ "R$ #,##0.00"
 *  - % com 2 decimais 0.00%
 *  - 1 aba por mês, nomeada com o nome do mês em pt-BR
 */
export async function POST(req: NextRequest) {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "aprovar")) {
    return NextResponse.json(
      { error: "Sem permissão para exportar vendas." },
      { status: 403 },
    )
  }

  let body: { ids?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string") : []
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Selecione ao menos uma venda." },
      { status: 400 },
    )
  }

  const res = await getVendasParaExportar(ids)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = "Nexus · Magic Trips"
  wb.created = new Date()

  // Ordem cronológica das abas
  const meses = Object.keys(res.data.porMes).sort()

  for (const chave of meses) {
    // chave = "YYYY-MM"
    const [anoStr, mesStr] = chave.split("-")
    const ano = anoStr ? Number(anoStr) : 0
    const mes = mesStr ? Number(mesStr) : 0
    const nomeAba =
      mes >= 1 && mes <= 12
        ? `${MESES[mes - 1]}${ano && ano !== new Date().getFullYear() ? ` ${ano}` : ""}`
        : chave

    const ws = wb.addWorksheet(nomeAba, {
      views: [{ state: "frozen", ySplit: 1 }],
    })

    ws.columns = [
      { header: "data",              key: "data",       width: 13 },
      { header: "Cliente",           key: "cliente",    width: 18 },
      { header: "Fornecedor",        key: "fornecedor", width: 19 },
      { header: "Vendedora",         key: "vendedora",  width: 12 },
      { header: "Detalhamento",      key: "detalhe",    width: 32 },
      { header: "Valor da Venda",    key: "valor",      width: 16 },
      { header: "RAV BRUTO",         key: "rav",        width: 13 },
      { header: "% RAV Vendedor",    key: "perc",       width: 15 },
      { header: "Comissão Vendedor", key: "comissao",   width: 20 },
    ]

    // Header style
    const headerRow = ws.getRow(1)
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FFFFFFFF" } }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF595959" },
      }
      cell.alignment = { vertical: "middle", horizontal: "center" }
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
      }
    })

    const linhas = res.data.porMes[chave] ?? []
    let rowIdx = 2
    for (const l of linhas) {
      const row = ws.getRow(rowIdx)
      // A: data — converte ISO YYYY-MM-DD pra Date (sem timezone shift)
      const [y, m, d] = l.dataVenda.split("-").map(Number)
      row.getCell(1).value =
        y && m && d ? new Date(y, m - 1, d) : null
      row.getCell(1).numFmt = "dd-mm-yyyy"
      row.getCell(2).value = l.cliente
      row.getCell(3).value = l.fornecedor
      row.getCell(4).value = l.vendedora
      row.getCell(5).value = l.detalhamento
      row.getCell(6).value = l.valorVenda
      row.getCell(6).numFmt = '"R$" #,##0.00'
      row.getCell(7).value = l.ravBruto
      row.getCell(7).numFmt = '"R$" #,##0.00'
      row.getCell(8).value = l.comissaoPercentual
      row.getCell(8).numFmt = "0.00%"
      // I (Comissão) = G * H — fórmula garante recalculo em alteração manual
      row.getCell(9).value = { formula: `G${rowIdx}*H${rowIdx}` }
      row.getCell(9).numFmt = '"R$" #,##0.00'

      // Bordas em todas as células da linha + fonte padrão
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > 9) return
        cell.font = { name: "Calibri", size: 11 }
        cell.border = {
          top: { style: "thin", color: { argb: "FFD0D0D0" } },
          left: { style: "thin", color: { argb: "FFD0D0D0" } },
          right: { style: "thin", color: { argb: "FFD0D0D0" } },
          bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
        }
      })

      rowIdx++
    }

    // Linha de totais — SUM das colunas Valor / RAV / Comissão
    if (linhas.length > 0) {
      const totalRow = ws.getRow(rowIdx)
      totalRow.getCell(5).value = "TOTAL"
      totalRow.getCell(6).value = { formula: `SUM(F2:F${rowIdx - 1})` }
      totalRow.getCell(6).numFmt = '"R$" #,##0.00'
      totalRow.getCell(7).value = { formula: `SUM(G2:G${rowIdx - 1})` }
      totalRow.getCell(7).numFmt = '"R$" #,##0.00'
      totalRow.getCell(9).value = { formula: `SUM(I2:I${rowIdx - 1})` }
      totalRow.getCell(9).numFmt = '"R$" #,##0.00'
      totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > 9 || col < 5) return
        cell.font = { name: "Calibri", size: 11, bold: true }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAEAEA" },
        }
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
        }
      })
    }
  }

  const buffer = await wb.xlsx.writeBuffer()

  // Nome do arquivo: "Vendas Magic Trips YYYY-MM-DD.xlsx"
  const hoje = new Date()
  const dataStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`
  const filename = `Vendas Magic Trips ${dataStr}.xlsx`

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
