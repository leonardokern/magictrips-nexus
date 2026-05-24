"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MapPin, StickyNote, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type ClienteFormValues } from "@/lib/schemas/cliente"
import {
  createCliente,
  updateCliente,
  lookupClientePorCpf,
  lookupClientePorCnpj,
  type ActionResult,
} from "@/app/(dashboard)/clientes/actions"
import {
  formatCep,
  formatCnpj,
  formatCpf,
  formatTelefone,
  onlyDigits,
} from "@/lib/utils/formatters"
import { cnpjValido, cpfValido, emailValido } from "@/lib/utils/validators"
import { DateInput } from "@/components/ui/date-input"
import { buscarEnderecoPorCep } from "@/lib/utils/cep"
import { ESTADOS_BR } from "@/lib/data/estados"
import { CidadeCombobox } from "@/components/ui/cidade-combobox"
import { Spinner } from "@/components/ui/spinner"

type Empresa = { id: string; nome: string }

type ModeProps =
  | { mode: "create" }
  | {
      mode: "edit"
      id: string
      initial: Partial<ClienteFormValues>
    }

type Props = ModeProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresas: Empresa[]
  /** Pré-seleciona empresa (usado quando usuário tem 1 empresa). */
  defaultEmpresaId?: string
  /** Bloqueia o select de empresa (não-Admin). */
  lockEmpresa?: boolean
  /** Modo leitura: desabilita todos os campos e esconde o botão Salvar. */
  readOnly?: boolean
}

type FormState = ClienteFormValues

const EMPTY: FormState = {
  empresa_id: "",
  tipo_pessoa: "fisica",
  // PF
  nome: "",
  cpf: "",
  data_nascimento: "",
  // PJ
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  responsavel: "",
  // Comuns
  email: "",
  telefone: "",
  endereco: {},
  origem: "",
  tipo: "regular",
  dia_faturamento: undefined,
  status: "ativo",
  observacoes: "",
}

