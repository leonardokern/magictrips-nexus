import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import path from "node:path"
import { getParcelaParaFatura } from "@/app/(dashboard)/financeiro/actions"
import { FaturaPDF } from "@/components/pdf/fatura-pdf"
import type { ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const result = await getParcelaParaFatura(params.id)
  if (!result) {
    return NextResponse.json(
      { error: "Parcela não encontrada ou sem permissão." },
      { status: 404 },
    )
  }

  // Link_externo não tem fatura — o pagamento foi feito via plataforma.
  // O front já esconde o botão, mas confirmamos aqui.
  if (result.data.parcela.formaPagamento === "Link externo") {
    return NextResponse.json(
      { error: "Fatura indisponível para link externo." },
      { status: 400 },
    )
  }

  const logoPath = result.logoPath
    ? path.join(process.cwd(), "public", result.logoPath)
    : null

  const element = React.createElement(FaturaPDF, {
    data: result.data,
    logoPath,
  }) as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  // Nome do arquivo no formato: "<numero-fatura-sem-#> - <Nome do cliente>"
  // O nº da fatura vem como "#INV-2026-0016/1" — tiramos o "#" inicial e
  // trocamos "/" por "-" (não é caractere válido em filename). O nome do
  // cliente vai preservado, com acentos removidos e truncado pra evitar
  // nomes gigantes.
  const numFatura = result.data.faturaNumero
    .replace(/^#/, "")
    .replace(/\//g, "-")
  const nomeCliente = result.data.cliente.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, "")
    .trim()
    .slice(0, 60)

  const filename = `${numFatura} - ${nomeCliente}.pdf`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
