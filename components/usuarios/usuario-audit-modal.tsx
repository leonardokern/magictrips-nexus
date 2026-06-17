"use client"

import { useEffect, useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  getUsuarioAuditLogs,
  type AuditLogEntry,
} from "@/app/(dashboard)/usuarios/actions"
import { formatDataBrTz, formatDataHoraBr } from "@/lib/utils/formatters"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuario: {
    id: string
    nome: string
    iniciais: string | null
    foto_url?: string | null
    created_at: string
  }
}

const PAGE_SIZE = 10

const ACAO_LABEL: Record<string, string> = {
  login: "Entrou no sistema",
  criar: "Criou",
  editar: "Editou",
  cancelar: "Cancelou",
  aprovar: "Aprovou",
  ativar: "Ativou",
  inativar: "Inativou",
  excluir: "Excluiu",
  devolver: "Devolveu",
  submeter: "Submeteu",
}

const ENTIDADE_LABEL: Record<string, string> = {
  venda: "venda",
  cliente: "cliente",
  usuario: "usuário",
  perfil: "perfil",
  fornecedor: "fornecedor",
  proposta: "proposta",
  cartao: "cartão",
  origem_venda: "origem",
  comissao_regra: "regra de comissão",
}

function getNomeEntidade(log: AuditLogEntry): string | null {
  const snap = log.dados_depois ?? log.dados_antes
  if (!snap) return null
  if (log.entidade === "venda") {
    const id = snap.identificador
    return typeof id === "string" ? id : null
  }
  const nome = snap.nome
  return typeof nome === "string" && nome.trim() ? nome.trim() : null
}

// Antes este componente fazia `new Date(iso).getHours()`, que retorna
// a hora no fuso onde o código roda. Em Server Components hidratados
// numa Vercel UTC isso mostrava horário 3h adiantado para usuários no
// Brasil. Usar o helper central com `timeZone: America/Sao_Paulo` garante
// resultado idêntico em server e client.
function formatDateTime(iso: string): string {
  return formatDataHoraBr(iso)
}

function formatDateOnly(iso: string): string {
  return formatDataBrTz(iso)
}

export function UsuarioAuditModal({ open, onOpenChange, usuario }: Props) {
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (!open) {
      setPage(1)
      setLogs([])
      setTotal(0)
      return
    }
    startTransition(async () => {
      const r = await getUsuarioAuditLogs(usuario.id, 1)
      if (r.ok && r.data) {
        setLogs(r.data.logs)
        setTotal(r.data.total)
      }
    })
  }, [open, usuario.id])

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return
    setPage(p)
    startTransition(async () => {
      const r = await getUsuarioAuditLogs(usuario.id, p)
      if (r.ok && r.data) {
        setLogs(r.data.logs)
        setTotal(r.data.total)
      }
    })
  }

  const iniciais = usuario.iniciais ?? usuario.nome.charAt(0).toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-xl flex-col gap-0 overflow-hidden p-0">
        {/* Header sticky */}
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-white/80">
              {usuario.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={usuario.foto_url}
                  alt={usuario.nome}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                iniciais
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold text-white">
                {usuario.nome}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-white/45">
                Membro desde {formatDateOnly(usuario.created_at)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Subheader com contagem */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/[0.04] bg-white/[0.015] px-6 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/45">
            <ScrollText className="h-3.5 w-3.5" />
            Log de ações
          </span>
          {!isPending && (
            <span className="text-[11px] text-white/40">
              {total} {total === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        {/* Body scrollável */}
        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner className="text-nexus-bright" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <ScrollText className="h-7 w-7 text-white/20" />
              <p className="text-sm text-white/40">Nenhum log registrado.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {logs.map((log) => {
                const acaoLabel = ACAO_LABEL[log.acao] ?? log.acao
                const entidadeLabel = ENTIDADE_LABEL[log.entidade] ?? log.entidade
                const nomeEntidade = getNomeEntidade(log)
                return (
                  <li key={log.id} className="flex items-start gap-3 px-6 py-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-nexus-bright/60" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/85">
                        <span className="font-medium">{acaoLabel}</span>
                        {log.acao !== "login" && (
                          <>
                            {" "}
                            <span className="text-white/55">{entidadeLabel}</span>
                            {nomeEntidade ? (
                              <span className="ml-1 font-medium text-white/75">
                                {nomeEntidade}
                              </span>
                            ) : log.entidade_id ? (
                              <span className="ml-1 font-mono text-[11px] text-white/30">
                                #{log.entidade_id.slice(0, 8)}
                              </span>
                            ) : null}
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/35">
                        {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer com paginação */}
        <DialogFooter className="shrink-0 items-center justify-between border-t border-white/[0.06] bg-card/95 px-6 py-3 backdrop-blur">
          {totalPages > 1 ? (
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-white/40">
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || isPending}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || isPending}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div />
          )}
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className={totalPages > 1 ? "ml-4 shrink-0" : "w-full"}>
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
