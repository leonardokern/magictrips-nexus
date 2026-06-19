import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
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

  const geradoEm = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const element = React.createElement(RelatorioTipoProdutoPDF, {
    dados: res.data,
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
