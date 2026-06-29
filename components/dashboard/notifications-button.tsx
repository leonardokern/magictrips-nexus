"use client"

import { useEffect, useState, useTransition } from "react"
import { AlertTriangle, Bell, CalendarDays, CheckCheck, CheckCircle2, ShoppingCart, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  dispensarLembrete,
  dispensarTodosLembretes,
} from "@/app/(dashboard)/notificacoes/actions"
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
  venda_excluida: <Trash2 className="h-3.5 w-3.5" />,
  agenda_compartilhada: <CalendarDays className="h-3.5 w-3.5" />,
}

const TIPO_LABEL: Record<string, string> = {
  venda_pendente_validacao: "Venda aguardando aprovação",
  venda_aprovada: "Venda aprovada",
  venda_em_revisao: "Venda devolvida para revisão",
  venda_excluida: "Venda excluída",
  agenda_compartilhada: "Evento compartilhado com você",
}

const TIPO_ACCENT: Record<string, string> = {
  venda_aprovada:
    "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  venda_em_revisao:
    "border-orange-400/30 bg-orange-400/10 text-orange-300",
  venda_excluida:
    "border-rose-400/30 bg-rose-400/10 text-rose-300",
  agenda_compartilhada:
    "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright",
}

export function NotificationsButton({ lembretes: initialLembretes, userId }: Props) {
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

  function dispensar(l: LembreteItem) {
    // Otimista: remove na hora, sem esperar o servidor.
    setLembretes((prev) => prev.filter((x) => x.id !== l.id))
    startTransition(async () => {
      await dispensarLembrete(l.id)
    })
  }

  function dispensarTodos() {
    // Otimista: zera a lista imediatamente.
    setLembretes([])
    startTransition(async () => {
      await dispensarTodosLembretes()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-label="Notificações"
        className={cn(
          // Mobile: círculo h-9 w-9
          "flex h-9 w-9 items-center justify-center rounded-full border bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white",
          // Desktop: card retangular com mesma altura do UserMenu (py-2 + h-9 = ~52px)
          "md:h-auto md:w-auto md:rounded-xl md:border-white/[0.06] md:bg-white/[0.02] md:px-3 md:py-2",
          hasUnread
            ? "animate-[bell-pulse_2s_ease-in-out_infinite] border-nexus-bright/40 text-nexus-bright md:border-nexus-bright/40"
            : "border-white/[0.08]",
          novoChegou && "ring-2 ring-nexus-bright/60",
        )}
      >
        {/* Wrapper interno mantém área fixa h-9 w-9 em todos os tamanhos */}
        <span className="relative flex h-9 w-9 items-center justify-center">
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
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Dropdown: top-full + mt-2 = sempre grudado abaixo do botão */}
          <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-white/[0.08] bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-xl">

            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-white/60" />
                <p className="text-sm font-semibold text-white">Notificações</p>
              </div>
              {lembretes.length > 0 && (
                <button
                  type="button"
                  onClick={dispensarTodos}
                  disabled={isPending}
                  title="Marcar tudo como lido"
                  aria-label="Marcar tudo como lido"
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[10px] font-medium text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  Tudo lido
                </button>
              )}
            </div>

            <div className="border-t border-white/[0.06]" />

            {/* Lista — itens são read-only por ora (sem clique pra abrir
                referência); só o "X" individual + "Marcar tudo como lido"
                no header permitem dispensar. */}
            <div className="max-h-[400px] overflow-y-auto">
              {lembretes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-white/30">
                    <Bell className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-white/40">Nada novo por aqui.</p>
                  <p className="text-xs text-white/25">Você está em dia ✓</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {lembretes.map((l) => (
                    <li
                      key={l.id}
                      className="group flex items-start gap-3 px-4 py-3.5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          TIPO_ACCENT[l.tipo] ??
                            "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright",
                        )}
                      >
                        {TIPO_ICONE[l.tipo] ?? <Bell className="h-3.5 w-3.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white leading-snug">
                          {TIPO_LABEL[l.tipo] ?? l.tipo}
                        </p>
                        <p className="mt-0.5 text-xs text-white/50 leading-snug line-clamp-2">
                          {l.mensagem}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dispensar(l)}
                        disabled={isPending}
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-white/30 opacity-0 transition-all hover:bg-white/[0.06] hover:text-white/70 group-hover:opacity-100 disabled:opacity-30"
                        aria-label="Dispensar"
                      >
                        <span className="text-xs">✕</span>
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
