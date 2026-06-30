"use client"

import { useState, useTransition } from "react"
import { Tag, Plus, Pencil, Check, X, Power, TrendingUp, TrendingDown } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listarTodasCategorias,
  criarCategoria,
  editarCategoria,
  toggleCategoriaAtiva,
  type CategoriaFinanceira,
} from "@/app/(dashboard)/financeiro/actions"

type EditState = {
  id: string
  nome: string
  tipo: "receber" | "pagar"
} | null

type Props = { open: boolean; onClose: () => void }

function CategoriaRow({
  c, editState, isPending, onEdit, onCancelEdit, onSubmitEdit, onToggle, onEditStateChange,
}: {
  c: CategoriaFinanceira
  editState: EditState
  isPending: boolean
  onEdit: (c: CategoriaFinanceira) => void
  onCancelEdit: () => void
  onSubmitEdit: () => void
  onToggle: (c: CategoriaFinanceira) => void
  onEditStateChange: (s: EditState) => void
}) {
  const isEditing = editState?.id === c.id
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
      c.ativo ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.03] bg-transparent opacity-40"
    }`}>
      {isEditing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={editState.nome}
            onChange={(e) => onEditStateChange({ ...editState, nome: e.target.value })}
            className="h-8 flex-1 text-sm"
            disabled={isPending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitEdit()
              if (e.key === "Escape") onCancelEdit()
            }}
          />
          <Select
            value={editState.tipo}
            onValueChange={(v) => onEditStateChange({ ...editState, tipo: v as "receber" | "pagar" })}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receber">Receita</SelectItem>
              <SelectItem value="pagar">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={onSubmitEdit} disabled={isPending || !editState.nome.trim()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 transition-colors hover:bg-emerald-500/15 disabled:opacity-40">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancelEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/55 transition-colors hover:bg-white/[0.08]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 truncate text-sm text-white">{c.nome}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => onEdit(c)} title="Editar"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15">
              <Pencil className="h-3 w-3" />
            </button>
            <button onClick={() => onToggle(c)} disabled={isPending} title={c.ativo ? "Inativar" : "Ativar"}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-40 ${
                c.ativo
                  ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15"
                  : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/15"
              }`}>
              <Power className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function CategoriasModal({ open, onClose }: Props) {
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editState, setEditState] = useState<EditState>(null)
  const [novoNome, setNovoNome] = useState("")
  const [novoTipo, setNovoTipo] = useState<"receber" | "pagar">("pagar")
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showInativos, setShowInativos] = useState(false)

  function handleOpenChange(v: boolean) {
    if (!v) { onClose(); setLoaded(false); setCategorias([]); setEditState(null); setShowForm(false) }
  }

  if (open && !loaded) { setLoaded(true); listarTodasCategorias().then(setCategorias) }

  function reload() { listarTodasCategorias().then(setCategorias) }
  function startEdit(c: CategoriaFinanceira) { setEditState({ id: c.id, nome: c.nome, tipo: c.tipo }); setShowForm(false) }
  function cancelEdit() { setEditState(null) }

  function submitEdit() {
    if (!editState) return
    startTransition(async () => {
      const r = await editarCategoria(editState.id, { nome: editState.nome, tipo: editState.tipo })
      if (!r.ok) { toast.error(r.error); return }
      toast.success("Categoria atualizada."); setEditState(null); reload()
    })
  }

  function submitNova() {
    startTransition(async () => {
      const r = await criarCategoria({ nome: novoNome, tipo: novoTipo })
      if (!r.ok) { toast.error(r.error); return }
      toast.success("Categoria criada."); setNovoNome(""); setNovoTipo("pagar"); setShowForm(false); reload()
    })
  }

  function handleToggle(c: CategoriaFinanceira) {
    startTransition(async () => {
      const r = await toggleCategoriaAtiva(c.id, !c.ativo)
      if (!r.ok) { toast.error(r.error); return }
      toast.success(c.ativo ? "Inativada." : "Ativada."); reload()
    })
  }

  const visíveis = showInativos ? categorias : categorias.filter((c) => c.ativo)
  const receitas = visíveis.filter((c) => c.tipo === "receber")
  const despesas = visíveis.filter((c) => c.tipo === "pagar")
  const totalInativos = categorias.filter((c) => !c.ativo).length

  const rowProps = { editState, isPending, onEdit: startEdit, onCancelEdit: cancelEdit, onSubmitEdit: submitEdit, onToggle: handleToggle, onEditStateChange: setEditState }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-nexus-bright" />
              Categorias Financeiras
            </DialogTitle>
            {totalInativos > 0 && (
              <button onClick={() => setShowInativos((v) => !v)} className="text-[11px] text-white/40 hover:text-white/70">
                {showInativos ? "Ocultar inativas" : `+ ${totalInativos} inativa${totalInativos > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {receitas.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 pb-1 text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Receitas</span>
                <span className="ml-auto text-[10px] opacity-60">{receitas.length}</span>
              </div>
              {receitas.map((c) => <CategoriaRow key={c.id} c={c} {...rowProps} />)}
            </div>
          )}

          {despesas.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 pb-1 text-rose-400">
                <TrendingDown className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Despesas</span>
                <span className="ml-auto text-[10px] opacity-60">{despesas.length}</span>
              </div>
              {despesas.map((c) => <CategoriaRow key={c.id} c={c} {...rowProps} />)}
            </div>
          )}

          {visíveis.length === 0 && loaded && (
            <p className="py-6 text-center text-sm text-white/40">Nenhuma categoria cadastrada.</p>
          )}

          {showForm ? (
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/55">Nova Categoria</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/55">Nome</Label>
                <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="ex: Aluguel"
                  disabled={isPending} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && novoNome.trim()) submitNova() }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/55">Tipo</Label>
                <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as "receber" | "pagar")} disabled={isPending}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receber">Receita — aparece em Contas a Receber</SelectItem>
                    <SelectItem value="pagar">Despesa — aparece em Contas a Pagar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setNovoNome(""); setNovoTipo("pagar") }} disabled={isPending}>Cancelar</Button>
                <LoaderButton loading={isPending} size="sm" onClick={submitNova} disabled={!novoNome.trim()}>Criar</LoaderButton>
              </div>
            </div>
          ) : (
            <button onClick={() => { setShowForm(true); setEditState(null) }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.1] py-3 text-sm text-white/40 transition-colors hover:border-white/20 hover:text-white/60">
              <Plus className="h-4 w-4" />
              Nova Categoria
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
