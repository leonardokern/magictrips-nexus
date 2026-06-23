import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import path from "node:path"
import { getFaturaParaPDF } from "@/app/(dashboard)/financeiro/actions"
import { FaturaAgrupadaPDF } from "@/components/pdf/fatura-agrupada-pdf"
import type { ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const result = await getFaturaParaPDF(params.id)
  if (!result) {
    return NextResponse.json(
      { error: "Fatura não encontrada ou sem permissão." },
      { status: 404 },
    )
  }

  const logoPath = result.logoPath
    ? path.join(process.cwd(), "public", result.logoPath)
    : null

  const element = React.createElement(FaturaAgrupadaPDF, {
    data: result.data,
    logoPath,
  }) as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  const numFatura = result.data.faturaNumero.replace(/^#/, "")
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
