"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Percent,
  ShieldCheck,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmpresaSelector } from "@/components/usuarios/empresa-selector"
import { PermissoesTable } from "./permissoes-table"
import { ComissoesOverrideTable } from "./comissoes-override-table"
import { permissoesTodas } from "@/lib/constants/permissoes"
import type {
  PerfilComissaoOverride,
  PerfilTipo,
  PermissoesValue,
} from "@/lib/schemas/perfil"
import {
  createPerfil,
  updatePerfil,
} from "@/app/(dashboard)/perfis/actions"
import { createClient } from "@/lib/supabase/client"

type Empresa = { id: string; nome: string; slug: string }

type ModeProps =
  | { mode: "create"; initialPermissoes?: PermissoesValue }
  | {
      mode: "edit"
      id: string
      initial: {
        nome: string
        tipo: PerfilTipo
        empresa_id: string | null
        permissoes: PermissoesValue
        /** Overrides já persistidos (origem → percentual). */
        comissoes: Record<string, number>
      }
    }

type Props = ModeProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresas: Empresa[]
  /** Passo inicial ao abrir o modal (default 1). */
  initialStep?: 1 | 2 | 3
  /** Quando true, todos os campos ficam disabled e o botão Salvar some. */
  readOnly?: boolean
  /** Flags de feature — quando false, oculta módulos ainda não liberados. */
  agendaEnabled?: boolean
  propostasEnabled?: boolean
}

type FormState = {
  nome: string
  tipo: PerfilTipo
  empresa_id: string | null
  permissoes: PermissoesValue
  /** origem → percentual customizado pelo admin. */
  comissoes: Record<string, number>
}

const EMPTY = (): FormState => ({
  nome: "",
  tipo: "operacao",
  empresa_id: null,
  permissoes: permissoesTodas(false),
  comissoes: {},
})

