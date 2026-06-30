"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Paperclip, X, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DateInput } from "@/components/ui/date-input"
import { LoaderButton } from "@/components/ui/loader-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  editarLancamentoReceber,
  editarLancamentoPagar,
  listarAnexosLancamento,
  uploadAnexoLancamento,
  excluirAnexoLancamento,
  type CategoriaFinanceira,
  type AnexoLancamento,
} from "@/app/(dashboard)/financeiro/actions"
import type { CaixaItem } from "@/app/(dashboard)/cartoes/actions"
import type { CartaoSimples } from "@/components/financeiro/nova-saida-modal"

function parseBRL(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0
}

function formatValorStr(v: string): string {
  const digits = v.replace(/\D/g, "")
  if (!digits) return ""
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function numToStr(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type CentroValue = `caixa:${string}` | `cartao:${string}` | "" | "none"

function parseCentro(v: CentroValue): { cartaoId?: string; caixaId?: string } {
  if (!v || v === "none") return {}
  const [tipo, id] = v.split(":") as [string, string]
  if (tipo === "cartao") return { cartaoId: id }
  if (tipo === "caixa") return { caixaId: id }
  return {}
}

function buildCentroValue(cartaoId?: string | null, caixaId?: string | null): CentroValue {
  if (cartaoId) return `cartao:${cartaoId}`
  if (caixaId) return `caixa:${caixaId}`
  return "none"
}

export type LancamentoData = {
  id: string
  descricao: string | null
  categoria_id: string | null
  valor: number
  forma_pagamento: string | null
  data_emissao: string | null
  data_vencimento: string
  cartao_id: string | null
  caixa_id: string | null
  observacoes: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  mode: "view" | "edit"
  tipo: "receber" | "pagar"
  lancamento: LancamentoData
  categorias: CategoriaFinanceira[]
  caixas: CaixaItem[]
  cartoes: CartaoSimples[]
}

export function LancamentoDetalheModal({ open, onClose, mode, tipo, lancamento, categorias, caixas, cartoes }: Props) {
  const readOnly = mode === "view"
  const hoje = new Date().toISOString().slice(0, 10)

  const [categoriaId, setCategoriaId] = useState(lancamento.categoria_id ?? "")
  const [descricao, setDescricao] = useState(lancamento.descricao ?? "")
  const [valorStr, setValorStr] = useState(numToStr(lancamento.valor))
  const [forma, setForma] = useState<"faturado" | "pix">((lancamento.forma_pagamento as "faturado" | "pix") ?? "pix")
  const [dataEmissao, setDataEmissao] = useState(lancamento.data_emissao ?? hoje)
  const [dataVencimento, setDataVencimento] = useState(lancamento.data_vencimento)
  const [centro, setCentro] = useState<CentroValue>(
    buildCentroValue(lancamento.cartao_id, lancamento.caixa_id)
  )
  const [observacoes, setObservacoes] = useState(lancamento.observacoes ?? "")
  const [isPending, startTransition] = useTransition()
  const [anexos, setAnexos] = useState<AnexoLancamento[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Carrega anexos ao abrir
  useEffect(() => {
    if (!open) return
    listarAnexosLancamento(tipo, lancamento.id).then(setAnexos)
  }, [open, tipo, lancamento.id])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    const r = await uploadAnexoLancamento(tipo, lancamento.id, fd)
    setUploading(false)
    if (!r.ok) { toast.error(r.error); return }
    setAnexos((prev) => [...prev, r.data!])
    toast.success("Arquivo anexado.")
  }

  async function handleRemoveAnexo(id: string) {
    const r = await excluirAnexoLancamento(id)
    if (!r.ok) { toast.error(r.error); return }
    setAnexos((prev) => prev.filter((a) => a.id !== id))
  }

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    setValorStr(formatValorStr(e.target.value))
  }

  function salvar() {
    if (!categoriaId) { toast.error("Selecione uma categoria."); return }
    if (!descricao.trim()) { toast.error("Descrição obrigatória."); return }
    const valor = parseBRL(valorStr)
    if (!valor || valor <= 0) { toast.error("Valor deve ser maior que zero."); return }
    if (!dataVencimento) { toast.error("Data de vencimento obrigatória."); return }

    const { cartaoId, caixaId } = parseCentro(centro)

    const editarAction = tipo === "pagar" ? editarLancamentoPagar : editarLancamentoReceber
    startTransition(async () => {
      const r = await editarAction(lancamento.id, {
        descricao,
        categoria_id: categoriaId,
        valor,
        forma_pagamento: forma,
        data_emissao: dataEmissao,
        data_vencimento: dataVencimento,
        cartao_id: cartaoId,
        caixa_id: caixaId,
        observacoes: observacoes || undefined,
      })
      if (!r.ok) { toast.error(r.error); return }
      toast.success("Lançamento atualizado.")
      onClose()
    })
  }

  const cartoesAtivos = cartoes.filter((c) => c.ativo)
  const caixasAtivas = caixas.filter((c) => c.ativo)
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo || (c.tipo as string) === "ambos")

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {readOnly ? "Detalhes do Lançamento" : "Editar Lançamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Categoria *</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId} disabled={readOnly || isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar categoria…" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDoTipo.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={readOnly || isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Valor *</Label>
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <span className="shrink-0 text-white/40">R$</span>
                <input
                  className="w-full bg-transparent text-right tabular-nums text-white focus:outline-none disabled:opacity-50"
                  value={valorStr}
                  onChange={handleValor}
                  placeholder="0,00"
                  inputMode="numeric"
                  disabled={readOnly || isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Forma</Label>
              <Select value={forma} onValueChange={(v) => setForma(v as "faturado" | "pix")} disabled={readOnly || isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="faturado">Faturado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Data de Emissão</Label>
              <DateInput value={dataEmissao} onChange={setDataEmissao} disabled={readOnly || isPending} openOnFocus={false} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Vencimento *</Label>
              <DateInput value={dataVencimento} onChange={setDataVencimento} disabled={readOnly || isPending} openOnFocus={false} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Centro de Custo</Label>
            <Select value={centro} onValueChange={(v) => setCentro(v as CentroValue)} disabled={readOnly || isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Não informado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                {cartoesAtivos.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">Cartões</div>
                    {cartoesAtivos.map((c) => (
                      <SelectItem key={c.id} value={`cartao:${c.id}`}>
                        {c.nome}{c.banco ? ` · ${c.banco}` : ""}
                      </SelectItem>
                    ))}
                  </>
                )}
                {caixasAtivas.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">Caixas</div>
                    {caixasAtivas.map((c) => (
                      <SelectItem key={c.id} value={`caixa:${c.id}`}>{c.nome}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais…"
              rows={2}
              disabled={readOnly || isPending}
            />
          </div>

          {/* Comprovantes */}
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-white/55">
                Comprovantes
                {anexos.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-nexus-bright/20 px-1.5 py-0.5 text-[10px] text-nexus-bright">
                    {anexos.length}
                  </span>
                )}
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || isPending || anexos.length >= 2}
                  title={anexos.length >= 2 ? "Limite de 2 anexos atingido" : undefined}
                  className="flex items-center gap-1.5 rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] px-2.5 py-1 text-xs text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15 disabled:opacity-40"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                  Anexar arquivo
                </button>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileChange} />
            </div>
            {anexos.length === 0 ? (
              <p className="text-[11px] text-white/30">Nenhum arquivo anexado.</p>
            ) : (
              <div className="space-y-1.5">
                {anexos.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                    <span className="flex-1 truncate text-xs text-white/70">{a.nome_arquivo}</span>
                    {!readOnly && (
                      <button type="button" onClick={() => handleRemoveAnexo(a.id)} className="text-white/30 transition-colors hover:text-rose-300">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {readOnly ? (
            <DialogClose asChild>
              <Button>Fechar</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={isPending}>Cancelar</Button>
              </DialogClose>
              <LoaderButton loading={isPending} onClick={salvar}>
                Salvar alterações
              </LoaderButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
