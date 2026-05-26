"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  User2,
  Wand2,
  X,
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
  atualizarFotoUsuario,
  createUsuario,
  updateUsuario,
} from "@/app/(dashboard)/usuarios/actions"
import { cn } from "@/lib/utils"

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
        foto_url?: string | null
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

  // ── Estado de foto (fora do FormState — upload separado) ─────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoExistente, setFotoExistente] = useState<string | null>(null)
  const [fotoRemovida, setFotoRemovida] = useState(false)

  // URL efetiva a mostrar: preview local > existente salva > null
  const fotoAtual = fotoPreview ?? (fotoRemovida ? null : fotoExistente)

  // Libera URL de objeto ao desmontar / trocar preview
  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    }
  }, [fotoPreview])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2 MB.")
      return
    }
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    setFotoRemovida(false)
    // Reseta input pra permitir re-selecionar o mesmo arquivo
    e.target.value = ""
  }

  function removerFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview(null)
    setFotoRemovida(true)
  }

  // Sincroniza initial quando o modal abre (em edit)
  useEffect(() => {
    if (!props.open) return
    // Reset foto state
    setFotoFile(null)
    setFotoPreview(null)
    setFotoRemovida(false)

    // Quando só existe uma empresa, sempre pré-preenche — o seletor fica oculto
    // e o usuário não tem como escolher; não deve bloquear na validação.
    const autoEmpresaIds =
      props.empresas.length === 1 ? [props.empresas[0]!.id] : undefined

    if (props.mode === "edit") {
      setV({
        nome: props.initial.nome,
        email: props.initial.email,
        perfil_id: props.initial.perfil_id,
        empresa_ids:
          autoEmpresaIds ?? (props.initial.empresa_ids.length > 0
            ? props.initial.empresa_ids
            : []),
        senha: "",
        forcar_troca_senha: true,
      })
      setFotoExistente(props.initial.foto_url ?? null)
    } else {
      setV({ ...EMPTY, empresa_ids: autoEmpresaIds ?? [] })
      setFotoExistente(null)
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

    // Se só existe uma empresa e o estado ficou vazio (edge case), auto-corrige
    const empresaIds =
      v.empresa_ids.length === 0 && props.empresas.length === 1
        ? [props.empresas[0]!.id]
        : v.empresa_ids

    if (empresaIds.length === 0) {
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
          empresa_ids: empresaIds,
          senha: v.senha,
          forcar_troca_senha: v.forcar_troca_senha,
        })
        if (!r.ok) {
          if (r.fieldErrors) setErrors(r.fieldErrors)
          toast.error(r.error)
          return
        }
        // Upload da foto (best-effort — não bloqueia o fluxo principal)
        if (r.data && fotoFile) {
          const fd = new FormData()
          fd.append("foto", fotoFile)
          const rFoto = await atualizarFotoUsuario(r.data.id, fd)
          if (!rFoto.ok) toast.error(`Usuário criado, mas a foto falhou: ${rFoto.error}`)
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
        empresa_ids: empresaIds,
      }

      // edit
      const r = await updateUsuario(props.id, payload)
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }

      // Upload / remoção de foto (best-effort)
      if (fotoFile) {
        const fd = new FormData()
        fd.append("foto", fotoFile)
        const rFoto = await atualizarFotoUsuario(props.id, fd)
        if (!rFoto.ok) toast.error(`Dados salvos, mas a foto falhou: ${rFoto.error}`)
      } else if (fotoRemovida) {
        const fd = new FormData()
        fd.append("remover", "true")
        await atualizarFotoUsuario(props.id, fd)
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
            {/* Avatar com upload + nome */}
            <div className="flex items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              {/* Input de arquivo oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={props.readOnly}
              />

              {/* Círculo do avatar */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => !props.readOnly && fileInputRef.current?.click()}
                  title={props.readOnly ? undefined : fotoAtual ? "Clique para trocar a foto" : "Clique para adicionar foto"}
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold",
                    fotoAtual
                      ? "border-white/15 bg-white/[0.04] text-white"
                      : "border-nexus-bright/30 bg-nexus-bright/15 text-nexus-bright",
                    !props.readOnly && "cursor-pointer",
                  )}
                >
                  {fotoAtual ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fotoAtual}
                      alt={v.nome || "Avatar"}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    previewIniciais || "—"
                  )}

                  {/* Overlay com ícone de câmera */}
                  {!props.readOnly && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>

                {/* Botão de remover */}
                {fotoAtual && !props.readOnly && (
                  <button
                    type="button"
                    onClick={removerFoto}
                    title="Remover foto"
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-card text-white/60 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
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
                {!props.readOnly && (
                  <p className="text-[11px] text-white/35">
                    {fotoAtual ? "JPG, PNG ou WebP · máx. 2 MB" : "Clique na foto para adicionar · JPG, PNG ou WebP · máx. 2 MB"}
                  </p>
                )}
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
