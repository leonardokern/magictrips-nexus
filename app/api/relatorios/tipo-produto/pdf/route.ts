import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import path from "node:path"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { buildRelatorioTipoProduto } from "@/lib/relatorios/tipo-produto"
import { RelatorioTipoProdutoPDF } from "@/components/pdf/relatorio-tipo-produto-pdf"
import type { ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// GET pra abrir o PDF inline numa nova aba (filtros via query string). Esse é
// o padrão do app pra visualizar PDFs (ver rota do relatório de venda) — o
// operador visualiza e baixa pelo próprio visualizador do navegador.
export async function GET(req: NextRequest) {
  const user = await requireCurrentUser()
  if (!can(user, "relatorios", "ver")) {
    return new NextResponse("Sem permissão para gerar relatórios.", { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const tipoProdutoId = sp.get("tipoProdutoId") ?? ""
  const dataInicio = sp.get("dataInicio") ?? ""
  const dataFim = sp.get("dataFim") ?? ""

  if (!tipoProdutoId) {
    return new NextResponse("Selecione um tipo de produto.", { status: 400 })
  }
  if (!ISO_RE.test(dataInicio) || !ISO_RE.test(dataFim)) {
    return new NextResponse("Informe um intervalo de datas válido.", { status: 400 })
  }
  if (dataInicio > dataFim) {
    return new NextResponse("Data inicial maior que a final.", { status: 400 })
  }

  const supabase = await createClient()
  const res = await buildRelatorioTipoProduto(supabase, { tipoProdutoId, dataInicio, dataFim })
  if (!res.ok) {
    return new NextResponse(res.error, { status: 400 })
  }

  const logoPath = path.join(
    process.cwd(),
    "public",
    "brand",
    "nexus-logo-nome-transparent.png",
  )

  const geradoEm = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const element = React.createElement(RelatorioTipoProdutoPDF, {
    dados: res.data,
    logoPath,
    geradoEm,
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const slug = res.data.tipoProdutoNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30)
  const filename = `relatorio-${slug || "tipo-produto"}-${dataInicio}_${dataFim}.pdf`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
