"use client"

import Image from "next/image"
import { Building2, CalendarRange, Package, Wallet } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TipoPacoteBadge, PacoteAtivoBadge } from "@/components/pacotes/pacote-badges"
import { formatBRL } from "@/components/ui/currency-input"
import type { CampoDinamico } from "@/components/shared/campo-dinamico-input"
import type { PacoteRow } from "@/components/pacotes/pacote-row-actions"
import type { TipoProdutoOpcao, FornecedorOpcao } from "@/components/pacotes/pacote-form-modal"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pacote: PacoteRow
  tiposProduto: TipoProdutoOpcao[]
  fornecedores: FornecedorOpcao[]
  camposExtra: CampoDinamico[]
}

function formatDateBR(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function PacoteViewModal({ open, onOpenChange, pacote: p, tiposProduto, fornecedores, camposExtra }: Props) {
  function tipoProdutoDe(id: string) {
    return tiposProduto.find((t) => t.id === id)
  }
  function fornecedorDe(id: string) {
    return fornecedores.find((f) => f.id === id)
  }
  function atributos(valoresExtras: Record<string, string>) {
    return Object.entries(valoresExtras)
      .map(([campoId, valor]) => ({ campo: camposExtra.find((c) => c.id === campoId), valor }))
      .filter((a): a is { campo: CampoDinamico; valor: string } => !!a.campo && !!a.valor)
  }

  const itensOrdenados = p.itens.slice().sort((a, b) => a.ordem - b.ordem)
  const operadoraUnica = p.fornecedor_id ? fornecedorDe(p.fornecedor_id) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-nexus-bright" />
            Pacote
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Cabeçalho: nome + badges */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-lg font-semibold text-white">{p.nome}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <TipoPacoteBadge tipo={p.tipo_pacote} />
              <PacoteAtivoBadge ativo={p.ativo} />
            </div>
            {p.descricao && (
              <p className="mt-3 text-sm leading-relaxed text-white/60">{p.descricao}</p>
            )}
          </div>

          {/* Vigência */}
          <Row icon={<CalendarRange className="h-3.5 w-3.5" />} label="Vigência da viagem">
            <p className="text-sm text-white">
              {formatDateBR(p.data_inicio_viagem)} até {formatDateBR(p.data_fim_viagem)}
            </p>
          </Row>

          {/* Única operadora: operadora + custo total */}
          {p.tipo_pacote === "unica_operadora" && (
            <div className="grid grid-cols-2 gap-3">
              <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Operadora">
                <p className="text-sm text-white">{operadoraUnica?.nome ?? "—"}</p>
              </Row>
              <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Custo total">
                <p className="text-sm font-medium text-emerald-300">
                  {p.valor_custo_total != null ? formatBRL(p.valor_custo_total) : "—"}
                </p>
              </Row>
            </div>
          )}

          {/* Produtos inclusos */}
          <Row label={p.tipo_pacote === "unica_operadora" ? "Produtos inclusos" : "Itens do pacote"}>
            <div className="space-y-2">
              {itensOrdenados.length === 0 && (
                <p className="text-sm text-white/40">Nenhum produto cadastrado.</p>
              )}
              {itensOrdenados.map((it, idx) => {
                const tp = tipoProdutoDe(it.tipo_produto_id)
                const atrs = atributos(it.valores_extras)
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3"
                  >
                    <div className="flex items-center gap-2">
                      {tp?.icone && (
                        <span className="relative block h-4 w-4 shrink-0">
                          <Image
                            src={`/icons/tipos-produto/${tp.icone}.png`}
                            alt=""
                            fill
                            className="object-contain"
                            style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }}
                          />
                        </span>
                      )}
                      <p className="text-sm font-medium text-white">{tp?.nome ?? "Produto"}</p>
                    </div>

                    {/* Multi operadora: fornecedores + custo do item */}
                    {p.tipo_pacote === "multi_operadora" && it.fornecedores.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {it.fornecedores
                          .slice()
                          .sort((a, b) => a.ordem - b.ordem)
                          .map((f, fi) => (
                            <span
                              key={fi}
                              className="inline-flex items-center gap-1.5 rounded-md border border-nexus-bright/20 bg-nexus-bright/[0.07] px-2 py-1 text-xs text-nexus-bright"
                            >
                              {fornecedorDe(f.fornecedor_id)?.nome ?? "—"}
                              <span className="text-nexus-bright/60">·</span>
                              {formatBRL(f.valor_custo)}
                            </span>
                          ))}
                      </div>
                    )}

                    {/* Atributos pré-preenchidos */}
                    {atrs.length > 0 && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/[0.06] pt-2">
                        {atrs.map(({ campo, valor }) => (
                          <div key={campo.id} className="flex items-baseline justify-between gap-2 text-xs">
                            <dt className="text-white/40">{campo.nome}</dt>
                            <dd className="truncate text-right text-white/80">{valor}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )
              })}
            </div>
          </Row>
        </div>

        <DialogFooter className="shrink-0 border-t border-white/[0.06] bg-card/95 px-6 py-4 backdrop-blur">
          <DialogClose asChild>
            <Button variant="ghost">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}
