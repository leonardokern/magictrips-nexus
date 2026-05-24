"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  User2,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { gerarSenhaProvisoria } from "@/lib/utils/password"
import {
  Dialog,
  DialogClose,
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
import { SenhaProvisoriaDialog } from "./senha-provisoria-dialog"
import { EmpresaSelector } from "./empresa-selector"
import {
  createUsuario,
  updateUsuario,
} from "@/app/(dashboard)/usuarios/actions"

type Perfil = { id: string; nome: string; empresa_id: string | null }
type Empresa = { id: string; nome: string; slug: string }

type ModeProps =
  | {
      mode: "create"
    }
  | {
      mode: "edit"
      id: string
      initial: {
        nome: string
        email: string
        perfil_id: string
        empresa_ids: string[]
      }
    }

type Props = ModeProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  perfis: Perfil[]
  empresas: Empresa[]
  /** Callback após sucesso (criar ou editar). */
  onSuccess?: (id: string) => void
  /** Modo leitura: campos desabilitados, sem botão salvar, senha oculta. */
  readOnly?: boolean
}

type FormState = {
  nome: string
  email: string
  perfil_id: string
  empresa_ids: string[]
  /** Só usado em mode=create. */
  senha: string
  forcar_troca_senha: boolean
}

const EMPTY: FormState = {
  nome: "",
  email: "",
  perfil_id: "",
  empresa_ids: [],
  senha: "",
  forcar_troca_senha: true,
}

