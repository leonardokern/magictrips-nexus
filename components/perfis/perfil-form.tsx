"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PermissoesEditor } from "./permissoes-editor"
import { permissoesTodas } from "@/lib/constants/permissoes"
import type { PermissoesValue } from "@/lib/schemas/perfil"
import {
  createPerfil,
  updatePerfil,
  togglePerfilAtivo,
} from "@/app/(dashboard)/perfis/actions"

type Props =
  | {
      mode: "create"
    }
  | {
      mode: "edit"
      id: string
      nome: string
      sistema: boolean
      /** Chave estável do perfil sistema; null pra customizados. */
      chave_sistema: "admin" | "gerente" | "agente" | null
      ativo: boolean
      permissoes: PermissoesValue
    }

export function PerfilForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isCreate = props.mode === "create"
  const isAdmin = !isCreate && props.chave_sistema === "admin"
  const isSistema = !isCreate && props.sistema

  const [nome, setNome] = useState(isCreate ? "" : props.nome)
  const [permissoes, setPermissoes] = useState<PermissoesValue>(
    isCreate ? permissoesTodas(false) : props.permissoes,
  )
  const [ativo, setAtivo] = useState(isCreate ? true : props.ativo)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function update<K extends string>(key: K, _value: unknown) {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    if (isAdmin) {
      toast.error("O perfil Administrador não é editável.")
      return
    }

    startTransition(async () => {
      if (isCreate) {
        const result = await createPerfil({ nome, permissoes })
        if (!result.ok) {
          if (result.fieldErrors) setErrors(result.fieldErrors)
          toast.error(result.error)
          return
        }
        toast.success("Perfil criado.")
        if (result.data?.id) router.push(`/perfis/${result.data.id}`)
        else router.push("/perfis")
        return
      }

      // Edição: nome editável inclusive em perfis sistema (chave_sistema é a
      // identidade estável, não o nome).
      const payload: { nome?: string; permissoes: PermissoesValue } = {
        permissoes,
        nome,
      }
      const result = await updatePerfil(props.id, payload)
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        toast.error(result.error)
        return
      }
      toast.success("Perfil atualizado.")
      router.refresh()
    })
  }

  async function onToggleAtivo(novoAtivo: boolean) {
    if (isCreate || isSistema) return
    const previous = ativo
    setAtivo(novoAtivo)
    const result = await togglePerfilAtivo(props.id, novoAtivo)
    if (!result.ok) {
      setAtivo(previous)
      toast.error(result.error)
    } else {
      toast.success(novoAtivo ? "Perfil ativado." : "Perfil desativado.")
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs font-medium">
              Nome do perfil *
            </Label>
            <Input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                update("nome", e.target.value)
              }}
              required
            />
            {isAdmin && (
              <p className="mt-1 text-xs text-muted-foreground">
                O Administrador tem acesso total automático — permissões e tipo
                são fixos, mas o nome pode ser renomeado livremente.
              </p>
            )}
            {errors.nome && (
              <p className="mt-1 text-xs text-destructive">{errors.nome}</p>
            )}
          </div>

          {!isCreate && !isSistema && (
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Status</Label>
              <div className="flex items-center gap-3">
                <Switch checked={ativo} onCheckedChange={onToggleAtivo} />
                <span className="text-sm">{ativo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">
          Permissões por módulo
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Marque o que este perfil pode fazer em cada seção do sistema.
          {isAdmin &&
            " O Administrador tem todas as permissões marcadas automaticamente."}
        </p>
        <PermissoesEditor
          value={permissoes}
          onChange={setPermissoes}
          readOnlyAllTrue={isAdmin}
          disabled={isPending}
        />
      </div>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancelar
        </Button>
        {!isAdmin && (
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Salvando..."
              : isCreate
                ? "Criar perfil"
                : "Salvar alterações"}
          </Button>
        )}
      </div>
    </form>
  )
}
