"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Boxes, FileSpreadsheet, FileText } from "lucide-react"
import { Label } from "@/components/ui/label"
import { LoaderButton } from "@/components/ui/loader-button"
import { DateInput } from "@/components/ui/date-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatBRL } from "@/lib/utils/sum-parser"
import { formatDateBr } from "@/lib/utils/formatters"
import { previewTipoProduto } from "@/app/(dashboard)/relatorios/actions"
import type { RelatorioTipoProdutoDados } from "@/lib/relatorios/tipo-produto"
import { ReportShell } from "./report-shell"
import { ReportKpis, ReportIdle, ReportEmpty, ReportLoading } from "./report-ui"
import { useRelatorioExport } from "./use-relatorio-export"

export type TipoProdutoOpcao = { id: string; nome: string }

function primeiroDiaDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function RelatorioTipoProdutoView({ tipos }: { tipos: TipoProdutoOpcao[] }) {
  const [tipoProdutoId, setTipoProdutoId] = useState("")
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes)
  const [dataFim, setDataFim] = useState(hojeIso)

  const [dados, setDados] = useState<RelatorioTipoProdutoDados | null>(null)
  const [carregando, setCarregando] = useState(false)
  const reqId = useRef(0)

  const { baixandoExcel, exportarExcel, abrirPdf } = useRelatorioExport()

  const erro = useMemo(() => {
    if (!tipoProdutoId) return "Selecione um tipo de produto para visualizar o relatório."
    if (!dataInicio || !dataFim) return "Informe o intervalo de datas."
    if (dataInicio > dataFim) return "A data inicial não pode ser maior que a final."
    return null
  }, [tipoProdutoId, dataInicio, dataFim])

  const filtrosValidos = erro === null

  // Carrega a prévia automaticamente quando os filtros ficam válidos.
  useEffect(() => {
    if (!filtrosValidos) {
      setDados(null)
      setCarregando(false)
      return
    }
    const id = ++reqId.current
    setCarregando(true)
    const t = setTimeout(async () => {
      const r = await previewTipoProduto({ tipoProdutoId, dataInicio, dataFim })
      if (id !== reqId.current) return // resposta obsoleta
      setDados(r.ok ? r.data : null)
      setCarregando(false)
    }, 300)
    return () => clearTimeout(t)
  }, [filtrosValidos, tipoProdutoId, dataInicio, dataFim])

  const corpoBody = { tipoProdutoId, dataInicio, dataFim }

  return (
    <ReportShell
      icon={Boxes}
      titulo="Vendas por tipo de produto"
      descricao="Vendas aprovadas de um tipo de produto num intervalo, com valores, custo, RAVs e campos customizados."
      filtros={
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/55">Tipo de produto</Label>
            <Select value={tipoProdutoId} onValueChange={setTipoProdutoId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione um tipo…" />
              </SelectTrigger>
              <SelectContent>
                {tipos.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-white/45">Nenhum tipo cadastrado</div>
                ) : (
                  tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/55">Data inicial</Label>
            <DateInput value={dataInicio} onChange={setDataInicio} max={dataFim || undefined} className="w-[150px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/55">Data final</Label>
            <DateInput value={dataFim} onChange={setDataFim} min={dataInicio || undefined} className="w-[150px]" />
          </div>
        </>
      }
      acoes={
        <>
          <LoaderButton
            type="button"
            variant="outline"
            disabled={!filtrosValidos}
            onClick={() => abrirPdf("/api/relatorios/tipo-produto/pdf", corpoBody)}
          >
            <FileText className="h-4 w-4" />
            PDF
          </LoaderButton>
          <LoaderButton
            type="button"
            loading={baixandoExcel}
            disabled={!filtrosValidos}
            onClick={() => exportarExcel("/api/relatorios/tipo-produto/excel", corpoBody, "relatorio.xlsx")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Gerar Excel
          </LoaderButton>
        </>
      }
    >
      {!filtrosValidos ? (
        <ReportIdle texto={erro ?? ""} />
      ) : !dados ? (
        <ReportLoading />
      ) : dados.linhas.length > 0 ? (
        <PreviewTipoProduto dados={dados} esmaecido={carregando} />
      ) : (
        <ReportEmpty texto="Nenhuma venda aprovada nesse período para o tipo selecionado." />
      )}
    </ReportShell>
  )
}

function PreviewTipoProduto({
  dados,
  esmaecido,
}: {
  dados: RelatorioTipoProdutoDados
  esmaecido: boolean
}) {
  const { campos, linhas, totais } = dados
  const margem = totais.margemPercentual != null ? `${totais.margemPercentual.toFixed(1)}%` : "—"

  function infoCampos(valores: Record<string, string>): string {
    return campos
      .map((c) => (valores[c.id] ? `${c.nome}: ${valores[c.id]}` : null))
      .filter(Boolean)
      .join("  ·  ")
  }

  return (
    <div className={`space-y-4 transition-opacity ${esmaecido ? "opacity-50" : ""}`}>
      <ReportKpis
        items={[
          { label: "Total vendido", value: formatBRL(totais.valorVenda), tone: "deep" },
          { label: "Custo total", value: formatBRL(totais.valorCusto) },
          { label: "RAV total", value: formatBRL(totais.ravTotal), tone: "green" },
          { label: "Margem (RAV/venda)", value: margem, tone: "blue" },
          { label: "Comissões", value: formatBRL(totais.comissao), tone: "amber" },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Data</TableHead>
              <TableHead className="text-white/55">ID</TableHead>
              <TableHead className="text-white/55">Cliente</TableHead>
              <TableHead className="text-white/55">Fornecedor</TableHead>
              <TableHead className="min-w-[240px] text-white/55">Informações</TableHead>
              <TableHead className="text-right text-white/55">Valor</TableHead>
              <TableHead className="text-right text-white/55">Custo</TableHead>
              <TableHead className="text-right text-white/55">RAV</TableHead>
              <TableHead className="text-right text-white/55">Comissão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={`${l.vendaId}-${i}`} className="border-white/[0.06] hover:bg-white/[0.025]">
                <TableCell className="whitespace-nowrap text-white/70">{formatDateBr(l.dataVenda)}</TableCell>
                <TableCell className="whitespace-nowrap text-white/55">{l.identificador || "—"}</TableCell>
                <TableCell className="font-medium text-white">{l.cliente || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-white/70">{l.fornecedor || "—"}</TableCell>
                <TableCell className="text-xs text-white/55">{infoCampos(l.valoresCampos) || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-white">{formatBRL(l.valorVenda)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-white/60">{formatBRL(l.valorCusto)}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-emerald-300">{formatBRL(l.ravTotal)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-amber-300">{formatBRL(l.comissao)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.03]">
              <TableCell colSpan={5} className="font-semibold text-white">
                Total · {totais.qtdVendas} venda(s) · {totais.qtdProdutos} produto(s)
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-white">{formatBRL(totais.valorVenda)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-white/70">{formatBRL(totais.valorCusto)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-emerald-300">{formatBRL(totais.ravTotal)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-amber-300">{formatBRL(totais.comissao)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
