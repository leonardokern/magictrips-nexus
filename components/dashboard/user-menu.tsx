"use client"

type Props = {
  nome: string
  iniciais: string | null
  foto_url?: string | null
  /** Mantido na assinatura por compatibilidade — não é mais exibido. */
  email?: string
  perfil: string
}

export function UserMenu({ nome, iniciais, foto_url, perfil }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden flex-col items-end text-right text-xs leading-tight sm:flex">
        <span className="font-medium text-white">{nome}</span>
        <span className="mt-1 text-white/45">{perfil}</span>
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06] text-xs font-semibold text-white">
        {foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto_url}
            alt={nome}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          iniciais ?? nome.charAt(0).toUpperCase()
        )}
      </div>
    </div>
  )
}
