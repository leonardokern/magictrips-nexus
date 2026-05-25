"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, Clock, FilePlus2, FolderOpen, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ModalLoader } from "@/components/ui/modal-loader"
import { Spinner } from "@/components/ui/spinner"
import { VendaWizard, STEPS, type WizardDraftData } from "./venda-wizard"
import {
  getDadosNovaVenda,
  type DadosNovaVenda,
} from "@/app/(dashboard)/vendas/actions"
import {
  listarRascunhos,
  carregarRascunho,
  descartarRascunho,
  type RascunhoItem,
} from "@/app/(dashboard)/vendas/rascunho-actions"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos da máquina de estados do modal
// ─────────────────────────────────────────────────────────────────────────────

type ModalView =
  | { kind: "loading" }
  | { kind: "selecionar-rascunho"; rascunhos: RascunhoItem[] }
  | { kind: "carregando-rascunho"; id: string }
  | {
      kind: "wizard"
      rascunhoId: string | null
      initialDraft: WizardDraftData | null
    }

// ─────────────────────────────────────────────────────────────────────────────
// Helper: tempo relativo
// ─────────────────────────────────────────────────────────────────────────────

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "agora mesmo"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d} dia${d > 1 ? "s" : ""}`
}

const STEP_LABEL = ["", "Identificação", "Produtos", "Cobrança", "Passageiros", "Revisão"]

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NovaVendaModal({ open, onOpenChange }: Props) {
  const [dados, setDados] = useState<DadosNovaVenda | null>(null)
  const [view, setView] = useState<ModalView>({ kind: "loading" })
  const [descartando, setDescartando] = useState<string | null>(null)
  const [isDescartando, startDescartando] = useTransition()
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [maxWizardStep, setMaxWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Carrega dados do wizard + rascunhos do usuário em paralelo
  useEffect(() => {
    if (!open) {
      // Reset ao fechar — wizard remontado na próxima abertura
      setDados(null)
      setView({ kind: "loading" })
      setDescartando(null)
      setWizardStep(1)
      setMaxWizardStep(1)
      return
    }

    let cancel = false
    setView({ kind: "loading" })

    Promise.all([getDadosNovaVenda(), listarRascunhos()])
      .then(([dadosRes, rascunhosRes]) => {
        if (cancel) return

        if (!dadosRes.ok) {
          toast.error(dadosRes.error)
          onOpenChange(false)
          return
        }

        setDados(dadosRes.data ?? null)

        const rascunhos = rascunhosRes.ok ? (rascunhosRes.data ?? []) : []

        if (rascunhos.length > 0) {
          setView({ kind: "selecionar-rascunho", rascunhos })
        } else {
          setView({ kind: "wizard", rascunhoId: null, initialDraft: null })
        }
      })
      .catch((err) => {
        if (cancel) return
        console.error("[NovaVendaModal] erro ao carregar dados:", err)
        toast.error(
          err instanceof Error
            ? `Erro ao carregar dados da venda: ${err.message}`
            : "Erro ao carregar dados da venda.",
        )
        onOpenChange(false)
      })

    return () => {
      cancel = true
    }
  }, [open, onOpenChange])

  // Continuar um rascunho: busca os dados completos e abre o wizard hidratado
  function handleContinuarRascunho(id: string) {
    setView({ kind: "carregando-rascunho", id })
    carregarRascunho(id).then((r) => {
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao carregar rascunho.")
        setView({ kind: "selecionar-rascunho", rascunhos: [] })
        return
      }
      const draft = r.data!.dados as unknown as WizardDraftData
      // Restaura no passo mais avançado que o usuário chegou, não onde salvou
      const restoreStep = ((draft.maxStep ?? draft.step) as 1 | 2 | 3 | 4 | 5) ?? 1
      setWizardStep(restoreStep)
      setMaxWizardStep(restoreStep)
      setView({ kind: "wizard", rascunhoId: id, initialDraft: draft })
    })
  }

  // Descartar um rascunho (com confirmação inline)
  function handleDescartarRascunho(id: string) {
    startDescartando(async () => {
      const r = await descartarRascunho(id)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao descartar rascunho.")
        setDescartando(null)
        return
      }
      setDescartando(null)
      // Atualiza lista
      setView((prev) => {
        if (prev.kind !== "selecionar-rascunho") return prev
        const updated = prev.rascunhos.filter((r) => r.id !== id)
        if (updated.length === 0) {
          return { kind: "wizard", rascunhoId: null, initialDraft: null }
        }
        return { kind: "selecionar-rascunho", rascunhos: updated }
      })
      toast.success("Rascunho descartado.")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4 pr-14">
          <DialogTitle>
            {view.kind === "selecionar-rascunho"
              ? "Rascunhos salvos"
              : "Nova venda"}
          </DialogTitle>
          <DialogDescription>
            {view.kind === "selecionar-rascunho"
              ? "Você tem rascunhos não enviados. Deseja continuar de onde parou ou iniciar uma nova venda?"
              : "Preencha os 5 passos para registrar a venda. Ela ficará pendente de validação até a aprovação do Gerente."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Stepper fixo — só aparece no wizard ──────────────────────── */}
        {view.kind === "wizard" && dados && (
          <div className="shrink-0 border-b border-white/[0.06] px-6 py-3">
            <ol className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              {STEPS.map((s) => {
                const Icon = s.icon
                const ativo = wizardStep === s.num
                const passado = wizardStep > s.num
                const base = "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs uppercase tracking-wider transition-colors"
                const color = ativo
                  ? "bg-nexus-bright/15 text-nexus-bright"
                  : passado
                    ? "text-emerald-300/80 hover:bg-emerald-400/10 hover:text-emerald-300 cursor-pointer"
                    : "text-white/35 cursor-default"
                const inner = (
                  <>
                    {passado ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Icon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{s.num}. {s.label}</span>
                  </>
                )
                return passado ? (
                  <li key={s.num} className={`${base} ${color}`}>
                    <button type="button" className="flex w-full items-center gap-2"
                      onClick={() => setWizardStep(s.num as 1 | 2 | 3 | 4 | 5)}
                      title={`Voltar para ${s.label}`}>{inner}</button>
                  </li>
                ) : (
                  <li key={s.num} className={`${base} ${color}`} aria-current={ativo ? "step" : undefined}>
                    {inner}
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Loading inicial ───────────────────────────────────────── */}
          {(view.kind === "loading" || !dados) && (
            <ModalLoader label="Carregando dados da venda…" />
          )}

          {/* ── Carregando rascunho selecionado ──────────────────────── */}
          {view.kind === "carregando-rascunho" && dados && (
            <ModalLoader label="Carregando rascunho…" />
          )}

          {/* ── Seleção de rascunhos ──────────────────────────────────── */}
          {view.kind === "selecionar-rascunho" && dados && (
            <div className="mx-auto max-w-2xl space-y-4">
              {view.rascunhos.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-nexus-bright/20 bg-nexus-bright/[0.08] text-nexus-bright">
                    <FolderOpen className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{r.titulo}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-white/45">
                      <span>
                        Passo {r.step}/5 — {STEP_LABEL[r.step]}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tempoRelativo(r.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* Descartar */}
                    {descartando === r.id ? (
                      <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-1.5 text-xs">
                        <span className="text-rose-300">Confirmar?</span>
                        <button
                          type="button"
                          onClick={() => handleDescartarRascunho(r.id)}
                          disabled={isDescartando}
                          className="font-medium text-rose-300 hover:text-rose-200"
                        >
                          {isDescartando ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : (
                            "Sim"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescartando(null)}
                          disabled={isDescartando}
                          className="text-white/40 hover:text-white/70"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDescartando(r.id)}
                        title="Descartar rascunho"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/[0.06] text-rose-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/15"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    {/* Continuar */}
                    <Button
                      type="button"
                      onClick={() => handleContinuarRascunho(r.id)}
                      className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              ))}

              {/* Começar novo */}
              <button
                type="button"
                onClick={() =>
                  setView({ kind: "wizard", rascunhoId: null, initialDraft: null })
                }
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/[0.10] p-4 text-left text-white/50 transition-colors hover:border-white/20 hover:text-white/70"
              >
                <FilePlus2 className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Começar nova venda</p>
                  <p className="text-xs">Ignora os rascunhos acima e inicia do zero</p>
                </div>
              </button>
            </div>
          )}

          {/* ── Wizard ───────────────────────────────────────────────── */}
          {view.kind === "wizard" && dados && (
            <VendaWizard
              key={view.rascunhoId ?? "new"}
              {...dados}
              clientes={dados.clientes.map((c) => ({
                ...c,
                cpf: c.cpf ?? "",
                email: c.email ?? "",
              }))}
              initialDraft={view.initialDraft}
              initialRascunhoId={view.rascunhoId}
              onSuccessClose={() => onOpenChange(false)}
              step={wizardStep}
              onStepChange={setWizardStep}
              maxStep={maxWizardStep}
              onMaxStepChange={setMaxWizardStep}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
