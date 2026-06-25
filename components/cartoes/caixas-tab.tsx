"use client"

import { useState, useTransition } from "react"
import { Power, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LoaderButton } from "@/components/ui/loader-button"
import { criarCaixa, editarCaixa, toggleCaixaAtivo, type CaixaItem } from "@/app/(dashboard)/cartoes/actions"

export function CaixasTab({ caixas: initialCaixas }: { caixas: CaixaItem[] }) {
  const [caixas, setCaixas] = useState(initialCaixas)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState("")
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditingId(null)
    setNome("")
    setModalOpen(true)
  }

  function openEdit(c: CaixaItem) {
    setEditingId(c.id)
    setNome(c.nome)
    setModalOpen(true)
  }

  function submit() {
    startTransition(async () => {
      const r = editingId
        ? await editarCaixa(editingId, nome)
        : await criarCaixa(nome)
      if (!r.ok) { toast.error(r.error ?? "Erro."); return }
      toast.success(editingId ? "Caixa atualizada." : "Caixa criada.")
      setModalOpen(false)
      // Optimistic: reload via router in real app; here we just re-fetch via RSC revalidate
      window.location.reload()
    })
  }

  function toggle(c: CaixaItem) {
    startTransition(async () => {
      const r = await toggleCaixaAtivo(c.id, !c.ativo)
      if (!r.ok) { toast.error(r.error ?? "Erro."); return }
      toast.success(c.ativo ? "Caixa inativada." : "Caixa ativada.")
      setCaixas((prev) => prev.map((x) => x.id === c.id ? { ...x, ativo: !x.ativo } : x))
    })
  }

  return (
    <>
      <div className="flex justify-end pb-3">
        <Button size="sm" onClick={openCreate} className="gap-1.5 bg-nexus-bright text-white hover:bg-nexus-bright/90">
          <Plus className="h-4 w-4" />
          Nova Caixa
        </Button>
      </div>

      {caixas.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center text-sm text-white/40">
          Nenhuma caixa cadastrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {caixas.map((c, i) => (
            <div
              key={c.id}
              className={[
                "flex items-center justify-between px-4 py-3",
                i > 0 ? "border-t border-white/[0.04]" : "",
                !c.ativo ? "opacity-50" : "",
              ].join(" ")}
            >
              <span className="text-sm font-medium text-white">{c.nome}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  title="Editar nome"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  title={c.ativo ? "Inativar" : "Ativar"}
                  className={[
                    "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                    c.ativo
                      ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15"
                      : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/15",
                  ].join(" ")}
                >
                  <Power className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(v) => !isPending && setModalOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Caixa" : "Nova Caixa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="caixa-nome" className="text-xs uppercase tracking-wider text-white/55">
              Nome
            </Label>
            <Input
              id="caixa-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: BANCO INTER"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>Cancelar</Button>
            </DialogClose>
            <LoaderButton loading={isPending} onClick={submit} className="bg-nexus-bright text-white hover:bg-nexus-bright/90">
              {editingId ? "Salvar" : "Criar"}
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
