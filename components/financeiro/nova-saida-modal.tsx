"use client"

import { useState, useTransition, useRef } from "react"
import { Minus, Paperclip, X, FileText, Loader2 } from "lucide-react"
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
  criarLancamentoPagar,
  uploadAnexoLancamento,
  excluirAnexoLancamento,
  type CategoriaFinanceira,
  type AnexoLancamento,
} from "@/app/(dashboard)/financeiro/actions"
import type { CaixaItem } from "@/app/(dashboard)/cartoes/actions"

// Tipo simples para cartões no dropdown
export type CartaoSimples = { id: string; nome: string; banco: string | null; ativo: boolean }

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

function parseBRL(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0
}

function formatValorStr(v: string): string {
  const digits = v.replace(/\D/g, "")
  if (!digits) return ""
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// "caixa:uuid" ou "cartao:uuid" — distingue o tipo no mesmo dropdown
type CentroValue = `caixa:${string}` | `cartao:${string}` | "" | "none"

function parseCentro(v: CentroValue): { cartaoId?: string; caixaId?: string } {
  if (!v) return {}
  const [tipo, id] = v.split(":") as [string, string]
  if (tipo === "cartao") return { cartaoId: id }
  if (tipo === "caixa") return { caixaId: id }
  return {}
}

type Props = {
  open: boolean
  onClose: () => void
  categorias: CategoriaFinanceira[]
  caixas: CaixaItem[]
  cartoes: CartaoSimples[]
}

export function NovaSaidaButton({
  categorias,
  caixas,
  cartoes,
}: {
  categorias: CategoriaFinanceira[]
  caixas: CaixaItem[]
  cartoes: CartaoSimples[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-sm font-medium text-rose-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/15"
      >
        <Minus className="h-4 w-4" />
        Nova Saída
      </button>
      <NovaSaidaModal
        open={open}
        onClose={() => setOpen(false)}
        categorias={categorias}
        caixas={caixas}
        cartoes={cartoes}
      />
    </>
  )
}

export function NovaSaidaModal({ open, onClose, categorias, caixas, cartoes }: Props) {
  const hoje = hojeIso()
  const [descricao, setDescricao] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [valorStr, setValorStr] = useState("")
  const [forma, setForma] = useState<"faturado" | "pix">("pix")
  const [dataEmissao, setDataEmissao] = useState(hoje)
  const [dataVencimento, setDataVencimento] = useState(hoje)
  const [centro, setCentro] = useState<CentroValue>("")
  const [observacoes, setObservacoes] = useState("")
  const [isPending, startTransition] = useTransition()
  const [criadoId, setCriadoId] = useState<string | null>(null)
  const [anexos, setAnexos] = useState<AnexoLancamento[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setDescricao("")
    setCategoriaId("")
    setValorStr("")
    setForma("pix")
    setDataEmissao(hoje)
    setDataVencimento(hoje)
    setCentro("")
    setObservacoes("")
    setCriadoId(null)
    setAnexos([])
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    setValorStr(formatValorStr(e.target.value))
  }

  function submit() {
    if (!descricao.trim()) { toast.error("Descrição obrigatória."); return }
    if (!categoriaId) { toast.error("Selecione uma categoria."); return }
    const valor = parseBRL(valorStr)
    if (!valor || valor <= 0) { toast.error("Valor deve ser maior que zero."); return }
    if (!dataVencimento) { toast.error("Data de vencimento obrigatória."); return }

    const { cartaoId, caixaId } = (centro as string) === "none" ? {} : parseCentro(centro)

    startTransition(async () => {
      const r = await criarLancamentoPagar({
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
      toast.success("Lançamento criado com sucesso.")
      setCriadoId(r.data!.id)
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !criadoId) return
    e.target.value = ""

    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    const r = await uploadAnexoLancamento("pagar", criadoId, fd)
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

  const categoriasPagar = categorias.filter((c) => c.tipo === "pagar")
  const cartoesAtivos = cartoes.filter((c) => c.ativo)
  const caixasAtivas = caixas.filter((c) => c.ativo)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="h-4 w-4 text-rose-300" />
            Nova Saída Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="ex: Despesa com escritório"
              disabled={isPending || !!criadoId}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Categoria *</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId} disabled={isPending || !!criadoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar categoria…" />
              </SelectTrigger>
              <SelectContent>
                {categoriasPagar.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor + Forma */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Valor *</Label>
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <span className="shrink-0 text-white/40">R$</span>
                <input
                  className="w-full bg-transparent text-right tabular-nums text-white focus:outline-none"
                  value={valorStr}
                  onChange={handleValor}
                  placeholder="0,00"
                  inputMode="numeric"
                  disabled={isPending || !!criadoId}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Forma de Pagamento</Label>
              <Select value={forma} onValueChange={(v) => setForma(v as "faturado" | "pix")} disabled={isPending || !!criadoId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="faturado">Faturado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Data de Emissão</Label>
              <DateInput value={dataEmissao} onChange={setDataEmissao} disabled={isPending || !!criadoId} openOnFocus={false} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">Vencimento *</Label>
              <DateInput value={dataVencimento} onChange={setDataVencimento} disabled={isPending || !!criadoId} openOnFocus={false} />
            </div>
          </div>

          {/* Centro de Custo */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Centro de Custo</Label>
            <Select
              value={centro}
              onValueChange={(v) => setCentro(v as CentroValue)}
              disabled={isPending || !!criadoId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar cartão ou caixa…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                {cartoesAtivos.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Cartões
                    </div>
                    {cartoesAtivos.map((c) => (
                      <SelectItem key={c.id} value={`cartao:${c.id}`}>
                        {c.nome}{c.banco ? ` · ${c.banco}` : ""}
                      </SelectItem>
                    ))}
                  </>
                )}
                {caixasAtivas.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Caixas
                    </div>
                    {caixasAtivas.map((c) => (
                      <SelectItem key={c.id} value={`caixa:${c.id}`}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais…"
              rows={2}
              disabled={isPending || !!criadoId}
            />
          </div>

          {/* Anexos — só disponível após criar */}
          {criadoId && (
            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-white/55">
                  Comprovantes
                </p>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] px-2.5 py-1 text-xs text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15 disabled:opacity-40"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                  Anexar arquivo
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {anexos.length === 0 ? (
                <p className="text-[11px] text-white/30">Nenhum arquivo anexado.</p>
              ) : (
                <div className="space-y-1.5">
                  {anexos.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-white/40" />
                      <span className="flex-1 truncate text-xs text-white/70">{a.nome_arquivo}</span>
                      <button
                        onClick={() => handleRemoveAnexo(a.id)}
                        className="text-white/30 transition-colors hover:text-rose-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {criadoId && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-300">
              Lançamento criado com sucesso. Adicione comprovantes acima ou feche.
            </div>
          )}
        </div>

        <DialogFooter>
          {criadoId ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={isPending}>Cancelar</Button>
              </DialogClose>
              <LoaderButton loading={isPending} onClick={submit}>
                Criar Lançamento
              </LoaderButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
