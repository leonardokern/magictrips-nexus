"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateInput } from "@/components/ui/date-input"
import { LoaderButton } from "@/components/ui/loader-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  criarEventoManual,
  listarUsuariosParaCompartilhar,
  type UsuarioParaCompartilhar,
} from "@/app/(dashboard)/agenda/actions"
import { Users } from "lucide-react"
import { UsuariosMultiSelect } from "./usuarios-multi-select"

/**
 * Cor padrão por tipo — espelha a legenda do calendário (sidebar). Mantém
 * consistência visual entre o popup de criação, a grade do mês e o card de
 * "Próximos 4 dias" do dashboard.
 */
const TIPO_CORES: Record<"nota" | "reuniao" | "tarefa" | "outro", string> = {
  nota: "#1498D5",     // azul Nexus
  reuniao: "#a855f7",  // roxo
  tarefa: "#10b981",   // verde
  outro: "#fbbf24",    // amarelo
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  dataPadrao: string | null
  onSaved: () => void
}

export function EventoFormModal({ open, onOpenChange, empresaId, dataPadrao, onSaved }: Props) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [tipo, setTipo] = useState<"nota" | "reuniao" | "tarefa" | "outro">("nota")
  const [diaInteiro, setDiaInteiro] = useState(false)
  const [horaInicio, setHoraInicio] = useState("")
  const [horaFim, setHoraFim] = useState("")
  const [usuarios, setUsuarios] = useState<UsuarioParaCompartilhar[]>([])
  const [compartilharCom, setCompartilharCom] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setTitulo("")
      setDescricao("")
      setDataInicio(dataPadrao ?? "")
      setDataFim("")
      setTipo("nota")
      setDiaInteiro(false)
      setHoraInicio("")
      setHoraFim("")
      setCompartilharCom([])
    }
  }, [open, dataPadrao])

  // Carrega lista de usuários disponíveis pra compartilhar quando o modal abre
  useEffect(() => {
    if (!open) return
    listarUsuariosParaCompartilhar().then((r) => {
      if (r.ok && r.data) setUsuarios(r.data)
      else setUsuarios([])
    })
  }, [open])


  function salvar() {
    if (titulo.trim().length < 2) {
      toast.error("Informe um título.")
      return
    }
    if (!dataInicio) {
      toast.error("Informe a data.")
      return
    }
    if (!diaInteiro && !horaInicio) {
      toast.error("Informe o horário de início.")
      return
    }
    startTransition(async () => {
      const r = await criarEventoManual(empresaId, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data_inicio: dataInicio,
        data_fim: dataFim || undefined,
        tipo,
        // Cor é derivada do tipo (mesma da legenda do calendário) — usuário
        // não escolhe pra manter consistência visual em todo o sistema.
        cor: TIPO_CORES[tipo],
        all_day: diaInteiro,
        hora_inicio: diaInteiro ? undefined : horaInicio,
        hora_fim: diaInteiro || !horaFim ? undefined : horaFim,
        compartilhar_com: compartilharCom.length > 0 ? compartilharCom : undefined,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Evento criado.")
      onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
          <DialogDescription>
            Crie uma nota, reunião ou tarefa para a sua agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
              Título *
            </Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Reunião com fornecedor"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
                Data *
              </Label>
              <DateInput value={dataInicio} onChange={setDataInicio} />
            </div>
            <div>
              <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
                Tipo
              </Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                <SelectTrigger>
                  <SelectValue>
                    <TipoChip tipo={tipo} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nota">
                    <TipoChip tipo="nota" />
                  </SelectItem>
                  <SelectItem value="reuniao">
                    <TipoChip tipo="reuniao" />
                  </SelectItem>
                  <SelectItem value="tarefa">
                    <TipoChip tipo="tarefa" />
                  </SelectItem>
                  <SelectItem value="outro">
                    <TipoChip tipo="outro" />
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggle dia inteiro + horários */}
          <div className="space-y-2 rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/85">
              <input
                type="checkbox"
                checked={diaInteiro}
                onChange={(e) => setDiaInteiro(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/[0.04] accent-nexus-bright"
              />
              Dia inteiro
            </label>

            {!diaInteiro && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
                    Início *
                  </Label>
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="tabular-nums"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
                    Fim (opcional)
                  </Label>
                  <Input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Compartilhamento — combobox com busca e chips */}
          <div>
            <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/55">
              <Users className="h-3 w-3" />
              Compartilhar com (opcional)
            </Label>
            <UsuariosMultiSelect
              opcoes={usuarios}
              value={compartilharCom}
              onChange={setCompartilharCom}
              placeholder="Clique para selecionar usuários…"
              emptyMessage="Sem outros usuários disponíveis na empresa."
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
              Descrição (opcional)
            </Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <LoaderButton
            onClick={salvar}
            loading={isPending}
            className="bg-nexus-bright hover:bg-nexus-bright-soft"
          >
            Criar evento
          </LoaderButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Linha "● Nota" — bolinha colorida + nome do tipo, usada no Select. */
function TipoChip({ tipo }: { tipo: keyof typeof TIPO_CORES }) {
  const labels: Record<keyof typeof TIPO_CORES, string> = {
    nota: "Nota",
    reuniao: "Reunião",
    tarefa: "Tarefa",
    outro: "Outro",
  }
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: TIPO_CORES[tipo] }}
      />
      {labels[tipo]}
    </span>
  )
}
