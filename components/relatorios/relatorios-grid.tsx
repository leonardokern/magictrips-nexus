"use client"

import {
  RelatorioTipoProdutoModal,
  type TipoProdutoOpcao,
} from "./relatorio-tipo-produto-modal"
import { RelatorioComissaoModal } from "./relatorio-comissao-modal"

type Props = {
  tipos: TipoProdutoOpcao[]
}

export function RelatoriosGrid({ tipos }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RelatorioTipoProdutoModal tipos={tipos} />
      <RelatorioComissaoModal />
    </div>
  )
}
