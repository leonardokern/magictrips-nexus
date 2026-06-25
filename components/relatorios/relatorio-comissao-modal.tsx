"use client"

import { useMemo, useState } from "react"
import { ArrowRight, FileSpreadsheet, FileText, HandCoins } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LoaderButton } from "@/components/ui/loader-button"
import { DateInput } from "@/components/ui/date-input"

type Formato = "excel" | "pdf"

function primeiroDiaDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback
  const m = /filename="?([^"]+)"?/.exec(header)
  return m?.[1] ?? fallback
}

export function RelatorioComissaoModal() {
  const [open, setOpen] = useState(false)
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes)
  const [dataFim, setDataFim] = useState(hojeIso)
  const [gerando, setGerando] = useState<Formato | null>(null)

  const erroValidacao = useMemo(() => {
    if (!dataInicio || !dataFim) return "Informe o intervalo de datas."
    if (dataInicio > dataFim) return "A data inicial não pode ser maior que a final."
    return null
  }, [dataInicio, dataFim])

  function gerarPdf() {
    if (erroValidacao) {
      toast.error(erroValidacao)
      return
    }
    const qs = new URLSearchParams({ dataInicio, dataFim }).toString()
    window.open(`/api/relatorios/comissao/pdf?${qs}`, "_blank", "noopener,noreferrer")
    toast.success("Abrindo relatório em nova aba…")
  }

  async function gerarExcel() {
    if (erroValidacao) {
      toast.error(erroValidacao)
      return
    }
    setGerando("excel")
    try {
      const res = await fetch("/api/relatorios/comissao/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataInicio, dataFim }),
      })

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(j?.error ?? "Não foi possível gerar a planilha.")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const nome = filenameFromHeader(res.headers.get("Content-Disposition"), "comissoes.xlsx")
      const a = document.createElement("a")
      a.href = url
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast.success("Planilha gerada com sucesso.")
    } catch {
      toast.error("Falha de rede ao gerar a planilha.")
    } finally {
      setGerando(null)
    }
  }

  const ocupado = gerando !== null

  return (
    <Dialog open={open} onOpenChange={(o) => !ocupado && setOpen(o)}>
      <DialogTrigger className="group flex flex-col items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-left transition-colors hover:border-nexus-bright/30 hover:bg-white/[0.04]">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors group-hover:bg-nexus-bright/15">
          <HandCoins className="h-5 w-5" />
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-semibold text-white">
            Relatório de Comissão
          </span>
          <span className="block text-xs leading-relaxed text-white/55">
            Exibe as comissões de cada agente num período, incluindo agentes sem
            vendas (valor zero). Exporta em Excel ou PDF.
          </span>
        </span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-nexus-bright">
          Gerar relatório
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de Comissão</DialogTitle>
          <DialogDescription>
            Selecione o intervalo de datas. O relatório considera vendas aprovadas
            e inclui todos os agentes ativos, mesmo sem vendas no período.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data inicial</Label>
              <DateInput
                value={dataInicio}
                onChange={setDataInicio}
                disabled={ocupado}
                max={dataFim || undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data final</Label>
              <DateInput
                value={dataFim}
                onChange={setDataFim}
                disabled={ocupado}
                min={dataInicio || undefined}
              />
            </div>
          </div>

          {erroValidacao && (
            <p className="text-xs text-amber-400/90">{erroValidacao}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <LoaderButton
            type="button"
            variant="outline"
            loading={gerando === "excel"}
            disabled={ocupado || !!erroValidacao}
            onClick={gerarExcel}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Gerar Excel
          </LoaderButton>
          <LoaderButton
            type="button"
            disabled={ocupado || !!erroValidacao}
            onClick={gerarPdf}
          >
            <FileText className="h-4 w-4" />
            Gerar PDF
          </LoaderButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
