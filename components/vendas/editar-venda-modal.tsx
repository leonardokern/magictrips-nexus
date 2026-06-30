"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModalLoader } from "@/components/ui/modal-loader"
import { VendaWizard, STEPS, type StepsStatus, type WizardDraftData } from "./venda-wizard"
import { getVendaParaEditar, type DadosNovaVenda } from "@/app/(dashboard)/vendas/actions"

type Props = {
  vendaId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** true = Gerente/Admin (Validar Venda). false = Agente dono (Enviar para validação). */
  modoGerente?: boolean
}

export function EditarVendaModal({ vendaId, open, onOpenChange, modoGerente = true }: Props) {
  const [dados, setDados] = useState<DadosNovaVenda | null>(null)
  const [draft, setDraft] = useState<WizardDraftData | null>(null)
  const [vendaStatus, setVendaStatus] = useState<string | null>(null)
  const [motivoRevisao, setMotivoRevisao] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [maxWizardStep, setMaxWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(6)
  // Validade dos 5 primeiros steps — recebido do wizard via callback.
  // Em modoGerente, define quais tabs aparecem ✓ válido (verde) ou ⚠ inválido (âmbar).
  // Step 5 (Anexos) é opcional, então sempre nasce válido.
  const [stepsStatus, setStepsStatus] = useState<StepsStatus>({
    1: "valid", 2: "valid", 3: "valid", 4: "valid", 5: "valid",
  })

  useEffect(() => {
    if (!open) {
      setDados(null)
      setDraft(null)
      setVendaStatus(null)
      setMotivoRevisao(null)
      setWizardStep(1)
      setMaxWizardStep(6)
      return
    }
    setLoading(true)
    getVendaParaEditar(vendaId).then((r) => {
      setLoading(false)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao carregar venda.")
        onOpenChange(false)
        return
      }
      setDados(r.data!.dados)
      setDraft(r.data!.draft as unknown as WizardDraftData)
      setVendaStatus(r.data!.status ?? null)
      setMotivoRevisao(r.data!.motivoRevisao ?? null)
    })
  }, [open, vendaId, onOpenChange])

  const pronto = !loading && dados && draft

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4 pr-14">
          <DialogTitle>Editar venda</DialogTitle>
          <DialogDescription>
            {modoGerente
              ? <>Revise e edite qualquer campo. Ao concluir, clique em <strong className="text-white">Validar Venda</strong> para aprovar.</>
              : <>Corrija os pontos indicados. Ao concluir, clique em <strong className="text-white">Enviar para validação</strong>.</>}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        {pronto && (
          <div className="shrink-0 border-b border-white/[0.06] px-6 py-3">
            <ol className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              {STEPS.map((s) => {
                const Icon = s.icon
                const ativo = wizardStep === s.num
                const passado = wizardStep > s.num
                // Em modoGerente, todos os steps 1-5 são navegáveis pelo header
                const clicavel = modoGerente ? (s.num <= 5 && !ativo) : passado

                // Em modoGerente, considera o step "concluído" por padrão (a venda
                // já foi cadastrada). Marca inválido apenas se faltar campo obrigatório.
                const valido =
                  modoGerente && s.num <= 5
                    ? stepsStatus[s.num as 1 | 2 | 3 | 4 | 5] === "valid"
                    : false
                const invalido =
                  modoGerente && s.num <= 5
                    ? stepsStatus[s.num as 1 | 2 | 3 | 4 | 5] === "invalid"
                    : false

                const base =
                  "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs uppercase tracking-wider transition-colors"
                const color = ativo
                  ? "bg-nexus-bright/15 text-nexus-bright"
                  : invalido
                    ? "text-amber-300 hover:bg-amber-400/10 hover:text-amber-200 cursor-pointer"
                    : valido
                      ? "text-emerald-300/80 hover:bg-emerald-400/10 hover:text-emerald-300 cursor-pointer"
                      : passado
                        ? "text-emerald-300/80 hover:bg-emerald-400/10 hover:text-emerald-300 cursor-pointer"
                        : clicavel
                          ? "text-white/50 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                          : "text-white/25 cursor-default"

                // Ícone: prioriza warning > check > ícone do step
                const showWarning = invalido && !ativo
                const showCheck = (valido || passado) && !ativo && !invalido

                const inner = (
                  <>
                    {showWarning ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    ) : showCheck ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate">
                      {s.num}. {s.label}
                    </span>
                  </>
                )
                return clicavel ? (
                  <li key={s.num} className={`${base} ${color}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2"
                      onClick={() => setWizardStep(s.num as 1 | 2 | 3 | 4 | 5 | 6)}
                      title={`Ir para ${s.label}`}
                    >
                      {inner}
                    </button>
                  </li>
                ) : (
                  <li
                    key={s.num}
                    className={`${base} ${color}`}
                    aria-current={ativo ? "step" : undefined}
                  >
                    {inner}
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!pronto ? (
            <ModalLoader label="Carregando venda…" />
          ) : (
            <>
              {/* Banner do motivo de revisão — aparece SEMPRE que o gerente
                  devolveu (mesmo se o agente já clicou em editar pelo lápis
                  fora do fluxo de devolução). Some quando status sai de
                  em_revisao (após reenvio). */}
              {vendaStatus === "em_revisao" && motivoRevisao && (
                <div className="mb-5 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-amber-200">
                        Venda devolvida pelo gerente para revisão
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-amber-100/85">
                        {motivoRevisao}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <VendaWizard
              key={vendaId}
              {...dados}
              clientes={dados.clientes.map((c) => ({
                ...c,
                cpf: c.cpf ?? "",
                email: c.email ?? "",
              }))}
              initialDraft={draft}
              initialRascunhoId={null}
              modoGerente={modoGerente}
              vendaId={vendaId}
              onSuccessClose={() => onOpenChange(false)}
              step={wizardStep}
              onStepChange={setWizardStep}
              maxStep={maxWizardStep}
              onMaxStepChange={setMaxWizardStep}
              onStepsStatusChange={setStepsStatus}
            />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
