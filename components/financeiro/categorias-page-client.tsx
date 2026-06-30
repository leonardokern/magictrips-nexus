"use client"

import { useState, useTransition } from "react"
import {
  TrendingUp, TrendingDown,
  Pencil, Check, X, Power, Plus, Search,
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  criarCategoria,
  editarCategoria,
  toggleCategoriaAtiva,
  type CategoriaFinanceira,
} from "@/app/(dashboard)/financeiro/actions"

// ─── tipos ────────────────────────────────────────────────────────────────────

type Tipo = "receber" | "pagar"

type EditState = { id: string; nome: string; tipo: Tipo } | null

type NewForm = { nome: string; tipo: Tipo } | null

// ─── item individual ─────────────────────────────────────────────────────────

function CategoriaItem({
  c,
  editState,
  isPending,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  onToggle,
  onEditChange,
}: {
  c: CategoriaFinanceira
  editState: EditState
  isPending: boolean
  onEdit: (c: CategoriaFinanceira) => void
  onCancelEdit: () => void
  onSubmitEdit: () => void
  onToggle: (c: CategoriaFinanceira) => void
  onEditChange: (s: EditState) => void
}) {
  const editing = editState?.id === c.id

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${
        !c.ativo
          ? "border-white/[0.03] opacity-40"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.035]"
      }`}
    >
      {editing ? (
        <>
          <Input
            value={editState.nome}
            onChange={(e) => onEditChange({ ...editState, nome: e.target.value })}
            className="h-8 flex-1 text-sm"
            disabled={isPending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitEdit()
              if (e.key === "Escape") onCancelEdit()
            }}
          />
          <button
            onClick={onSubmitEdit}
            disabled={isPending || !editState.nome.trim()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCancelEdit}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className={`flex-1 truncate text-sm ${c.ativo ? "text-white" : "text-white/50"}`}>
            {c.nome}
          </span>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => onEdit(c)}
              title="Editar"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onToggle(c)}
              disabled={isPending}
              title={c.ativo ? "Inativar" : "Ativar"}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-40 ${
                c.ativo
                  ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15"
                  : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/15"
              }`}
            >
              <Power className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── coluna com seção ────────────────────────────────────────────────────────

