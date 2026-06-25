import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import path from "node:path"
import {
  getVendaParaPDF,
  type VendaParaPDF,
} from "@/app/(dashboard)/vendas/actions"
import { RelatorioPDF } from "@/components/pdf/relatorio-pdf"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import type { ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"

/**
 * Quando a venda é uma alteração, o relatório passa a refletir o ESTADO
 * FINAL (original + delta) sem indicar que houve alteração. Mescla:
 *  - Produtos: agrupados por `tipoNome + fornecedorNome`. Os valores
 *    monetários do delta são somados ao original. Produtos que zeram
 *    (removidos) saem do PDF.
 *  - Cobranças: original.cobrança ⊕ alteração.cobrança (concat). Cada
 *    item original representa cobrança já planejada; o item da alteração
 *    representa cobrança extra pra cobrir a diferença.
 *  - Metadados: usa identificador/data/agente da ORIGINAL (a "venda"
 *    canônica), mas cliente/origem/comissão da ALTERAÇÃO — esses podem
 *    ter sido reajustados.
 */
function mergeAlteracaoNoOriginal(
  original: VendaParaPDF,
  alteracao: VendaParaPDF,
): VendaParaPDF {
  // Match key: tipoNome + fornecedorNome. Em caso de ambiguidade
  // (2 produtos do mesmo tipo+fornecedor), as somas vão no primeiro match.
  type Produto = VendaParaPDF["produtos"][number]
  const chave = (p: Produto) => `${p.tipoNome}__${p.fornecedorNome ?? ""}`
  const produtosFinais: Produto[] = original.produtos.map((p) => ({ ...p }))
  const indexPorChave = new Map<string, number>()
  produtosFinais.forEach((p, i) => {
    if (!indexPorChave.has(chave(p))) indexPorChave.set(chave(p), i)
  })

  for (const delta of alteracao.produtos) {
    const idx = indexPorChave.get(chave(delta))
    if (idx !== undefined) {
      const alvo = produtosFinais[idx]!
      alvo.valorVenda += delta.valorVenda
      alvo.valorCusto += delta.valorCusto
      alvo.rav += delta.rav
      alvo.ravExtraCliente += delta.ravExtraCliente
      alvo.ravExtraFornecedor += delta.ravExtraFornecedor
      alvo.comissao += delta.comissao
    } else {
      // Produto novo introduzido pela alteração — mantém como veio.
      produtosFinais.push({ ...delta })
      indexPorChave.set(chave(delta), produtosFinais.length - 1)
    }
  }

  // Remove produtos que zeraram (delta -original removeu).
  const produtos = produtosFinais.filter(
    (p) => Math.abs(p.valorVenda) + Math.abs(p.valorCusto) + Math.abs(p.rav) > 0.005,
  )

  return {
    ...original,
    // Cliente/origem/comissão refletem o estado mais recente (podem ter
    // mudado na alteração).
    clienteNome: alteracao.clienteNome,
    clienteCPF: alteracao.clienteCPF,
    clienteEmail: alteracao.clienteEmail,
    clienteTelefone: alteracao.clienteTelefone,
    origem: alteracao.origem,
    comissaoPercentual: alteracao.comissaoPercentual,
    // Identificador/data/agente continuam da original — pra que o
    // documento NÃO indique que houve alteração.
    tipoVenda: "original",
    vendaOriginalId: null,
    produtos,
    cobranca: [...original.cobranca, ...alteracao.cobranca],
    // Passageiros geralmente são iguais (copiados 1:1 pelo RPC), mas
    // ficamos com os da original pra ser explícito.
    passageiros: original.passageiros,
    anexos: original.anexos,
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Qualquer um que enxerga a venda pode imprimir o relatório.
  // Agentes recebem só as próprias via RLS em `getVendaParaPDF`.
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "ler")) {
    return NextResponse.json(
      { error: "Sem permissão para baixar o relatório." },
      { status: 403 },
    )
  }

  const result = await getVendaParaPDF(params.id)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Não encontrado." },
      { status: 404 },
    )
  }

  if (!result.data) {
    return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 })
  }

  // Quando é alteração, carrega a venda original e mescla — o relatório
  // sai como se fosse a venda final, sem dizer que houve alteração.
  let venda = result.data
  if (venda.tipoVenda === "alteracao_valores" && venda.vendaOriginalId) {
    const orig = await getVendaParaPDF(venda.vendaOriginalId)
    if (orig.ok && orig.data) {
      venda = mergeAlteracaoNoOriginal(orig.data, venda)
    }
  }

  const rawLogoPath = venda.empresaLogoPath
  const logoPath = rawLogoPath
    ? path.join(process.cwd(), "public", rawLogoPath)
    : null

  const element = React.createElement(RelatorioPDF, {
    venda,
    logoPath,
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const nomeCliente = venda.clienteNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30)

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-${nomeCliente}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
