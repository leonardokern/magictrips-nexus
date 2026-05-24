"use client"

import Image from "next/image"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  Layers,
  Plus,
  Tag,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  ICONES_TIPO_PRODUTO,
  ICONE_LABEL,
  TIPO_CAMPO_LABEL,
  type TipoCampo,
  type TipoProdutoVinculoCampo,
} from "@/lib/schemas/tipo-produto"
import {
  createTipoProduto,
  updateTipoProduto,
} from "@/app/(dashboard)/tipos-produto/actions"

type CampoExtra = {
  id: string
  nome: string
  tipo_campo: TipoCampo
}

type ModeProps =
  | { mode: "create" }
  | {
      mode: "edit"
      id: string
      initial: {
        nome: string
        icone: string | null
        campos: TipoProdutoVinculoCampo[]
      }
    }

type Props = ModeProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Catálogo completo de campos extras ativos disponíveis pra vincular. */
  camposDisponiveis: CampoExtra[]
}

type Vinculo = TipoProdutoVinculoCampo & { _campo?: CampoExtra }

type FormState = {
  nome: string
  icone: string | null
  campos: Vinculo[]
}

const EMPTY = (): FormState => ({ nome: "", icone: null, campos: [] })

export function TipoProdutoFormModal(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<FormState>(EMPTY)
  const [campoIdParaAdicionar, setCampoIdParaAdicionar] = useState<string>("")

  const isCreate = props.mode === "create"

  // Mapa pra hidratar `_campo` no boot
  const mapaCampos = new Map(props.camposDisponiveis.map((c) => [c.id, c]))

  useEffect(() => {
    if (!props.open) return
    setErrors({})
    setCampoIdParaAdicionar("")
    if (props.mode === "edit") {
      const hidratados: Vinculo[] = props.initial.campos
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .map((c, i) => ({
          campo_id: c.campo_id,
          obrigatorio: c.obrigatorio,
          ordem: i,
          _campo: mapaCampos.get(c.campo_id),
        }))
      setV({ nome: props.initial.nome, icone: props.initial.icone, campos: hidratados })
    } else {
      setV(EMPTY())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.mode])

  function adicionarCampo() {
    if (!campoIdParaAdicionar) return
    if (v.campos.some((c) => c.campo_id === campoIdParaAdicionar)) {
      toast.error("Esse campo já está vinculado.")
      return
    }
    const campo = mapaCampos.get(campoIdParaAdicionar)
    if (!campo) return
    setV((s) => ({
      ...s,
      campos: [
        ...s.campos,
        {
          campo_id: campo.id,
          obrigatorio: false,
          ordem: s.campos.length,
          _campo: campo,
        },
      ],
    }))
    setCampoIdParaAdicionar("")
  }

  function removerCampo(campoId: string) {
    setV((s) => ({
      ...s,
      campos: s.campos
        .filter((c) => c.campo_id !== campoId)
        .map((c, i) => ({ ...c, ordem: i })),
    }))
  }

  function moverCampo(idx: number, delta: -1 | 1) {
    const novo = v.campos.slice()
    const dest = idx + delta
    if (dest < 0 || dest >= novo.length) return
    ;[novo[idx], novo[dest]] = [novo[dest]!, novo[idx]!]
    setV((s) => ({
      ...s,
      campos: novo.map((c, i) => ({ ...c, ordem: i })),
    }))
  }

  function toggleObrigatorio(campoId: string) {
    setV((s) => ({
      ...s,
      campos: s.campos.map((c) =>
        c.campo_id === campoId ? { ...c, obrigatorio: !c.obrigatorio } : c,
      ),
    }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    if (v.nome.trim().length < 2) {
      setErrors({ nome: "Informe o nome do tipo." })
      return
    }

    const payload = {
      nome: v.nome.trim(),
      icone: v.icone,
      campos: v.campos.map((c, i) => ({
        campo_id: c.campo_id,
        obrigatorio: c.obrigatorio,
        ordem: i,
      })),
    }

    startTransition(async () => {
      const r = isCreate
        ? await createTipoProduto(payload)
        : await updateTipoProduto(props.id, payload)
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success(isCreate ? "Tipo criado." : "Tipo atualizado.")
      props.onOpenChange(false)
      router.refresh()
    })
  }

  // Lista de campos disponíveis pra adicionar (exclui os já vinculados)
  const camposNaoVinculados = props.camposDisponiveis.filter(
    (c) => !v.campos.some((vc) => vc.campo_id === c.id),
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) setErrors({})
        props.onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-nexus-bright" />
            {isCreate ? "Novo tipo de produto" : "Editar tipo de produto"}
          </DialogTitle>
          <DialogDescription>
            Tipo é o que classifica o produto vendido (Aéreo, Hotel, Cruzeiro…)
            e quais campos extras aparecem ao registrar a venda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          <Field
            label="Nome do tipo"
            icon={<Tag className="h-3.5 w-3.5" />}
            error={errors.nome}
          >
            <Input
              value={v.nome}
              onChange={(e) => setV((s) => ({ ...s, nome: e.target.value }))}
              placeholder="Ex: Aéreo, Hotel, Pacote"
              maxLength={60}
              required
            />
          </Field>

          {/* ── Picker de ícone ──────────────────────────────────────── */}
          <div>
            <Label className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
              Ícone do tipo
            </Label>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-7">
              {ICONES_TIPO_PRODUTO.map((key) => {
                const selected = v.icone === key
                return (
                  <button
                    key={key}
                    type="button"
                    title={ICONE_LABEL[key]}
                    aria-label={ICONE_LABEL[key]}
                    onClick={() =>
                      setV((s) => ({
                        ...s,
                        icone: s.icone === key ? null : key,
                      }))
                    }
                    className={`flex items-center justify-center rounded-xl border p-2.5 transition-all ${
                      selected
                        ? "border-nexus-bright/60 bg-nexus-bright/15 ring-1 ring-nexus-bright/40"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="relative h-8 w-8">
                      <Image
                        src={`/icons/tipos-produto/${key}.png`}
                        alt={ICONE_LABEL[key]}
                        fill
                        className="object-contain"
                        style={{
                          filter: "brightness(0) invert(1)",
                          opacity: selected ? 0.95 : 0.45,
                        }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
            {v.icone && (
              <p className="mt-2 text-[10px] text-white/35">
                Clique novamente no ícone para deselecionar.
              </p>
            )}
          </div>

          {/* ── Campos extras ────────────────────────────────────────── */}
          <div>
            <Label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
              <Layers className="h-3.5 w-3.5" />
              Campos extras vinculados
            </Label>
            <p className="mb-3 text-[11px] text-white/40">
              Estes campos aparecerão ao registrar uma venda deste tipo. Marque
              os obrigatórios e use as setas pra reordenar.
            </p>

            <div className="flex gap-2">
              <Select
                value={campoIdParaAdicionar || undefined}
                onValueChange={(val) => setCampoIdParaAdicionar(val)}
                disabled={camposNaoVinculados.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      camposNaoVinculados.length === 0
                        ? "Todos os campos já estão vinculados"
                        : "Selecione um campo"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {camposNaoVinculados.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}{" "}
                      <span className="text-white/40">
                        ({TIPO_CAMPO_LABEL[c.tipo_campo]})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={adicionarCampo}
                disabled={!campoIdParaAdicionar}
                className="border-white/10 bg-transparent text-white/75 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Vincular
              </Button>
            </div>

            {v.campos.length === 0 ? (
              <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/55">
                Nenhum campo vinculado. Este tipo terá apenas os campos padrão
                de venda. Adicione campos pra capturar info extra.
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Ordem
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Campo
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Tipo
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Obrigatório
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-white/45">
                        {" "}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.campos.map((c, i) => {
                      const campo = c._campo ?? mapaCampos.get(c.campo_id)
                      return (
                        <tr
                          key={c.campo_id}
                          className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025]"
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => moverCampo(i, -1)}
                                disabled={i === 0}
                                className="text-white/40 hover:text-white disabled:opacity-30"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moverCampo(i, 1)}
                                disabled={i === v.campos.length - 1}
                                className="text-white/40 hover:text-white disabled:opacity-30"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-white/85">
                            {campo?.nome ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-white/55">
                            {campo
                              ? TIPO_CAMPO_LABEL[campo.tipo_campo]
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Checkbox
                              checked={c.obrigatorio}
                              onCheckedChange={() =>
                                toggleObrigatorio(c.campo_id)
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removerCampo(c.campo_id)}
                              className="text-rose-300/70 hover:text-rose-200"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => props.onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
            >
              {isPending
                ? "Salvando…"
                : isCreate
                  ? "Criar tipo"
                  : "Salvar"}
            </Button>
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
  children,
}: {
  label: string
  icon?: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
        {icon}
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
