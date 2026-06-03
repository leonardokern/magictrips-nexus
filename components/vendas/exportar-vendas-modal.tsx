"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { LoaderButton } from "@/components/ui/loader-button"
import { formatBRL } from "@/lib/utils/sum-parser"
import { cn } from "@/lib/utils"

const PAGE_SIZES = [20, 50, 100] as const
type PageSize = (typeof PAGE_SIZES)[number]

export type VendaSelecionavel = {
  id: string
  identificador: string
  dataVenda: string // ISO YYYY-MM-DD
  cliente: string
  agente: string
  valor: number
  rav: number
  comissao: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendas: VendaSelecionavel[]
}

const NOMES_MES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

function chaveMes(iso: string): string {
  return iso.slice(0, 7) // YYYY-MM
}

function mesCorrenteChave(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function mesAnteriorChave(d = new Date()): string {
  const ano = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
  const mes = d.getMonth() === 0 ? 12 : d.getMonth()
  return `${ano}-${String(mes).padStart(2, "0")}`
}

function rotuloMesAtual(): string {
  return NOMES_MES_PT[new Date().getMonth()] ?? "Mês atual"
}

function rotuloMesAnterior(): string {
  const m = new Date().getMonth()
  return NOMES_MES_PT[m === 0 ? 11 : m - 1] ?? "Mês anterior"
}

function formatDataBR(iso: string): string {
  if (!iso || iso.length !== 10) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function ExportarVendasModal({ open, onOpenChange, vendas }: Props) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [pageAtual, setPageAtual] = useState(1)

  // Reset seleção + paginação quando o modal abre
  useEffect(() => {
    if (open) {
      setSelecionados(new Set())
      setPageAtual(1)
    }
  }, [open])

  // Quando o pageSize muda, volta pra primeira página
  useEffect(() => {
    setPageAtual(1)
  }, [pageSize])

  // ── Paginação ────────────────────────────────────────────────────────────
  const totalItens = vendas.length
  const totalPaginas = Math.max(1, Math.ceil(totalItens / pageSize))
  const pageClamp = Math.min(pageAtual, totalPaginas)
  const sliceInicio = (pageClamp - 1) * pageSize
  const sliceFim = sliceInicio + pageSize
  const vendasPagina = useMemo(
    () => vendas.slice(sliceInicio, sliceFim),
    [vendas, sliceInicio, sliceFim],
  )

  const totalSelecionado = selecionados.size

  // Resumo financeiro do que está selecionado
  const totais = useMemo(() => {
    let valor = 0
    let rav = 0
    let comissao = 0
    for (const v of vendas) {
      if (!selecionados.has(v.id)) continue
      valor += v.valor
      rav += v.rav
      comissao += v.comissao
    }
    return { valor, rav, comissao }
  }, [selecionados, vendas])

  function toggle(id: string) {
    setSelecionados((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selecionarTodos() {
    setSelecionados(new Set(vendas.map((v) => v.id)))
  }

  function selecionarPagina() {
    setSelecionados((s) => {
      const next = new Set(s)
      for (const v of vendasPagina) next.add(v.id)
      return next
    })
  }

  function desmarcarPagina() {
    setSelecionados((s) => {
      const next = new Set(s)
      for (const v of vendasPagina) next.delete(v.id)
      return next
    })
  }

  function limparSelecao() {
    setSelecionados(new Set())
  }

  function selecionarMes(chaveAlvo: string) {
    const ids = vendas
      .filter((v) => chaveMes(v.dataVenda) === chaveAlvo)
      .map((v) => v.id)
    setSelecionados(new Set(ids))
  }

  async function exportar() {
    if (totalSelecionado === 0) {
      toast.error("Selecione ao menos uma venda.")
      return
    }
    startTransition(async () => {
      try {
        const r = await fetch("/api/vendas/exportar-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selecionados) }),
        })
        if (!r.ok) {
          const j = await r.json().catch(() => ({ error: "Erro ao exportar." }))
          toast.error(j.error ?? "Erro ao exportar.")
          return
        }
        const blob = await r.blob()
        // Pega filename do header
        const cd = r.headers.get("content-disposition") ?? ""
        const m = /filename="([^"]+)"/.exec(cd)
        const nome = m?.[1] ?? "Vendas Magic Trips.xlsx"
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = nome
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(
          `${totalSelecionado} ${totalSelecionado === 1 ? "venda exportada" : "vendas exportadas"}.`,
        )
        onOpenChange(false)
      } catch (e) {
        toast.error("Erro ao exportar.")
        console.error(e)
      }
    })
  }

  const todasSelecionadas = vendas.length > 0 && totalSelecionado === vendas.length
  // Estado do checkbox do header da tabela — reflete só a página atual.
  // "true" se todas as linhas visíveis estão marcadas; senão "false".
  const todasDaPaginaSelecionadas =
    vendasPagina.length > 0 && vendasPagina.every((v) => selecionados.has(v.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
            Exportar vendas para Excel
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-white/55">
            Selecione as vendas que deseja incluir na planilha. O arquivo gerado
            segue o modelo de Gestão das Vendas — uma aba por mês, com totais
            por seção.
          </DialogDescription>
        </DialogHeader>

        {/* Atalhos */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => selecionarMes(mesCorrenteChave())}
            className="h-8 border-white/10 bg-transparent text-xs text-white/80 hover:bg-white/[0.04]"
          >
            <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
            Todos de {rotuloMesAtual()}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => selecionarMes(mesAnteriorChave())}
            className="h-8 border-white/10 bg-transparent text-xs text-white/80 hover:bg-white/[0.04]"
          >
            <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
            Todos de {rotuloMesAnterior()}
          </Button>
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selecionarTodos}
            disabled={todasSelecionadas}
            className="h-8 text-xs text-white/70 hover:bg-white/[0.04] hover:text-white"
            title={`Marcar todas as ${vendas.length} vendas`}
          >
            Marcar todas ({vendas.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={limparSelecao}
            disabled={totalSelecionado === 0}
            className="h-8 text-xs text-white/70 hover:bg-white/[0.04] hover:text-white"
          >
            Limpar
          </Button>
          <span className="ml-auto text-xs text-white/55 tabular-nums">
            {totalSelecionado} de {vendas.length}{" "}
            {vendas.length === 1 ? "selecionada" : "selecionadas"}
          </span>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {vendas.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center text-sm text-white/45">
              Nenhuma venda validada disponível.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                    <th className="w-10 px-3 py-2 text-left">
                      {/* Checkbox do header atua só na página atual —
                          marcar/desmarcar todas as N linhas visíveis,
                          preservando seleções de outras páginas. */}
                      <Checkbox
                        checked={todasDaPaginaSelecionadas}
                        onCheckedChange={(v) =>
                          v === true ? selecionarPagina() : desmarcarPagina()
                        }
                        aria-label="Selecionar página atual"
                      />
                    </th>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Agente</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-right">RAV</th>
                    <th className="px-3 py-2 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasPagina.map((v) => {
                    const checked = selecionados.has(v.id)
                    return (
                      <tr
                        key={v.id}
                        onClick={() => toggle(v.id)}
                        className={cn(
                          "cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors",
                          checked
                            ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]"
                            : "hover:bg-white/[0.025]",
                        )}
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(v.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-nexus-bright">
                          {v.identificador}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-white/80">
                          {formatDataBR(v.dataVenda)}
                        </td>
                        <td className="px-3 py-2 text-white">{v.cliente}</td>
                        <td className="px-3 py-2 text-white/70">{v.agente}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-white">
                          {formatBRL(v.valor)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-white/85">
                          {formatBRL(v.rav)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-300/85">
                          {formatBRL(v.comissao)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Paginação ───────────────────────────────────────────────── */}
          {vendas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/55">
              <div className="flex items-center gap-2">
                <span>Mostrar</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v) as PageSize)}
                >
                  <SelectTrigger className="h-8 w-[72px] border-white/10 bg-white/[0.04] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>por página · total {totalItens}</span>
              </div>

              {totalPaginas > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPageAtual(Math.max(1, pageClamp - 1))}
                    disabled={pageClamp <= 1}
                    className="h-8 w-8 p-0 text-white/70 hover:bg-white/[0.04]"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums px-2">
                    Página {pageClamp} de {totalPaginas}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPageAtual(Math.min(totalPaginas, pageClamp + 1))
                    }
                    disabled={pageClamp >= totalPaginas}
                    className="h-8 w-8 p-0 text-white/70 hover:bg-white/[0.04]"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resumo + ações */}
        <DialogFooter className="shrink-0 flex-col items-stretch gap-3 border-t border-white/[0.06] bg-card/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
            <div>
              Valor total:{" "}
              <span className="tabular-nums text-white">
                {formatBRL(totais.valor)}
              </span>
            </div>
            <div>
              RAV total:{" "}
              <span className="tabular-nums text-white/85">
                {formatBRL(totais.rav)}
              </span>
            </div>
            <div>
              Comissão:{" "}
              <span className="tabular-nums text-amber-300/85">
                {formatBRL(totais.comissao)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <LoaderButton
              loading={isPending}
              onClick={exportar}
              disabled={totalSelecionado === 0}
              className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Gerar Excel
              {totalSelecionado > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
                  {totalSelecionado}
                </span>
              )}
              {totalSelecionado === 0 && <Check className="ml-2 h-4 w-4 opacity-0" />}
            </LoaderButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Botão "Exportar Excel" que abre o modal de seleção. Recebe a lista
 * completa de vendas validadas elegíveis (sem paginação) — o componente
 * mantém o estado interno.
 */
export function ExportarVendasButton({ vendas }: { vendas: VendaSelecionavel[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 border-emerald-500/30 bg-emerald-500/[0.05] text-xs text-emerald-200 hover:border-emerald-500/50 hover:bg-emerald-500/[0.1] hover:text-emerald-100"
      >
        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
        Exportar Excel
      </Button>
      <ExportarVendasModal open={open} onOpenChange={setOpen} vendas={vendas} />
    </>
  )
}