export function UsuarioFormModal(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [senhaProv, setSenhaProv] = useState<{
    senha: string
    nome: string
    email: string
    emailEnviado: boolean
    emailErro?: string
  } | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [v, setV] = useState<FormState>(EMPTY)

  const isCreate = props.mode === "create"

  // Sincroniza initial quando o modal abre (em edit)
  useEffect(() => {
    if (!props.open) return
    if (props.mode === "edit") {
      setV({
        nome: props.initial.nome,
        email: props.initial.email,
        perfil_id: props.initial.perfil_id,
        empresa_ids: props.initial.empresa_ids,
        senha: "",
        forcar_troca_senha: true,
      })
    } else {
      setV(EMPTY)
    }
    setErrors({})
  }, [props.open, props.mode, isCreate])

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => {
      const next = { ...s, [k]: val }
      // Se trocou pra um perfil scoped a uma empresa, força essa empresa
      if (k === "perfil_id") {
        const perfilNovo = props.perfis.find((p) => p.id === (val as string))
        if (perfilNovo?.empresa_id) {
          next.empresa_ids = [perfilNovo.empresa_id]
        } else if (props.empresas.length === 1 && next.empresa_ids.length === 0) {
          // Single-empresa mode: auto-vincula a única empresa ativa
          next.empresa_ids = [props.empresas[0]!.id]
        }
      }
      return next
    })
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  // Perfil corrente + se é scoped a uma empresa específica
  const perfilSelecionado = props.perfis.find((p) => p.id === v.perfil_id)
  const perfilEmpresaId = perfilSelecionado?.empresa_id ?? null
  const permiteMultiEmpresa = perfilEmpresaId === null

  // Iniciais derivadas só pro preview do avatar — não são salvas
  const previewIniciais = derivarIniciaisLocal(v.nome)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    if (v.empresa_ids.length === 0) {
      setErrors({ empresa_ids: "Selecione ao menos uma empresa." })
      toast.error("Selecione ao menos uma empresa.")
      return
    }

    if (isCreate && (v.senha?.length ?? 0) < 8) {
      setErrors((e) => ({ ...e, senha: "Senha precisa ter no mínimo 8 caracteres." }))
      toast.error("Defina uma senha com no mínimo 8 caracteres.")
      return
    }

    startTransition(async () => {
      if (isCreate) {
        const r = await createUsuario({
          nome: v.nome,
          email: v.email,
          perfil_id: v.perfil_id,
          empresa_ids: v.empresa_ids,
          senha: v.senha,
          forcar_troca_senha: v.forcar_troca_senha,
        })
        if (!r.ok) {
          if (r.fieldErrors) setErrors(r.fieldErrors)
          toast.error(r.error)
          return
        }
        if (r.data) {
          setSenhaProv({
            senha: r.data.senhaDefinida,
            nome: v.nome,
            email: v.email,
            emailEnviado: r.data.emailEnviado,
            emailErro: r.data.emailErro,
          })
          props.onSuccess?.(r.data.id)
        }
        return
      }

      const payload = {
        nome: v.nome,
        email: v.email,
        perfil_id: v.perfil_id,
        empresa_ids: v.empresa_ids,
      }

      // edit
      const r = await updateUsuario(props.id, payload)
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success("Usuário atualizado.")
      props.onOpenChange(false)
      props.onSuccess?.(props.id)
      router.refresh()
    })
  }

  return (
    <>
      <Dialog
        open={props.open && !senhaProv}
        onOpenChange={(o) => {
          if (!o) setErrors({})
          props.onOpenChange(o)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <User2 className="h-4 w-4 text-nexus-bright" />
              {props.readOnly
                ? "Detalhes do usuário"
                : isCreate
                  ? "Novo usuário"
                  : "Editar usuário"}
            </DialogTitle>
            <DialogDescription>
              {props.readOnly
                ? "Visualização das configurações deste usuário."
                : isCreate
                  ? "Uma senha provisória será gerada após criar. O usuário trocará no primeiro acesso."
                  : "Atualize os dados de acesso. E-mail e senha são alterados separadamente."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Preview do avatar + nome */}
            <div className="flex items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-nexus-bright/30 bg-nexus-bright/15 text-sm font-semibold text-nexus-bright">
                {previewIniciais || "—"}
              </div>
              <div className="flex-1 space-y-1">
                <Input
                  value={v.nome}
                  onChange={(e) => update("nome", e.target.value)}
                  placeholder="Nome completo"
                  className="border-white/10 bg-white/[0.04] placeholder:text-white/30"
                  required
                  disabled={props.readOnly}
                />
                {errors.nome && (
                  <p className="text-xs text-destructive">{errors.nome}</p>
                )}
              </div>
            </div>

            {/* E-mail */}
            <Field
              label="E-mail"
              icon={<Mail className="h-3.5 w-3.5" />}
              error={errors.email}
            >
              <Input
                type="email"
                value={v.email}
                onChange={(e) => update("email", e.target.value.replace(/\s/g, ""))}
                disabled={!isCreate || props.readOnly}
                placeholder="usuario@magictrips.com.br"
                required
              />
              {!isCreate && (
                <p className="mt-1 text-[11px] text-white/40">
                  E-mail não é editável após criação.
                </p>
              )}
            </Field>

            {/* Perfil */}
            <Field
              label="Perfil"
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              error={errors.perfil_id}
            >
              <Select
                value={v.perfil_id || undefined}
                onValueChange={(val) => update("perfil_id", val)}
                disabled={props.readOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  {props.perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Empresas — multi (Admin/Gerente) ou empresa fixa (Agentes).
                Em modo single-empresa, escondemos o selector e auto-vinculamos
                no useEffect lá em cima. Se voltar a ser multi, reaparece. */}
            {props.empresas.length > 1 && (
            <Field
              label={permiteMultiEmpresa ? "Empresas com acesso" : "Empresa"}
              icon={<Building2 className="h-3.5 w-3.5" />}
              error={errors.empresa_ids}
              hint={
                !v.perfil_id
                  ? "Selecione primeiro o perfil."
                  : permiteMultiEmpresa
                    ? "Toque na logo para selecionar. Marcar todas = acesso completo."
                    : "Este perfil é específico desta empresa — vínculo automático."
              }
            >
              <EmpresaSelector
                empresas={
                  perfilEmpresaId
                    ? props.empresas.filter((e) => e.id === perfilEmpresaId)
                    : props.empresas
                }
                selecionadas={v.empresa_ids}
                onChange={(ids) => update("empresa_ids", ids)}
                disabled={isPending || !v.perfil_id || !permiteMultiEmpresa || props.readOnly}
                singleSelect={!permiteMultiEmpresa}
              />
            </Field>
            )}

            {/* Senha — só em create e nunca em readOnly */}
            {isCreate && !props.readOnly && (
              <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <Field
                  label="Senha"
                  icon={<KeyRound className="h-3.5 w-3.5" />}
                  error={errors.senha}
                  hint="Mínimo 8 caracteres. Use o botão pra gerar uma senha forte."
                >
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={mostrarSenha ? "text" : "password"}
                        value={v.senha}
                        onChange={(e) => update("senha", e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/45 hover:bg-white/[0.06] hover:text-white"
                        aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {mostrarSenha ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        update("senha", gerarSenhaProvisoria())
                        setMostrarSenha(true)
                      }}
                      className="border-white/10 bg-transparent text-white/75 hover:bg-white/[0.04] hover:text-white"
                    >
                      <Wand2 className="mr-1 h-3.5 w-3.5" />
                      Gerar
                    </Button>
                  </div>
                </Field>

                <div className="flex items-start justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Solicitar troca no primeiro acesso
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      {v.forcar_troca_senha
                        ? "O usuário será obrigado a trocar a senha quando logar pela primeira vez."
                        : "A senha definida acima será a senha final do usuário."}
                    </p>
                  </div>
                  <Switch
                    checked={v.forcar_troca_senha}
                    onCheckedChange={(c) => update("forcar_troca_senha", c)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" type="button" disabled={isPending}>
                  {props.readOnly ? "Fechar" : "Cancelar"}
                </Button>
              </DialogClose>
              {!props.readOnly && (
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
                >
                  {isPending
                    ? "Salvando..."
                    : isCreate
                      ? "Criar usuário"
                      : "Salvar"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {senhaProv && (
        <SenhaProvisoriaDialog
          open
          onClose={() => {
            setSenhaProv(null)
            props.onOpenChange(false)
            router.refresh()
          }}
          senha={senhaProv.senha}
          contexto="criar"
          nome={senhaProv.nome}
          email={senhaProv.email}
          emailEnviado={senhaProv.emailEnviado}
          emailErro={senhaProv.emailErro}
        />
      )}
    </>
  )
}

function Field({
  label,
  icon,
  error,
  hint,
  children,
}: {
  label: string
  icon?: React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
        {icon}
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

// Iniciais locais (apenas preview do avatar — não enviadas ao backend)
function derivarIniciaisLocal(nome: string): string {
  const parts = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(da|de|do|das|dos|e)$/i.test(p))
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}
