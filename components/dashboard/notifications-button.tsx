"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import { dispensarLembrete } from "@/app/(dashboard)/notificacoes/actions"
import { createClient } from "@/lib/supabase/client"

export type LembreteItem = {
  id: string
  tipo: string
  mensagem: string
  referencia_tipo: string | null
  referencia_id: string | null
  data_lembrete: string
}

type Props = {
  lembretes: LembreteItem[]
  /** ID do usuário logado — usado pra filtrar a subscription do realtime. */
  userId: string
}

const TIPO_ICONE: Record<string, React.ReactNode> = {
  venda_pendente_validacao: <ShoppingCart className="h-3.5 w-3.5" />,
  venda_aprovada: <CheckCircle2 className="h-3.5 w-3.5" />,
  venda_em_revisao: <AlertTriangle className="h-3.5 w-3.5" />,
  agenda_compartilhada: <CalendarDays className="h-3.5 w-3.5" />,
}

const TIPO_LABEL: Record<string, string> = {
  venda_pendente_validacao: "Venda aguardando aprovação",
  venda_aprovada: "Venda aprovada",
  venda_em_revisao: "Venda devolvida para revisão",
  agenda_compartilhada: "Evento compartilhado com você",
}

const TIPO_ACCENT: Record<string, string> = {
  venda_aprovada:
    "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  venda_em_revisao:
    "border-orange-400/30 bg-orange-400/10 text-orange-300",
  agenda_compartilhada:
    "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright",
}

export function NotificationsButton({ lembretes: initialLembretes, userId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [lembretes, setLembretes] = useState<LembreteItem[]>(initialLembretes)
  const [novoChegou, setNovoChegou] = useState(false)

  // Sincroniza quando a prop muda (ex: router.refresh ou navegação)
  useEffect(() => {
    setLembretes(initialLembretes)
  }, [initialLembretes])

  // Subscription Supabase Realtime: INSERTs e UPDATEs em `lembretes`
  // do usuário logado. Quando chega um novo INSERT, prepend no state;
  // quando UPDATE muda status pra dispensado, remove da lista.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`lembretes:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lembretes",
          filter: `destinatario_id=eq.${userId}`,
        },
        (payload) => {
          const novo = payload.new as {
            id: string
            tipo: string
            mensagem: string
            referencia_tipo: string | null
            referencia_id: string | null
            data_lembrete: string
            status: string
          }
          if (novo.status !== "pendente") return
          setLembretes((prev) => {
            if (prev.some((l) => l.id === novo.id)) return prev
            return [
              {
                id: novo.id,
                tipo: novo.tipo,
                mensagem: novo.mensagem,
                referencia_tipo: novo.referencia_tipo,
                referencia_id: novo.referencia_id,
                data_lembrete: novo.data_lembrete,
              },
              ...prev,
            ]
          })
          // Pulso visual no sino quando chega um novo
          setNovoChegou(true)
          window.setTimeout(() => setNovoChegou(false), 1500)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lembretes",
          filter: `destinatario_id=eq.${userId}`,
        },
        (payload) => {
          const upd = payload.new as { id: string; status: string }
          if (upd.status !== "pendente") {
            setLembretes((prev) => prev.filter((l) => l.id !== upd.id))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const hasUnread = lembretes.length > 0

  function abrirReferencia(l: LembreteItem) {
    if (l.referencia_tipo === "venda" && l.referencia_id) {
      // Remove otimisticamente, dispensa no servidor e navega.
      setLembretes((prev) => prev.filter((x) => x.id !== l.id))
      setOpen(false)
      startTransition(async () => {
        await dispensarLembrete(l.id)
        router.push(`/vendas?venda=${l.referencia_id}`)
      })
      return
    }
    if (l.referencia_tipo === "agenda" && l.referencia_id) {
      setLembretes((prev) => prev.filter((x) => x.id !== l.id))
      setOpen(false)
      startTransition(async () => {
        await dispensarLembrete(l.id)
        router.push(`/agenda?evento=${l.referencia_id}`)
      })
      return
    }
  }

  function dispensar(l: LembreteItem, e: React.MouseEvent) {
    e.stopPropagation()
    // Otimista: remove na hora, sem esperar o servidor.
    setLembretes((prev) => prev.filter((x) => x.id !== l.id))
    startTransition(async () => {
      await dispensarLembrete(l.id)
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-label="Notificações"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white",
          // Pulsa em loop enquanto houver notificação pendente, pra chamar atenção
          hasUnread
            ? "animate-[bell-pulse_2s_ease-in-out_infinite] border-nexus-bright/40 text-nexus-bright"
            : "border-white/[0.08]",
          novoChegou && "ring-2 ring-nexus-bright/60",
        )}
      >
        {/* Halo radial em loop quando tem pendente */}
        {hasUnread && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-nexus-bright/20 animate-ping"
          />
        )}
        <Bell
          className={cn(
            "relative h-4 w-4 transition-transform",
            hasUnread && "animate-[bell-shake_2.4s_ease-in-out_infinite]",
            novoChegou && "animate-[wiggle_0.6s_ease-in-out]",
          )}
        />
        {hasUnread && (
          <span className="absolute -right-1 -top-1 flex">
            <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-red-500/70" />
            <span
              className={cn(
                "relative inline-flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white tabular-nums ring-2 ring-background",
                lembretes.length > 9 ? "h-5 min-w-[1.25rem] px-1" : "h-4 w-4",
              )}
              aria-label={`${lembretes.length} notificações pendentes`}
            >
              {lembretes.length > 99 ? "99+" : lembretes.length}
            </span>
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-white/[0.08] bg-card/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <p className="text-sm font-medium text-white">Notificações</p>
              <span className="text-[10px] uppercase tracking-wider text-white/45">
                {lembretes.length}{" "}
                {lembretes.length === 1 ? "pendente" : "pendentes"}
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {lembretes.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-white/45">
                  Nada novo por aqui. Você está em dia.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {lembretes.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => abrirReferencia(l)}
                        disabled={isPending}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                            TIPO_ACCENT[l.tipo] ??
                              "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright",
                          )}
                        >
                          {TIPO_ICONE[l.tipo] ?? <Bell className="h-3.5 w-3.5" />}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">
                            {TIPO_LABEL[l.tipo] ?? l.tipo}
                          </p>
                          <p className="mt-0.5 text-xs text-white/55">
                            {l.mensagem}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => dispensar(l, e)}
                          className="shrink-0 text-[10px] uppercase tracking-wider text-white/40 hover:text-white"
                        >
                          ✕
                        </button>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