function Coluna({
  tipo,
  categorias,
  editState,
  isPending,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  onToggle,
  onEditChange,
  onAddClick,
}: {
  tipo: Tipo
  categorias: CategoriaFinanceira[]
  editState: EditState
  isPending: boolean
  onEdit: (c: CategoriaFinanceira) => void
  onCancelEdit: () => void
  onSubmitEdit: () => void
  onToggle: (c: CategoriaFinanceira) => void
  onEditChange: (s: EditState) => void
  onAddClick: (tipo: Tipo) => void
}) {
  const CONFIG = {
    receber: {
      label: "Receitas",
      icon: <TrendingUp className="h-4 w-4" />,
      ring: "ring-emerald-500/20",
      header: "bg-emerald-500/[0.06] border-emerald-500/15",
      headerText: "text-emerald-300",
      countBg: "bg-emerald-500/10 text-emerald-400",
    },
    pagar: {
      label: "Despesas",
      icon: <TrendingDown className="h-4 w-4" />,
      ring: "ring-rose-500/20",
      header: "bg-rose-500/[0.06] border-rose-500/15",
      headerText: "text-rose-300",
      countBg: "bg-rose-500/10 text-rose-400",
    },
  }
  const cfg = CONFIG[tipo]
  const ativas = categorias.filter((c) => c.ativo)
  const inativas = categorias.filter((c) => !c.ativo)

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] ring-1 ${cfg.ring}`}>
      {/* Header da coluna */}
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${cfg.header}`}>
        <span className={cfg.headerText}>{cfg.icon}</span>
        <span className={`text-sm font-semibold ${cfg.headerText}`}>{cfg.label}</span>
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${cfg.countBg}`}>
          {ativas.length}
        </span>
        <button
          onClick={() => onAddClick(tipo)}
          title={`Nova ${cfg.label}`}
          className={`ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-1.5 p-3">
        {ativas.map((c) => (
          <CategoriaItem
            key={c.id}
            c={c}
            editState={editState}
            isPending={isPending}
            onEdit={onEdit}
            onCancelEdit={onCancelEdit}
            onSubmitEdit={onSubmitEdit}
            onToggle={onToggle}
            onEditChange={onEditChange}
          />
        ))}

        {ativas.length === 0 && (
          <p className="py-4 text-center text-sm text-white/30">Nenhuma categoria ativa.</p>
        )}

        {/* Inativas */}
        {inativas.length > 0 && (
          <div className="mt-1 space-y-1.5 border-t border-white/[0.04] pt-2">
            <p className="px-1 text-[10px] uppercase tracking-wider text-white/25">
              Inativas ({inativas.length})
            </p>
            {inativas.map((c) => (
              <CategoriaItem
                key={c.id}
                c={c}
                editState={editState}
                isPending={isPending}
                onEdit={onEdit}
                onCancelEdit={onCancelEdit}
                onSubmitEdit={onSubmitEdit}
                onToggle={onToggle}
                onEditChange={onEditChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── página principal ────────────────────────────────────────────────────────

export function CategoriasPageClient({
  initialCategorias,
}: {
  initialCategorias: CategoriaFinanceira[]
}) {
  const [categorias, setCategorias] = useState(initialCategorias)
  const [editState, setEditState] = useState<EditState>(null)
  const [newForm, setNewForm] = useState<NewForm>(null)
  const [isPending, startTransition] = useTransition()
  const [busca, setBusca] = useState("")

  function reload() {
    // re-fetch via server action
    import("@/app/(dashboard)/financeiro/actions")
      .then((m) => m.listarTodasCategorias())
      .then(setCategorias)
  }

  function startEdit(c: CategoriaFinanceira) {
    setEditState({ id: c.id, nome: c.nome, tipo: c.tipo })
    setNewForm(null)
  }

  function cancelEdit() { setEditState(null) }

  function submitEdit() {
    if (!editState) return
    startTransition(async () => {
      const r = await editarCategoria(editState.id, { nome: editState.nome, tipo: editState.tipo })
      if (!r.ok) { toast.error(r.error); return }
      toast.success("Categoria atualizada.")
      setEditState(null)
      reload()
    })
  }

  function handleToggle(c: CategoriaFinanceira) {
    startTransition(async () => {
      const r = await toggleCategoriaAtiva(c.id, !c.ativo)
      if (!r.ok) { toast.error(r.error); return }
      toast.success(c.ativo ? "Inativada." : "Ativada.")
      reload()
    })
  }

  function openNewForm(tipo: Tipo) {
    setNewForm({ nome: "", tipo })
    setEditState(null)
  }

  function submitNova() {
    if (!newForm?.nome.trim()) return
    startTransition(async () => {
      const r = await criarCategoria({ nome: newForm.nome, tipo: newForm.tipo })
      if (!r.ok) { toast.error(r.error); return }
      toast.success("Categoria criada.")
      setNewForm(null)
      reload()
    })
  }

  const filtrado = busca.trim()
    ? categorias.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()))
    : categorias

  const receitas = filtrado.filter((c) => c.tipo === "receber")
  const despesas = filtrado.filter((c) => c.tipo === "pagar")

  const colunaProps = {
    editState,
    isPending,
    onEdit: startEdit,
    onCancelEdit: cancelEdit,
    onSubmitEdit: submitEdit,
    onToggle: handleToggle,
    onEditChange: setEditState,
    onAddClick: openNewForm,
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar categoria…"
            className="pl-9"
          />
        </div>
        <button
          onClick={() => openNewForm("pagar")}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-nexus-bright/25 bg-nexus-bright/[0.08] px-4 py-2 text-sm font-medium text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
        >
          <Plus className="h-4 w-4" />
          Nova Categoria
        </button>
      </div>

      {/* Formulário de nova categoria */}
      {newForm && (
        <div className="rounded-2xl border border-nexus-bright/15 bg-nexus-bright/[0.04] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Nova Categoria</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/50">Nome *</Label>
              <Input
                value={newForm.nome}
                onChange={(e) => setNewForm({ ...newForm, nome: e.target.value })}
                placeholder="ex: Aluguel"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && newForm.nome.trim()) submitNova() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/50">Tipo *</Label>
              <Select
                value={newForm.tipo}
                onValueChange={(v) => setNewForm({ ...newForm, tipo: v as Tipo })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receber">Receita — aparece em Contas a Receber</SelectItem>
                  <SelectItem value="pagar">Despesa — aparece em Contas a Pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewForm(null)} disabled={isPending}>
              Cancelar
            </Button>
            <LoaderButton
              loading={isPending}
              size="sm"
              onClick={submitNova}
              disabled={!newForm.nome.trim()}
            >
              Criar
            </LoaderButton>
          </div>
        </div>
      )}

      {/* Colunas */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Coluna tipo="receber" categorias={receitas} {...colunaProps} />
        <Coluna tipo="pagar" categorias={despesas} {...colunaProps} />
      </div>

      {filtrado.length === 0 && busca && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-sm text-white/40">Nenhuma categoria encontrada para "{busca}".</p>
        </div>
      )}
    </div>
  )
}
