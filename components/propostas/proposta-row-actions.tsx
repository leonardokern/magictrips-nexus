"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Eye,
  FileDown,
  Pencil,
  Send,
  CheckCircle,
  XCircle,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LoaderButton } from "@/components/ui/loader-button"
import { IconTooltip } from "@/components/ui/tooltip"
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
import {
  atualizarStatusProposta,
  excluirProposta,
  getDadosNovaProposta,
  type PropostaStatus,
  type DadosNovaProposta,
} from "@/app/(dashboard)/propostas/actions"
import { PropostaWizard, type PropostaWizardData } from "./proposta-wizard"
import {
  Dialog as EditDialog,
  DialogContent as EditDialogContent,
  DialogHeader as EditDialogHeader,
  DialogTitle as EditDialogTitle,
} from "@/components/ui/dialog"
import { ModalLoader } from "@/components/ui/modal-loader"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Proposta = {
  id: string
  identificador: string
  status: PropostaStatus
  clienteNome: string
  podeEditar: boolean
  podeExcluir: boolean
}

const STATUS_LABEL: Record<PropostaStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PropostaRowActions({ proposta }: { proposta: Proposta }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editDados, setEditDados] = useState<DadosNovaProposta | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [novoStatus, setNovoStatus] = useState<PropostaStatus>(proposta.status)
  const [isPending, startTransition] = useTransition()

  const pdfUrl = `/api/propostas/${proposta.id}/pdf`

  function openEdit() {
    setEditOpen(true)
    setEditLoading(true)
    getDadosNovaProposta().then((r) => {
      if (r.ok) setEditDados(r.data)
      setEditLoading(false)
    })
  }

  function onEditSuccess() {
    setEditOpen(false)
    router.refresh()
  }

  function handleStatusChange() {
    startTransition(async () => {
      const r = await atualizarStatusProposta(proposta.id, novoStatus)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Status atualizado.")
      setStatusOpen(false)
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await excluirProposta(proposta.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Proposta excluída.")
      setDeleteOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {/* PDF */}
        <IconTooltip label="Baixar PDF">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
              "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.07] hover:text-white",
            )}
            aria-label="Baixar PDF"
          >
            <FileDown className="h-4 w-4" />
          </a>
        </IconTooltip>

        {/* Status */}
        {proposta.podeEditar && (
          <IconAction icon={Send} label="Alterar status" onClick={() => { setNovoStatus(proposta.status); setStatusOpen(true) }} tone="bright" />
        )}

        {/* Editar */}
        {proposta.podeEditar && (
          <IconAction icon={Pencil} label="Editar" onClick={openEdit} tone="bright" />
        )}

        {/* Excluir */}
        {proposta.podeExcluir && (
          <IconAction icon={Trash2} label="Excluir" onClick={() => setDeleteOpen(true)} tone="rose" />
        )}
      </div>

      {/* Modal: editar */}
      <EditDialog open={editOpen} onOpenChange={setEditOpen}>
        <EditDialogContent className="flex max-h-[92vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <EditDialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
            <EditDialogTitle>Editar proposta {proposta.identificador}</EditDialogTitle>
          </EditDialogHeader>

          {editLoading || !editDados ? (
            <div className="flex-1 py-8">
              <ModalLoader label="Carregando dados..." />
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <PropostaWizard
                dados={editDados}
                propostaId={proposta.id}
                onSuccess={onEditSuccess}
                onCancel={() => setEditOpen(false)}
              />
            </div>
          )}
        </EditDialogContent>
      </EditDialog>

      {/* Modal: status */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status</DialogTitle>
            <DialogDescription>
              Proposta <strong className="text-white">{proposta.identificador}</strong>
              {" — "}{proposta.clienteNome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as PropostaStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as PropostaStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>Cancelar</Button>
            </DialogClose>
            <LoaderButton loading={isPending} onClick={handleStatusChange}>
              Salvar
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: excluir */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir proposta?</DialogTitle>
            <DialogDescription>
              A proposta <strong className="text-white">{proposta.identificador}</strong> para{" "}
              <strong className="text-white">{proposta.clienteNome}</strong> será excluída
              permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>Cancelar</Button>
            </DialogClose>
            <LoaderButton
              loading={isPending}
              onClick={handleDelete}
              className="bg-rose-600 text-white hover:bg-rose-600/90"
            >
              Excluir
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Icon button (canônico do sistema) ───────────────────────────────────────

type Tone = "neutral" | "bright" | "amber" | "emerald" | "rose"

function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  tone: Tone
}) {
  const toneClass: Record<Tone, string> = {
    neutral:
      "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.07] hover:text-white",
    bright:
      "border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright hover:border-nexus-bright/50 hover:bg-nexus-bright/15",
    amber:
      "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-200",
    emerald:
      "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/15 hover:text-emerald-200",
    rose:
      "border-rose-500/25 bg-rose-500/[0.08] text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/15 hover:text-rose-300",
  }

  return (
    <IconTooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          toneClass[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </IconTooltip>
  )
}
