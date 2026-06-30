"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { List, Plus, Tag, Trash2, Type } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TIPOS_CAMPO,
  TIPO_CAMPO_LABEL,
  type CampoOpcao,
  type TipoCampo,
} from "@/lib/schemas/tipo-produto"

const PLACEHOLDER_SUGESTAO: Record<TipoCampo, string> = {
  texto_curto: "Ex: CGH-SSA, LATAM123",
  texto:       "Ex: Observações sobre o serviço",
  numero:      "Ex: 2",
  valor:       "Ex: 1.500,00",
  data:        "Ex: 01/01/2025",
  dropdown:    "",
  sim_nao:     "",
  fornecedor:  "",
}
import {
  createCampoExtra,
  updateCampoExtra,
} from "@/app/(dashboard)/tipos-produto/actions"

type ModeProps =
  | { mode: "create" }
  | {
      mode: "edit"
      id: string
      initial: {
        nome: string
        tipo_campo: TipoCampo
        placeholder: string | null
        opcoes: CampoOpcao[]
      }
    }

type Props = ModeProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback opcional disparado após criar/editar com sucesso (além do router.refresh). */
  onSuccess?: () => void
}

type FormState = {
  nome: string
  tipo_campo: TipoCampo
  placeholder: string
  opcoes: { valor: string; ordem: number }[]
}

const EMPTY = (): FormState => ({
  nome: "",
  tipo_campo: "texto",
  placeholder: "",
  opcoes: [],
})

export function CampoExtraFormModal(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<FormState>(EMPTY)
  const [novaOpcao, setNovaOpcao] = useState("")

  const isCreate = props.mode === "create"

  useEffect(() => {
    if (!props.open) return
    setErrors({})
    setNovaOpcao("")
    if (props.mode === "edit") {
      setV({
        nome: props.initial.nome,
        tipo_campo: props.initial.tipo_campo,
        placeholder: props.initial.placeholder ?? "",
        opcoes: props.initial.opcoes
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((o, i) => ({ valor: o.valor, ordem: i })),
      })
    } else {
      setV(EMPTY())
    }
  }, [props.open, props.mode])

  function update<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((s) => ({ ...s, [k]: val }))
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }))
  }

  function adicionarOpcao() {
    const trimmed = novaOpcao.trim()
    if (!trimmed) return
    if (v.opcoes.some((o) => o.valor.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Essa opção já está na lista.")
      return
    }
    setV((s) => ({
      ...s,
      opcoes: [...s.opcoes, { valor: trimmed, ordem: s.opcoes.length }],
    }))
    setNovaOpcao("")
  }

  function removerOpcao(idx: number) {
    setV((s) => ({
      ...s,
      opcoes: s.opcoes
        .filter((_, i) => i !== idx)
        .map((o, i) => ({ ...o, ordem: i })),
    }))
  }

  // Reordenação manual foi removida — regra de plataforma manda alfabético
  // sempre (ver feedback_selects_ordenacao_alfabetica.md). A coluna `ordem`
  // continua na tabela por compat, mas não é exposta na UI.

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    if (v.tipo_campo === "dropdown" && v.opcoes.length === 0) {
      setErrors({ opcoes: "Adicione ao menos uma opção." })
      toast.error("Dropdown precisa de pelo menos uma opção.")
      return
    }

    const payload = {
      nome: v.nome.trim(),
      tipo_campo: v.tipo_campo,
      placeholder: v.placeholder.trim() || null,
      opcoes:
        v.tipo_campo === "dropdown"
          ? v.opcoes.map((o, i) => ({ valor: o.valor, ordem: i }))
          : [],
    }

    startTransition(async () => {
      const r = isCreate
        ? await createCampoExtra(payload)
        : await updateCampoExtra(props.id, payload)
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success(isCreate ? "Campo criado." : "Campo atualizado.")
      props.onOpenChange(false)
      router.refresh()
      props.onSuccess?.()
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-nexus-bright" />
            {isCreate ? "Novo campo" : "Editar campo"}
          </DialogTitle>
          <DialogDescription>
            Defina nome, tipo e (se for dropdown) as opções disponíveis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <Field
            label="Nome do campo"
            icon={<Tag className="h-3.5 w-3.5" />}
            error={errors.nome}
          >
            <Input
              value={v.nome}
              onChange={(e) => update("nome", e.target.value)}
              placeholder="Ex: Localizador, Companhia Aérea, Trecho"
              maxLength={60}
              required
            />
          </Field>

          <Field
            label="Tipo do campo"
            icon={<Type className="h-3.5 w-3.5" />}
            error={errors.tipo_campo}
          >
            <Select
              value={v.tipo_campo}
              onValueChange={(val) => update("tipo_campo", val as TipoCampo)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CAMPO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_CAMPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Placeholder (opcional)"
            error={errors.placeholder}
            hint="Texto de exemplo mostrado no input."
          >
            <Input
              value={v.placeholder}
              onChange={(e) => update("placeholder", e.target.value)}
              placeholder={PLACEHOLDER_SUGESTAO[v.tipo_campo] || "Opcional"}
              maxLength={120}
            />
          </Field>

          {v.tipo_campo === "dropdown" && (
            <div>
              <Label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
                <List className="h-3.5 w-3.5" />
                Opções do dropdown
              </Label>

              <div className="flex gap-2">
                <Input
                  value={novaOpcao}
                  onChange={(e) => setNovaOpcao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      adicionarOpcao()
                    }
                  }}
                  placeholder="Digite a opção e tecle Enter"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={adicionarOpcao}
                  className="border-white/10 bg-transparent text-white/75 hover:bg-white/[0.04] hover:text-white"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>

              {v.opcoes.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                  Adicione ao menos uma opção pra esse dropdown.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {/* Lista sempre exibida em ordem alfabética (pt-BR, case/
                      acento insensível). A `ordem` na tabela vira vestigial:
                      no submit é normalizada por índice da lista ordenada. */}
                  {v.opcoes
                    .slice()
                    .sort((a, b) =>
                      a.valor.localeCompare(b.valor, "pt-BR", {
                        sensitivity: "base",
                      }),
                    )
                    .map((o) => {
                      const idxOriginal = v.opcoes.findIndex(
                        (x) => x.valor === o.valor,
                      )
                      return (
                        <li
                          key={o.valor}
                          className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
                        >
                          <span className="flex-1 text-sm text-white/85">
                            {o.valor}
                          </span>
                          <button
                            type="button"
                            onClick={() => removerOpcao(idxOriginal)}
                            className="text-rose-300/70 hover:text-rose-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      )
                    })}
                </ul>
              )}
              {errors.opcoes && (
                <p className="mt-1 text-[11px] text-destructive">
                  {errors.opcoes}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => props.onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <LoaderButton
              type="submit"
              loading={isPending}
              className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
            >
              {isCreate ? "Criar campo" : "Salvar"}
            </LoaderButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
