"use client"

import Image from "next/image"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Empresa = {
  id: string
  nome: string
  slug: string
}

type Props = {
  empresas: Empresa[]
  selecionadas: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  /** Quando true, clicar numa empresa substitui a seleção (radio-style). */
  singleSelect?: boolean
}

// Mapeia o slug da empresa para o logo correspondente em public/brand
const EMPRESA_LOGO: Record<string, { src: string; bg: string; ring: string }> = {
  "magic-trips": {
    src: "/brand/magic-trips-white.png",
    bg: "from-nexus-deep/15 to-nexus-deep/5",
    ring: "ring-nexus-deep/40",
  },
  "del-mondo": {
    src: "/brand/del-mondo-white.png",
    bg: "from-nexus-bright/15 to-nexus-bright/5",
    ring: "ring-nexus-bright/40",
  },
}

const DEFAULT_LOGO = {
  src: "/brand/nexus-icon.png",
  bg: "from-white/[0.06] to-white/[0.02]",
  ring: "ring-white/30",
}

export function EmpresaSelector({
  empresas,
  selecionadas,
  onChange,
  disabled,
  singleSelect,
}: Props) {
  function toggle(id: string) {
    if (disabled) return
    if (singleSelect) {
      // Comportamento radio: clicar numa não-selecionada substitui;
      // clicar na selecionada não faz nada (sempre precisa ter 1).
      if (selecionadas[0] !== id) onChange([id])
      return
    }
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((x) => x !== id))
    } else {
      onChange([...selecionadas, id])
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {empresas.map((empresa) => {
        const isOn = selecionadas.includes(empresa.id)
        const cfg = EMPRESA_LOGO[empresa.slug] ?? DEFAULT_LOGO
        return (
          <button
            key={empresa.id}
            type="button"
            onClick={() => toggle(empresa.id)}
            disabled={disabled}
            aria-pressed={isOn}
            className={cn(
              "group relative flex h-20 items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-br transition-all",
              isOn
                ? `border-transparent ring-2 ${cfg.ring} ${cfg.bg} opacity-100`
                : "border-white/10 bg-white/[0.02] opacity-50 hover:border-white/20 hover:opacity-80",
              disabled && "cursor-not-allowed",
            )}
          >
            <Image
              src={cfg.src}
              alt={empresa.nome}
              width={400}
              height={160}
              className={cn(
                "h-full w-full select-none object-contain transition-transform",
                isOn ? "scale-150" : "scale-[1.42] grayscale",
              )}
            />

            {/* Check indicator no canto */}
            {isOn && (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-lg"
              >
                <Check className="h-2.5 w-2.5 text-neutral-950" strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