export function ClienteFormModal(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateAlert, setDuplicateAlert] = useState<{
    id: string
    nome: string
  } | null>(null)
  const [v, setV] = useState<FormState>(EMPTY)
  const [cepLoading, setCepLoading] = useState(false)
  /** Quando true, rua/bairro/cidade/UF ficam editáveis manualmente.
   *  Default: false (bloqueados). Liberado se ViaCEP não acha. */
  const [enderecoManual, setEnderecoManual] = useState(false)

  const isCreate = props.mode === "create"

  async function buscarCep() {
    const cep = v.endereco?.cep ?? ""
    const limpo = onlyDigits(cep)
    if (limpo.length === 0) {
      setErrors((e) => ({ ...e, cep: "" }))
      return
    }
    if (limpo.length !== 8) {
      setErrors((e) => ({ ...e, cep: "CEP inválido" }))
      return
    }
    setErrors((e) => ({ ...e, cep: "" }))
    setCepLoading(true)
    const r = await buscarEnderecoPorCep(cep)
    setCepLoading(false)
    if (!r) {
      toast.error("CEP não encontrado — preencha os campos manualmente.")
      setEnderecoManual(true)
      return
    }
    setEnderecoManual(false)
    update("endereco", {
      ...v.endereco,
      cep,
      rua: r.rua || v.endereco?.rua,
      bairro: r.bairro || v.endereco?.bairro,
      cidade: r.cidade,
      estado: r.uf,
    })
  }

  useEffect(() => {
    if (!props.open) return
    setErrors({})
    setDuplicateAlert(null)
    // Edit: endereço já existe, libera edição. Create: bloqueia, força CEP.
    setEnderecoManual(props.mode === "edit")
    if (props.mode === "edit") {
      setV({
        ...EMPTY,
        empresa_id: props.defaultEmpresaId ?? "",
        ...props.initial,
      })
    } else {
      setV({ ...EMPTY, empresa_id: props.defaultEmpresaId ?? "" })
    }
  }, [props.open, props.mode, props.defaultEmpresaId])

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }))
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  async function checkCpfDuplicado() {
    if (!isCreate || v.tipo_pessoa !== "fisica") return
    const cpfLimpo = onlyDigits(v.cpf ?? "")
    if (cpfLimpo.length === 0) {
      setDuplicateAlert(null)
      setErrors((e) => ({ ...e, cpf: "" }))
      return
    }
    if (cpfLimpo.length !== 11 || !cpfValido(cpfLimpo)) {
      setDuplicateAlert(null)
      setErrors((e) => ({ ...e, cpf: "CPF inválido." }))
      return
    }
    setErrors((e) => ({ ...e, cpf: "" }))
    if (!v.empresa_id) return
    const found = await lookupClientePorCpf(v.empresa_id, cpfLimpo)
    setDuplicateAlert(found)
  }

  async function checkCnpjDuplicado() {
    if (v.tipo_pessoa !== "juridica") return
    const cnpjLimpo = onlyDigits(v.cnpj ?? "")
    if (cnpjLimpo.length === 0) {
      setDuplicateAlert(null)
      setErrors((e) => ({ ...e, cnpj: "" }))
      return
    }
    if (!cnpjValido(cnpjLimpo)) {
      setDuplicateAlert(null)
      setErrors((e) => ({ ...e, cnpj: "CNPJ inválido." }))
      return
    }
    setErrors((e) => ({ ...e, cnpj: "" }))
    if (!isCreate || !v.empresa_id) return
    const found = await lookupClientePorCnpj(v.empresa_id, cnpjLimpo)
    setDuplicateAlert(found)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    startTransition(async () => {
      const payload = {
        ...v,
        cpf: onlyDigits(v.cpf ?? ""),
        cnpj: onlyDigits(v.cnpj ?? ""),
        telefone: onlyDigits(v.telefone),
        dia_faturamento:
          v.tipo === "faturado" && v.dia_faturamento
            ? Number(v.dia_faturamento)
            : undefined,
      }

      const result: ActionResult<{ id: string }> = isCreate
        ? await createCliente(payload)
        : await updateCliente(props.id, payload).then((r) =>
            r.ok ? { ok: true } : r,
          )

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        toast.error(result.error)
        return
      }

      toast.success(
        isCreate ? "Cliente criado." : "Cliente atualizado.",
      )
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-nexus-bright" />
            {isCreate ? "Novo cliente" : "Editar cliente"}
          </DialogTitle>
          <DialogDescription>
            Cadastro do cliente — usado nas vendas e ciclos de faturamento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          <fieldset disabled={props.readOnly} className="space-y-6 disabled:opacity-95">
          {/* Dados principais */}
          <Section icon={<User className="h-3.5 w-3.5" />} title="Dados principais">
            <div className="grid gap-4 sm:grid-cols-2">
              {!props.lockEmpresa && (
                <Field label="Empresa *" error={errors.empresa_id}>
                  <Select
                    value={v.empresa_id || undefined}
                    onValueChange={(val) => update("empresa_id", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {/* Radio Pessoa Física / Jurídica */}
              <div className="sm:col-span-2">
                <Label className="mb-2 block text-[11px] font-medium text-white/70">
                  Tipo de pessoa *
                </Label>
                <div className="flex gap-2">
                  {(["fisica", "juridica"] as const).map((opt) => {
                    const ativo = v.tipo_pessoa === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => update("tipo_pessoa", opt)}
                        className={
                          "flex-1 rounded-md border px-4 py-2 text-sm transition-colors " +
                          (ativo
                            ? "border-nexus-bright bg-nexus-bright/10 text-nexus-bright"
                            : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/25 hover:bg-white/[0.06]")
                        }
                      >
                        {opt === "fisica" ? "Pessoa física" : "Pessoa jurídica"}
                      </button>
                    )
                  })}
                </div>
              </div>

              {v.tipo_pessoa === "fisica" ? (
                <>
                  <Field
                    label="Nome *"
                    error={errors.nome}
                    className="sm:col-span-2"
                  >
                    <Input
                      value={v.nome ?? ""}
                      onChange={(e) => update("nome", e.target.value)}
                      required
                    />
                  </Field>

                  <Field label="CPF *" error={errors.cpf}>
                    <Input
                      value={formatCpf(v.cpf ?? "")}
                      onChange={(e) => update("cpf", e.target.value)}
                      onBlur={checkCpfDuplicado}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required
                    />
                    {duplicateAlert && isCreate && (
                      <p className="mt-1 text-[11px] text-amber-300">
                        Já existe cliente com este CPF:{" "}
                        <a
                          href={`/clientes/${duplicateAlert.id}`}
                          className="font-medium underline"
                        >
                          {duplicateAlert.nome}
                        </a>
                      </p>
                    )}
                  </Field>

                  <Field label="Data de nascimento" error={errors.data_nascimento}>
                    <DateInput
                      value={v.data_nascimento ?? ""}
                      onChange={(iso) => update("data_nascimento", iso)}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label="Razão social *"
                    error={errors.razao_social}
                    className="sm:col-span-2"
                  >
                    <Input
                      value={v.razao_social ?? ""}
                      onChange={(e) => update("razao_social", e.target.value)}
                      required
                    />
                  </Field>

                  <Field
                    label="Nome fantasia"
                    error={errors.nome_fantasia}
                    className="sm:col-span-2"
                  >
                    <Input
                      value={v.nome_fantasia ?? ""}
                      onChange={(e) => update("nome_fantasia", e.target.value)}
                    />
                  </Field>

                  <Field label="CNPJ *" error={errors.cnpj}>
                    <Input
                      value={formatCnpj(v.cnpj ?? "")}
                      onChange={(e) => {
                        update("cnpj", e.target.value)
                        setDuplicateAlert(null)
                      }}
                      onBlur={checkCnpjDuplicado}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      required
                    />
                    {duplicateAlert && isCreate && (
                      <p className="mt-1 text-[11px] text-amber-300">
                        Já existe cliente com este CNPJ:{" "}
                        <a
                          href={`/clientes/${duplicateAlert.id}`}
                          className="font-medium underline"
                        >
                          {duplicateAlert.nome}
                        </a>
                      </p>
                    )}
                  </Field>

                  <Field label="Nome do responsável" error={errors.responsavel}>
                    <Input
                      value={v.responsavel ?? ""}
                      onChange={(e) => update("responsavel", e.target.value)}
                    />
                  </Field>
                </>
              )}

              <Field label="E-mail *" error={errors.email}>
                <Input
                  type="email"
                  value={v.email}
                  onChange={(e) => update("email", e.target.value.replace(/\s/g, ""))}
                  onBlur={() => {
                    if (v.email && !emailValido(v.email)) {
                      setErrors((e) => ({ ...e, email: "E-mail inválido" }))
                    }
                  }}
                  placeholder="cliente@email.com.br"
                  required
                />
              </Field>

              <Field label="Telefone *" error={errors.telefone}>
                <Input
                  value={formatTelefone(v.telefone)}
                  onChange={(e) => update("telefone", e.target.value)}
                  placeholder="(11) 91234-5678"
                  maxLength={15}
                  required
                />
              </Field>
            </div>
          </Section>

          {/* Endereço */}
          <Section icon={<MapPin className="h-3.5 w-3.5" />} title="Endereço">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="CEP"
                hint="Preenche o resto automaticamente"
                error={errors.cep}
              >
                <div className="relative">
                  <Input
                    value={formatCep(v.endereco?.cep ?? "")}
                    onChange={(e) =>
                      update("endereco", {
                        ...v.endereco,
                        cep: onlyDigits(e.target.value),
                      })
                    }
                    onBlur={buscarCep}
                    placeholder="00000-000"
                    maxLength={9}
                    inputMode="numeric"
                    className="pr-9"
                  />
                  {cepLoading && (
                    <Spinner
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-nexus-bright"
                    />
                  )}
                </div>
              </Field>
              <Field label="UF">
                <Select
                  value={v.endereco?.estado || undefined}
                  disabled={!enderecoManual}
                  onValueChange={(val) =>
                    update("endereco", {
                      ...v.endereco,
                      estado: val,
                      // Limpa cidade quando UF muda
                      cidade: v.endereco?.estado === val ? v.endereco?.cidade : "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((e) => (
                      <SelectItem key={e.uf} value={e.uf}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cidade">
                <CidadeCombobox
                  uf={v.endereco?.estado}
                  value={v.endereco?.cidade ?? ""}
                  onChange={(cidade) =>
                    update("endereco", { ...v.endereco, cidade })
                  }
                  disabled={!enderecoManual}
                />
              </Field>
              <Field label="Rua" className="sm:col-span-2">
                <Input
                  value={v.endereco?.rua ?? ""}
                  disabled={!enderecoManual}
                  onChange={(e) =>
                    update("endereco", { ...v.endereco, rua: e.target.value })
                  }
                />
              </Field>
              <Field label="Número">
                <Input
                  value={v.endereco?.numero ?? ""}
                  onChange={(e) =>
                    update("endereco", {
                      ...v.endereco,
                      numero: onlyDigits(e.target.value),
                    })
                  }
                  inputMode="numeric"
                  maxLength={10}
                />
              </Field>
              <Field label="Complemento" className="sm:col-span-2">
                <Input
                  value={v.endereco?.complemento ?? ""}
                  onChange={(e) =>
                    update("endereco", {
                      ...v.endereco,
                      complemento: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Bairro">
                <Input
                  value={v.endereco?.bairro ?? ""}
                  disabled={!enderecoManual}
                  onChange={(e) =>
                    update("endereco", {
                      ...v.endereco,
                      bairro: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            {!enderecoManual && (
              <p className="mt-2 text-[11px] text-white/40">
                Rua, Bairro, Cidade e UF são preenchidos via CEP.{" "}
                <button
                  type="button"
                  onClick={() => setEnderecoManual(true)}
                  className="underline hover:text-white/70"
                >
                  Editar manualmente
                </button>
              </p>
            )}
          </Section>

          {/* Observações */}
          <Section icon={<StickyNote className="h-3.5 w-3.5" />} title="Observações">
            <Textarea
              value={v.observacoes ?? ""}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={3}
              placeholder="Anotações internas, preferências, restrições..."
            />
          </Section>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => props.onOpenChange(false)}
              disabled={isPending}
            >
              {props.readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!props.readOnly && (
              <Button
                type="submit"
                disabled={isPending}
                className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
              >
                {isPending ? "Salvando…" : isCreate ? "Criar cliente" : "Salvar"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-[11px] font-medium text-white/70">
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-white/40">{hint}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
