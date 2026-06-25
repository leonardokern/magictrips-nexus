import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import path from "node:path"
import { getVendaParaPDF } from "@/app/(dashboard)/vendas/actions"
import { ComprovantePDF } from "@/components/pdf/comprovante-pdf"
import type { ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const result = await getVendaParaPDF(params.id)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Não encontrado." },
      { status: result.error === "Sem permissão." ? 403 : 404 },
    )
  }

  if (!result.data) {
    return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 })
  }

  const rawLogoPath = result.data.empresaLogoPath
  const logoPath = rawLogoPath
    ? path.join(process.cwd(), "public", rawLogoPath)
    : null

  const element = React.createElement(ComprovantePDF, {
    venda: result.data,
    logoPath,
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const nomeCliente = result.data.clienteNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30)

  const prefix =
    result.data.tipoVenda === "alteracao_valores"
      ? "comprovante-alteracao"
      : "comprovante"

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${prefix}-${nomeCliente}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
