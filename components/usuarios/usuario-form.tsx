"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SenhaProvisoriaDialog } from "./senha-provisoria-dialog"
import { derivarIniciais } from "@/lib/utils/password"
import {
  createUsuario,
  updateUsuario,
} from "@/app/(dashboard)/usuarios/actions"

type Perfil = { id: string; nome: string }
type Empresa = { id: string; nome: string }

type Props =
  | {
      mode: "create"
      perfis: Perfil[]
      empresas: Empresa[]
    }
  | {
      mode: "edit"
      id: string
      perfis: Perfil[]
      empresas: Empresa[]
      initial: {
        nome: string
        email: string
        iniciais: string | null
        perfil_id: string
        empresa_id: string | null
        comissao_percentual: number | null
      }
    }

type FormState = {
  nome: string
  email: string
  iniciais: string
  perfil_id: string
  empresa_id: string | null
  comissao_percentual: string
}

export function UsuarioForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [senhaDialog, setSenhaDialog] = useState<{
    open: boolean
    senha: string
    nome: string
    nextHref?: string
  } | null>(null)

  const isCreate = props.mode === "create"
  const initial = isCreate
    ? null
    : props.initial

  const [v, setV] = useState<FormState>({
    nome: initial?.nome ?? "",
    email: initial?.email ?? "",
    iniciais: initial?.iniciais ?? "",
    perfil_id: initial?.perfil_id ?? "",
    empresa_id: initial?.empresa_id ?? null,
    comissao_percentual:
      initial?.comissao_percentual != null
        ? String(initial.comissao_percentual)
        : "",
  })

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }))
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  const perfilSelecionado = props.perfis.find((p) => p.id === v.perfil_id)
  const ehAdmin = perfilSelecionado?.nome === "Administrador"

  // Auto-derive iniciais conforme digita nome, se não foi tocado manualmente
  const [iniciaisManual, setIniciaisManual] = useState(
    Boolean(initial?.iniciais),
  )
  const iniciaisDisplay = iniciaisManual
    ? v.iniciais
    : v.iniciais || derivarIniciais(v.nome)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    startTransition(async () => {
      const payload = {
        nome: v.nome,
        email: v.email,
        perfil_id: v.perfil_id,
        empresa_id: ehAdmin ? null : v.empresa_id,
        iniciais: iniciaisDisplay,
        comissao_percentual:
          v.comissao_percentual === ""
            ? null
            : Number(v.comissao_percentual),
      }

      if (isCreate) {
        const result = await createUsuario(payload)
        if (!result.ok) {
          if (result.fieldErrors) setErrors(result.fieldErrors)
          toast.error(result.error)
          return
        }
        if (result.data) {
          setSenhaDialog({
            open: true,
            senha: result.data.senhaProvisoria,
            nome: payload.nome,
            nextHref: `/usuarios/${result.data.id}`,
          })
        }
      } else {
        const result = await updateUsuario(props.id, payload)
        if (!result.ok) {
          if (result.fieldErrors) setErrors(result.fieldErrors)
          toast.error(result.error)
          return
        }
        toast.success("Usuário atualizado.")
        router.push(`/usuarios/${props.id}`)
      }
    })
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Dados do usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Nome completo *" error={errors.nome} className="md:col-span-2">
              <Input
                value={v.nome}
                onChange={(e) => update("nome", e.target.value)}
                required
              />
            </Field>

            <Field label="E-mail *" error={errors.email}>
              <Input
                type="email"
                value={v.email}
                onChange={(e) => update("email", e.target.value)}
                disabled={!isCreate}
                required
              />
              {!isCreate && (
                <p className="mt-1 text-xs text-white/45">
                  E-mail não é editável depois da criação.
                </p>
              )}
            </Field>

            <Field label="Iniciais" error={errors.iniciais}>
              <Input
                value={iniciaisDisplay}
                onChange={(e) => {
                  setIniciaisManual(true)
                  update("iniciais", e.target.value.toUpperCase())
                }}
                maxLength={4}
                placeholder="MM"
              />
              <p className="mt-1 text-xs text-white/45">
                Derivado do nome automaticamente. Sobrescreva se quiser.
              </p>
            </Field>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-base text-white">Acesso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Perfil *" error={errors.perfil_id}>
              <Select
                value={v.perfil_id || undefined}
                onValueChange={(val) => update("perfil_id", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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

            <Field
              label={ehAdmin ? "Empresa (Administrador)" : "Empresa *"}
              error={errors.empresa_id}
              hint={
                ehAdmin
                  ? "Administrador acessa todas as empresas."
                  : undefined
              }
            >
              <Select
                value={v.empresa_id ?? (ehAdmin ? "todas" : undefined)}
                onValueChange={(val) =>
                  update("empresa_id", val === "todas" ? null : val)
                }
                disabled={ehAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ehAdmin && (
                    <SelectItem value="todas">Todas as empresas</SelectItem>
                  )}
                  {props.empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Comissão (%)"
              error={errors.comissao_percentual}
              hint="Em branco = usa régua padrão 30/40/50%. Preenchido = % fixo (ex: 12 para Del Mondo)."
              className="md:col-span-2"
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={v.comissao_percentual}
                onChange={(e) => update("comissao_percentual", e.target.value)}
                placeholder="ex: 12.00"
                className="max-w-[160px]"
              />
            </Field>
          </CardContent>
        </Card>

        <Separator className="bg-white/[0.06]" />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={isPending}
            className="text-white/70 hover:bg-white/[0.04] hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-indigo-500 text-white hover:bg-indigo-400"
          >
            {isPending
              ? "Salvando..."
              : isCreate
                ? "Criar usuário"
                : "Salvar alterações"}
          </Button>
        </div>
      </form>

      {senhaDialog && (
        <SenhaProvisoriaDialog
          open={senhaDialog.open}
          onClose={() => {
            setSenhaDialog(null)
            if (senhaDialog.nextHref) router.push(senhaDialog.nextHref)
            else router.push("/usuarios")
          }}
          senha={senhaDialog.senha}
          contexto="criar"
          nome={senhaDialog.nome}
        />
      )}
    </>
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
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/55">
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-white/45">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
