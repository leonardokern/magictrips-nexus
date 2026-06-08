"use client"

import { useRef, useState, useTransition } from "react"
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  uploadComprovanteCobranca,
  obterUrlComprovante,
  excluirComprovante,
} from "@/app/(dashboard)/vendas/comprovantes-actions"
import { MIMES_ACEITOS, MAX_ANEXO_BYTES } from "@/lib/schemas/anexo"

type Props = {
  storagePath: string
  nomeArquivo: string
  mimeType: string
  tamanhoBytes: number
  /** Callback quando o upload concluir — atualiza os 4 campos do state. */
  onChange: (next: {
    storagePath: string
    nomeArquivo: string
    mimeType: string
    tamanhoBytes: number
  }) => void
  /** Flag visual quando o validador detectou ausência (mostra borda destrutiva). */
  error?: string
}

/** Formata bytes em KB/MB pra UI compacta. */
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function ComprovanteCobrancaUpload({
  storagePath,
  nomeArquivo,
  mimeType,
  tamanhoBytes,
  onChange,
  error,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPendingUpload, startUpload] = useTransition()
  const [isPendingOpen, startOpen] = useTransition()
  const [dragOver, setDragOver] = useState(false)

  const temComprovante = !!storagePath

  function processarArquivo(file: File) {
    if (file.size > MAX_ANEXO_BYTES) {
      toast.error(
        `Arquivo excede ${Math.round(MAX_ANEXO_BYTES / 1024 / 1024)} MB.`,
      )
      return
    }
    if (
      !MIMES_ACEITOS.includes(file.type as (typeof MIMES_ACEITOS)[number])
    ) {
      toast.error("Tipo de arquivo não suportado. Use PDF ou imagem.")
      return
    }
    const fd = new FormData()
    fd.append("file", file)
    startUpload(async () => {
      // Se já havia comprovante, agenda exclusão best-effort do antigo
      const pathAntigo = storagePath
      const r = await uploadComprovanteCobranca(fd)
      if (!r.ok) {
        toast.error(r.error ?? "Falha no upload.")
        return
      }
      if (!r.data) {
        toast.error("Falha no upload.")
        return
      }
      onChange({
        storagePath: r.data.storagePath,
        nomeArquivo: r.data.nomeArquivo,
        mimeType: r.data.mimeType,
        tamanhoBytes: r.data.tamanhoBytes,
      })
      if (pathAntigo) {
        // Limpa o arquivo antigo sem bloquear o fluxo
        excluirComprovante(pathAntigo).catch(() => null)
      }
      toast.success("Comprovante enviado.")
    })
  }

  function onSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // reseta pra permitir re-upload do mesmo arquivo
    if (file) processarArquivo(file)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processarArquivo(file)
  }

  function abrirEmNovaAba() {
    if (!storagePath) return
    startOpen(async () => {
      const r = await obterUrlComprovante(storagePath)
      if (!r.ok) {
        toast.error(r.error ?? "Falha ao gerar URL.")
        return
      }
      if (!r.data) {
        toast.error("Falha ao gerar URL.")
        return
      }
      window.open(r.data.url, "_blank", "noopener,noreferrer")
    })
  }

  function remover() {
    const path = storagePath
    onChange({
      storagePath: "",
      nomeArquivo: "",
      mimeType: "",
      tamanhoBytes: 0,
    })
    if (path) {
      excluirComprovante(path).catch(() => null)
    }
  }

  const isPdf = mimeType === "application/pdf"
  const IconArquivo = isPdf ? FileText : ImageIcon

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
        Comprovante de pagamento *
      </p>
      {temComprovante ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-white/[0.02] px-3 py-2.5",
            error
              ? "border-destructive/40"
              : "border-nexus-bright/25",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-nexus-bright/30 bg-nexus-bright/[0.08]">
            <IconArquivo className="h-4 w-4 text-nexus-bright" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white" title={nomeArquivo}>
              {nomeArquivo}
            </p>
            <p className="text-[11px] text-white/45">
              {formatBytes(tamanhoBytes)} · {isPdf ? "PDF" : "Imagem"}
            </p>
          </div>
          <button
            type="button"
            onClick={abrirEmNovaAba}
            disabled={isPendingOpen}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] px-2.5 text-[11px] font-medium text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15 disabled:opacity-50"
          >
            {isPendingOpen ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            )}
            Abrir
          </button>
          <button
            type="button"
            onClick={remover}
            disabled={isPendingUpload}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/25 bg-rose-500/[0.08] text-rose-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/15 disabled:opacity-50"
            aria-label="Remover comprovante"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-[12px] transition-colors",
            error
              ? "border-destructive/50 bg-destructive/[0.04] text-destructive"
              : dragOver
                ? "border-nexus-bright/50 bg-nexus-bright/[0.06] text-nexus-bright"
                : "border-white/[0.12] bg-white/[0.02] text-white/55 hover:border-nexus-bright/30 hover:bg-nexus-bright/[0.04] hover:text-nexus-bright",
            isPendingUpload && "pointer-events-none opacity-60",
          )}
        >
          {isPendingUpload ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando comprovante…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Clique ou arraste o comprovante (PDF ou imagem, até 10 MB)
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-[11px] text-destructive">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={MIMES_ACEITOS.join(",")}
        className="hidden"
        onChange={onSelecionar}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Link de visualização — usado na Revisão e em superfícies read-only
// ─────────────────────────────────────────────────────────────────────────────

type LinkProps = {
  storagePath: string
  nomeArquivo: string
  mimeType: string
}

/** Botão compacto que abre o comprovante em nova aba via signed URL. */
export function RevisaoComprovanteLink({
  storagePath,
  nomeArquivo,
  mimeType,
}: LinkProps) {
  const [isPending, startTransition] = useTransition()
  const isPdf = mimeType === "application/pdf"
  const Icon = isPdf ? FileText : ImageIcon

  function abrir() {
    startTransition(async () => {
      const r = await obterUrlComprovante(storagePath)
      if (!r.ok) {
        toast.error(r.error ?? "Falha ao gerar URL.")
        return
      }
      if (!r.data) {
        toast.error("Falha ao gerar URL.")
        return
      }
      window.open(r.data.url, "_blank", "noopener,noreferrer")
    })
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={isPending}
      className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[11px] text-nexus-bright hover:text-nexus-bright-soft hover:underline disabled:opacity-50"
      title={nomeArquivo}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : (
        <Icon className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">Abrir comprovante</span>
      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
    </button>
  )
}
