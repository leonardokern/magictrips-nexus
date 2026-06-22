"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { createPortal } from "react-dom"
import { Check, ChevronsUpDown, Receipt, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { formatBRL } from "@/lib/utils/sum-parser"
import {
  listarVendasParaAlteracao,
  type VendaParaAlteracao,
} from "@/app/(dashboard)/vendas/actions-alteracao"

type Props = {
  value: string | null
  onChange: (venda: VendaParaAlteracao | null) => void
  disabled?: boolean
}

/**
 * Combobox de busca server-side de vendas elegíveis pra alteração.
 *
 * Renderização do painel via portal pro `document.body` — necessário pra
 * escapar de qualquer `overflow:hidden` em ancestrais (ex: DialogContent).
 * Posição é recalculada via getBoundingClientRect no scroll/resize.
 */
export function VendaPickerCombobox({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState<VendaParaAlteracao[]>([])
  const [selecionada, setSelecionada] = useState<VendaParaAlteracao | null>(
    null,
  )
  const [isPending, startTransition] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  // Recalcula posição do painel relativo ao trigger
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const recalc = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      })
    }
    recalc()
    window.addEventListener("scroll", recalc, true)
    window.addEventListener("resize", recalc)
    return () => {
      window.removeEventListener("scroll", recalc, true)
      window.removeEventListener("resize", recalc)
    }
  }, [open])

  // Fecha ao clicar fora (trigger OU painel ficam no DOM em locais diferentes)
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  // Carrega lista inicial + debounce de busca
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await listarVendasParaAlteracao(query)
        if (r.ok && r.data) setResultados(r.data)
      })
    }, query ? 250 : 0)
    return () => clearTimeout(t)
  }, [query, open])

  function pick(venda: VendaParaAlteracao) {
    setSelecionada(venda)
    onChange(venda)
    setOpen(false)
    setQuery("")
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm",
          "transition-colors hover:bg-white/[0.06]",
          disabled && "cursor-not-allowed opacity-60",
          !selecionada && !value && "text-white/40",
        )}
      >
        {selecionada ? (
          <span className="flex flex-1 items-center gap-3 truncate text-white">
            <span className="font-mono text-xs font-semibold text-nexus-bright">
              {selecionada.identificador}
            </span>
            <span className="truncate">{selecionada.cliente_nome}</span>
            <span className="shrink-0 text-xs text-white/55">
              {formatBRL(selecionada.valor_total)}
            </span>
          </span>
        ) : (
          <span>Selecione a venda original</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-white/40" />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            // `data-venda-picker-panel` permite que o DialogContent
            // (alteracao-valores-modal.tsx) reconheça cliques dentro do
            // painel e cancele o `onPointerDownOutside` do Radix —
            // necessário porque o painel está num portal em document.body,
            // fora da árvore do Dialog. Sem essa marcação, qualquer clique
            // no painel fecharia o modal antes do item ser selecionado.
            data-venda-picker-panel=""
            className="fixed z-[60] max-h-80 overflow-hidden rounded-xl border border-white/[0.08] bg-card/95 shadow-2xl backdrop-blur-xl"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="border-b border-white/[0.06] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por identificador ou cliente"
                  className="h-8 border-white/10 bg-white/[0.04] pl-8 text-sm"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-1">
              {isPending && resultados.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner className="text-white/40" />
                </div>
              ) : resultados.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-white/45">
                  Nenhuma venda aprovada encontrada.
                </p>
              ) : (
                resultados.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => pick(v)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      value === v.id
                        ? "bg-white/[0.06] text-white"
                        : "text-white/85 hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-nexus-bright/30 bg-nexus-bright/10">
                      <Receipt className="h-3.5 w-3.5 text-nexus-bright" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-medium">
                        <span className="font-mono text-xs text-nexus-bright">
                          {v.identificador}
                        </span>
                        <span className="truncate">{v.cliente_nome}</span>
                      </p>
                      <p className="truncate text-[11px] text-white/45">
                        {v.empresa_nome} · {formatDateBr(v.data_venda)} ·{" "}
                        {formatBRL(v.valor_total)}
                      </p>
                    </div>
                    {value === v.id && (
                      <Check className="h-4 w-4 text-nexus-bright" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function formatDateBr(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return d && m && y ? `${d}/${m}/${y}` : iso
}