export function PerfilFormModal(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<FormState>(EMPTY)
  // Regras da empresa do agente (default percentual por origem)
  const [regrasEmpresa, setRegrasEmpresa] = useState<
    { origem_id: string; origem: string; defaultPercentual: number }[]
  >([])
  const [loadingRegras, setLoadingRegras] = useState(false)

  const isCreate = props.mode === "create"

  // Sincroniza initial quando o modal abre
  useEffect(() => {
    if (!props.open) return
    setStep(props.initialStep ?? 1)
    setErrors({})
    if (props.mode === "edit") {
      setV({
        nome: props.initial.nome,
        tipo: props.initial.tipo,
        empresa_id: props.initial.empresa_id,
        permissoes: props.initial.permissoes,
        comissoes: props.initial.comissoes,
      })
    } else {
      const base = EMPTY()
      if (props.mode === "create" && props.initialPermissoes) {
        base.permissoes = props.initialPermissoes
      }
      setV(base)
    }
  }, [props.open, props.mode, props.initialStep])

  // Quando agente + empresa definida, busca as regras dessa empresa pro step 3
  useEffect(() => {
    if (v.tipo !== "agente" || !v.empresa_id) {
      setRegrasEmpresa([])
      return
    }
    let cancelado = false
    setLoadingRegras(true)
    const supabase = createClient()
    supabase
      .from("comissoes_regras")
      .select("origem_id, percentual, origens_venda(nome, ordem)")
      .eq("empresa_id", v.empresa_id)
      .then(({ data }) => {
        if (cancelado) return
        const rows = (data ?? []).map((r) => ({
          origem_id: r.origem_id,
          origem: r.origens_venda?.nome ?? "—",
          ordem: r.origens_venda?.ordem ?? 0,
          defaultPercentual: Number(r.percentual),
        }))
        rows.sort(
          (a, b) =>
            a.ordem - b.ordem || a.origem.localeCompare(b.origem, "pt-BR"),
        )
        setRegrasEmpresa(
          rows.map(({ origem_id, origem, defaultPercentual }) => ({
            origem_id,
            origem,
            defaultPercentual,
          })),
        )
        setLoadingRegras(false)
      })
    return () => {
      cancelado = true
    }
  }, [v.tipo, v.empresa_id])

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => {
      const next = { ...s, [k]: val }
      // Operação e Marketing → cross-empresa, limpa overrides
      if (k === "tipo" && (val === "operacao" || val === "marketing")) {
        next.empresa_id = null
        next.comissoes = {}
      }
      // Trocou pra agente sem empresa → seleciona a primeira como default
      if (k === "tipo" && val === "agente" && !next.empresa_id) {
        next.empresa_id = props.empresas[0]?.id ?? null
      }
      // Trocou de empresa em agente → limpa overrides (são da empresa antiga)
      if (k === "empresa_id" && next.tipo === "agente") {
        next.comissoes = {}
      }
      return next
    })
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  // Comissões: helpers
  function setComissao(origem: string, percentual: number) {
    setV((s) => ({
      ...s,
      comissoes: { ...s.comissoes, [origem]: percentual },
    }))
  }
  function resetComissao(origem: string) {
    setV((s) => {
      const next = { ...s.comissoes }
      delete next[origem]
      return { ...s, comissoes: next }
    })
  }

  const ehAgente = v.tipo === "agente"
  const totalSteps = ehAgente ? 3 : 2

  function avancarStep() {
    if (step === 1) {
      const novosErros: Record<string, string> = {}
      if (v.nome.trim().length < 2) novosErros.nome = "Informe o nome do perfil."
      if (ehAgente && !v.empresa_id) {
        novosErros.empresa_id =
          "Agente precisa estar vinculado a uma empresa específica."
      }
      if (Object.keys(novosErros).length > 0) {
        setErrors(novosErros)
        return
      }
      setStep(2)
      return
    }
    if (step === 2 && ehAgente) {
      setStep(3)
    }
  }

  function voltarStep() {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    // Só persiste overrides reais (admin mudou diferente do padrão).
    const overrides: PerfilComissaoOverride[] = []
    if (ehAgente) {
      const defaultPor = new Map(
        regrasEmpresa.map((r) => [r.origem_id, r.defaultPercentual]),
      )
      for (const [origem_id, perc] of Object.entries(v.comissoes)) {
        const dflt = defaultPor.get(origem_id)
        if (dflt === undefined) continue
        if (Math.abs(perc - dflt) > 0.001) {
          overrides.push({ origem_id, percentual: perc })
        }
      }
    }

    startTransition(async () => {
      if (isCreate) {
        const r = await createPerfil({
          nome: v.nome.trim(),
          tipo: v.tipo,
          empresa_id: v.empresa_id,
          permissoes: v.permissoes,
          comissoes: ehAgente ? overrides : [],
        })
        if (!r.ok) {
          if (r.fieldErrors) setErrors(r.fieldErrors)
          toast.error(r.error)
          if (r.fieldErrors?.nome || r.fieldErrors?.empresa_id) setStep(1)
          return
        }
        toast.success("Perfil criado.")
        props.onOpenChange(false)
        router.refresh()
        return
      }

      const payload = {
        nome: v.nome.trim(),
        tipo: v.tipo,
        empresa_id: v.empresa_id,
        permissoes: v.permissoes,
        comissoes: ehAgente ? overrides : [],
      }
      const r = await updatePerfil(props.id, payload)
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success("Perfil atualizado.")
      props.onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) setErrors({})
        props.onOpenChange(o)
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-nexus-bright" />
            {props.readOnly
              ? "Detalhes do perfil"
              : isCreate
                ? "Novo perfil"
                : "Editar perfil"}
            <span className="ml-2 text-xs font-normal text-white/45">
              Passo {step} de {totalSteps}
            </span>
          </DialogTitle>
          <DialogDescription>
            {props.readOnly
              ? "Visualização das configurações deste perfil."
              : step === 1
                ? "Defina o nome, o tipo do perfil e a empresa onde atua."
                : step === 2
                  ? "Marque as permissões deste perfil em cada módulo."
                  : "Ajuste a comissão deste perfil por origem de lead."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Steps 1 e 3 são forms estreitos: constranger pra leitura.
                Step 2 (permissões) usa a largura toda do modal. */}
            {step === 1 && (
              <div className="mx-auto max-w-2xl">
                <Step1
                  nome={v.nome}
                  tipo={v.tipo}
                  empresaId={v.empresa_id}
                  empresas={props.empresas}
                  errors={errors}
                  onChangeNome={(val) => update("nome", val)}
                  onChangeTipo={(val) => update("tipo", val)}
                  onChangeEmpresa={(val) => update("empresa_id", val)}
                  readOnly={props.readOnly}
                />
              </div>
            )}
            {step === 2 && (
              <Step2
                permissoes={v.permissoes}
                onChange={(val) => update("permissoes", val)}
                disabled={isPending || props.readOnly}
                agendaEnabled={props.agendaEnabled}
                propostasEnabled={props.propostasEnabled}
              />
            )}
            {step === 3 && (
              <div className="mx-auto max-w-3xl">
                <Step3
                  regras={regrasEmpresa}
                  valores={v.comissoes}
                  loading={loadingRegras}
                  empresa={props.empresas.find((e) => e.id === v.empresa_id)}
                  onChange={setComissao}
                  onReset={resetComissao}
                  disabled={isPending || props.readOnly}
                />
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-white/[0.06] bg-card/95 px-6 py-3 backdrop-blur sm:flex-row sm:justify-between sm:space-x-0">
            <div>
              {step > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={voltarStep}
                  disabled={isPending}
                  className="text-white/70 hover:text-white"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Voltar
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => props.onOpenChange(false)}
                disabled={isPending}
              >
                {props.readOnly ? "Fechar" : "Cancelar"}
              </Button>
              {step < totalSteps ? (
                <Button
                  type="button"
                  onClick={avancarStep}
                  className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
                >
                  Continuar
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : props.readOnly ? null : (
                <LoaderButton
                  type="submit"
                  loading={isPending}
                  className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
                >
                  {isCreate ? "Criar perfil" : "Salvar"}
                </LoaderButton>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Passos
// ─────────────────────────────────────────────────────────────────────────────

function Step1({
  nome,
  tipo,
  empresaId,
  empresas,
  errors,
  onChangeNome,
  onChangeTipo,
  onChangeEmpresa,
  readOnly,
}: {
  nome: string
  tipo: PerfilTipo
  empresaId: string | null
  empresas: Empresa[]
  errors: Record<string, string>
  onChangeNome: (val: string) => void
  onChangeTipo: (val: PerfilTipo) => void
  onChangeEmpresa: (val: string | null) => void
  readOnly?: boolean
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
          <ShieldCheck className="h-3.5 w-3.5" />
          Nome do perfil
        </Label>
        <Input
          value={nome}
          onChange={(e) => onChangeNome(e.target.value)}
          placeholder="Ex: Coordenador, Operacional, Agente Sênior"
          maxLength={60}
          required
          disabled={readOnly}
        />
        {errors.nome && (
          <p className="mt-1 text-[11px] text-destructive">{errors.nome}</p>
        )}
      </div>

      {/* Tipo: Operação vs Agente */}
      <div>
        <Label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
          <Briefcase className="h-3.5 w-3.5" />
          Tipo de perfil
        </Label>
        <div className="grid gap-2 sm:grid-cols-3">
          <TipoCard
            ativo={tipo === "operacao"}
            onClick={() => !readOnly && onChangeTipo("operacao")}
            icon={<Users className="h-4 w-4" />}
            titulo="Operação"
            descricao="Cross-empresa. Usuário escolhe quais empresas acessa. Sem regra própria de comissão."
            disabled={readOnly}
          />
          <TipoCard
            ativo={tipo === "agente"}
            onClick={() => !readOnly && onChangeTipo("agente")}
            icon={<Percent className="h-4 w-4" />}
            titulo="Agente"
            descricao="Vinculado a 1 empresa. Tem matriz própria de comissão (passo 3)."
            disabled={readOnly}
          />
          <TipoCard
            ativo={tipo === "marketing"}
            onClick={() => !readOnly && onChangeTipo("marketing")}
            icon={<Megaphone className="h-4 w-4" />}
            titulo="Marketing"
            descricao="Cross-empresa. Acesso focado em marketing e análise. Comissão especial."
            disabled={readOnly}
          />
        </div>
      </div>

      {/* Empresa — em modo single-empresa, escondemos o selector e
          auto-vinculamos. Se voltar a ser multi-empresa, o selector reaparece. */}
      {empresas.length > 1 && (
        <div>
          <Label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
            <Building2 className="h-3.5 w-3.5" />
            {tipo === "agente" ? "Empresa do agente" : "Empresa onde atua"}
          </Label>
          {tipo === "operacao" ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/55">
              Perfis de Operação são automaticamente cross-empresa. A escolha de
              quais empresas o usuário acessa fica no cadastro do usuário.
            </div>
          ) : (
            <>
              <EmpresaSelector
                empresas={empresas}
                selecionadas={empresaId ? [empresaId] : []}
                onChange={(ids) => onChangeEmpresa(ids[0] ?? null)}
                singleSelect
                disabled={readOnly}
              />
              <p className="mt-2 text-[11px] text-white/40">
                Esta empresa define a tabela base de comissões usada no passo 3.
              </p>
            </>
          )}
          {errors.empresa_id && (
            <p className="mt-1 text-[11px] text-destructive">{errors.empresa_id}</p>
          )}
        </div>
      )}
    </div>
  )
}

function TipoCard({
  ativo,
  onClick,
  icon,
  titulo,
  descricao,
  disabled,
}: {
  ativo: boolean
  onClick: () => void
  icon: React.ReactNode
  titulo: string
  descricao: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ativo}
      className={
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all " +
        (ativo
          ? "border-nexus-bright/40 bg-nexus-bright/10 ring-1 ring-nexus-bright/30"
          : "border-white/10 bg-white/[0.02] hover:border-white/20") +
        (disabled ? " cursor-not-allowed opacity-60" : "")
      }
    >
      <span
        className={
          "mt-0.5 shrink-0 rounded-md p-1.5 " +
          (ativo ? "bg-nexus-bright/20 text-nexus-bright" : "bg-white/[0.05] text-white/55")
        }
      >
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{titulo}</p>
        <p className="mt-0.5 text-xs text-white/55">{descricao}</p>
      </div>
    </button>
  )
}

function Step2({
  permissoes,
  onChange,
  disabled,
  agendaEnabled,
  propostasEnabled,
}: {
  permissoes: PermissoesValue
  onChange: (next: PermissoesValue) => void
  disabled?: boolean
  agendaEnabled?: boolean
  propostasEnabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/55">
        Clique no nome do módulo pra marcar/desmarcar a linha. Células com travessão
        significam que a ação não se aplica àquele módulo.
      </p>
      <PermissoesTable
        value={permissoes}
        onChange={onChange}
        disabled={disabled}
        agendaEnabled={agendaEnabled}
        propostasEnabled={propostasEnabled}
      />
    </div>
  )
}

function Step3({
  regras,
  valores,
  loading,
  empresa,
  onChange,
  onReset,
  disabled,
}: {
  regras: { origem_id: string; origem: string; defaultPercentual: number }[]
  valores: Record<string, number>
  loading: boolean
  empresa?: Empresa
  onChange: (origemId: string, percentual: number) => void
  onReset: (origemId: string) => void
  disabled?: boolean
}) {
  if (loading) {
    return (
      <p className="text-sm text-white/55">Carregando regras da empresa…</p>
    )
  }
  if (regras.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
        Nenhuma regra de comissão cadastrada pra empresa{" "}
        {empresa?.nome ?? "selecionada"}. Cadastre as origens em{" "}
        <span className="font-medium">Comissões</span> antes de definir
        overrides.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/55">
        Valores em destaque foram customizados pra este perfil. Os demais
        seguem o padrão de <span className="font-medium">{empresa?.nome}</span>.
      </p>
      <ComissoesOverrideTable
        regras={regras}
        valores={valores}
        onChange={onChange}
        onReset={onReset}
        disabled={disabled}
      />
    </div>
  )
}
