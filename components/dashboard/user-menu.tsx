"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { MeuPerfilModal } from "@/components/dashboard/meu-perfil-modal"

type Props = {
  userId: string
  nome: string
  iniciais: string | null
  foto_url?: string | null
  email?: string
  perfil: string
}

/** "Leonardo Kern Pereira" → "Leonardo K. P." */
function formatNomeAbreviado(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return partes[0] ?? ""
  const [primeiro, ...resto] = partes
  return `${primeiro} ${resto.map((p) => p.charAt(0).toUpperCase() + ".").join(" ")}`
}

export function UserMenu({ userId, nome, iniciais, foto_url, perfil }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop: botão com nome + avatar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar meu perfil"
        className="group hidden items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:border-nexus-bright/25 hover:bg-nexus-bright/[0.05] md:flex"
      >
        <div className="flex flex-col items-end text-right text-xs leading-tight">
          <span className="font-medium text-white">{nome}</span>
          <span className="mt-0.5 text-[10px] text-white/40">{perfil}</span>
        </div>
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06] text-xs font-semibold text-white transition-colors group-hover:border-nexus-bright/30">
            {foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto_url} alt={nome} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              iniciais ?? nome.charAt(0).toUpperCase()
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[hsl(195,30%,5%)] bg-nexus-bright">
            <Pencil className="h-2.5 w-2.5 text-white" />
          </span>
        </div>
      </button>

      {/* Mobile: avatar + nome abreviado */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar meu perfil"
        className="group flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 transition-all hover:border-nexus-bright/20 hover:bg-nexus-bright/[0.05] md:hidden"
      >
        <div className="relative shrink-0">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/[0.08] text-[10px] font-semibold text-white transition-colors group-hover:border-nexus-bright/50">
            {foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto_url} alt={nome} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              iniciais ?? nome.charAt(0).toUpperCase()
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[hsl(195,30%,5%)] bg-nexus-bright">
            <Pencil className="h-2 w-2 text-white" />
          </span>
        </div>
        <span className="text-xs font-medium text-white/70 transition-colors group-hover:text-white/90">
          {formatNomeAbreviado(nome)}
        </span>
      </button>

      <MeuPerfilModal
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        nome={nome}
        iniciais={iniciais ?? null}
        foto_url={foto_url ?? null}
      />
    </>
  )
}
