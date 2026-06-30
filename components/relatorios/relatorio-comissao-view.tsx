"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { HandCoins, FileSpreadsheet, FileText } from "lucide-react"
import { Label } from "@/components/ui/label"
import { LoaderButton } from "@/components/ui/loader-button"
import { DateInput } from "@/components/ui/date-input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatBRL } from "@/lib/utils/sum-parser"
import { previewComissao } from "@/app/(dashboard)/relatorios/actions"
import type { RelatorioComissaoDados } from "@/lib/relatorios/comissao"
import { ReportShell } from "./report-shell"
import { ReportKpis, ReportIdle, ReportEmpty, ReportLoading } from "./report-ui"
import { useRelatorioExport } from "./use-relatorio-export"

function primeiroDiaDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function RelatorioComissaoView() {
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes)
  const [dataFim, setDataFim] = useState(hojeIso)

  const [dados, setDados] = useState<RelatorioComissaoDados | null>(null)
  const [carregando, setCarregando] = useState(false)
  const reqId = useRef(0)

  const { baixandoExcel, exportarExcel, abrirPdf } = useRelatorioExport()

  const erro = useMemo(() => {
    if (!dataInicio || !dataFim) return "Informe o intervalo de datas."
    if (dataInicio > dataFim) return "A data inicial não pode ser maior que a final."
    return null
  }, [dataInicio, dataFim])

  const filtrosValidos = erro === null

  useEffect(() => {
    if (!filtrosValidos) {
      setDados(null)
      setCarregando(false)
      return
    }
    const id = ++reqId.current
    setCarregando(true)
    const t = setTimeout(async () => {
      const r = await previewComissao({ dataInicio, dataFim })
      if (id !== reqId.current) return
      setDados(r.ok ? r.data : null)
      setCarregando(false)
    }, 300)
    return () => clearTimeout(t)
  }, [filtrosValidos, dataInicio, dataFim])

  const corpoBody = { dataInicio, dataFim }

  return (
    <ReportShell
      icon={HandCoins}
      titulo="Relatório de Comissão"
      descricao="Comissões por agente num período, considerando vendas aprovadas. Inclui agentes sem vendas (valor zero)."
      filtros={
        <>
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
            onClick={() => abrirPdf("/api/relatorios/comissao/pdf", corpoBody)}
          >
            <FileText className="h-4 w-4" />
            PDF
          </LoaderButton>
          <LoaderButton
            type="button"
            loading={baixandoExcel}
            disabled={!filtrosValidos}
            onClick={() => exportarExcel("/api/relatorios/comissao/excel", corpoBody, "comissoes.xlsx")}
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
      ) : dados.agentes.length > 0 ? (
        <PreviewComissao dados={dados} esmaecido={carregando} />
      ) : (
        <ReportEmpty texto="Nenhum agente encontrado para o período." />
      )}
    </ReportShell>
  )
}

function PreviewComissao({
  dados,
  esmaecido,
}: {
  dados: RelatorioComissaoDados
  esmaecido: boolean
}) {
  const { agentes, totais } = dados

  return (
    <div className={`space-y-4 transition-opacity ${esmaecido ? "opacity-50" : ""}`}>
      <ReportKpis
        items={[
          { label: "Vendas", value: String(totais.qtdVendas), tone: "deep" },
          { label: "Valor vendido", value: formatBRL(totais.valorVenda) },
          { label: "RAV total", value: formatBRL(totais.ravTotal), tone: "green" },
          { label: "Comissão total", value: formatBRL(totais.comissao), tone: "amber" },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Agente</TableHead>
              <TableHead className="text-white/55">Empresa</TableHead>
              <TableHead className="text-right text-white/55">Vendas</TableHead>
              <TableHead className="text-right text-white/55">Valor vendido</TableHead>
              <TableHead className="text-right text-white/55">RAV base</TableHead>
              <TableHead className="text-right text-white/55">% médio</TableHead>
              <TableHead className="text-right text-white/55">Comissão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentes.map((a) => {
              const semVendas = a.qtdVendas === 0
              return (
                <TableRow
                  key={a.usuarioId}
                  className={`border-white/[0.06] hover:bg-white/[0.025] ${semVendas ? "opacity-50" : ""}`}
                >
                  <TableCell className="font-medium text-white">{a.nomeAgente}</TableCell>
                  <TableCell className="whitespace-nowrap text-white/60">{a.empresa || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-white/70">{a.qtdVendas}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-white">{formatBRL(a.valorVenda)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-emerald-300">{formatBRL(a.ravTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums text-white/60">
                    {a.percentualMedio != null ? `${a.percentualMedio.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-amber-300">{formatBRL(a.comissao)}</TableCell>
                </TableRow>
              )
            })}
            <TableRow className="border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.03]">
              <TableCell colSpan={2} className="font-semibold text-white">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-white">{totais.qtdVendas}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-white">{formatBRL(totais.valorVenda)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-emerald-300">{formatBRL(totais.ravTotal)}</TableCell>
              <TableCell />
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-amber-300">{formatBRL(totais.comissao)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
