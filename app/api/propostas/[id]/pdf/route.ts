import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import path from "node:path"
import { getPropostaParaPDF } from "@/app/(dashboard)/propostas/actions"
import { PropostaPDF } from "@/components/pdf/proposta-pdf"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import type { ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireCurrentUser()
  if (!can(user, "propostas", "ler")) {
    return NextResponse.json(
      { error: "Sem permissão para baixar a proposta." },
      { status: 403 },
    )
  }

  const result = await getPropostaParaPDF(params.id)

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { error: result.ok ? "Proposta não encontrada." : result.error },
      { status: 404 },
    )
  }

  const rawLogoPath = result.data.empresaLogoPath
  const logoPath = rawLogoPath
    ? path.join(process.cwd(), "public", rawLogoPath)
    : null

  const element = React.createElement(PropostaPDF, {
    proposta: result.data,
    logoPath,
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const nomeCliente = result.data.clienteNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30)

  const filename = `proposta-${result.data.identificador.toLowerCase()}-${nomeCliente}.pdf`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
