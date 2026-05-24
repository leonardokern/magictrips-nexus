"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "./input"
import { cn } from "@/lib/utils"

/** Converte string BRL ("2.382,06" ou "R$ 2.382,06") → número. */
export function parseBRL(str: string): number {
  if (!str) return 0
  const cleaned = str.replace(/[^\d,.]/g, "")
  if (!cleaned) return 0
  const n = parseFloat(cleaned.replace(/\./g, "").replace(",", "."))
  return isNaN(n) ? 0 : n
}

/** Formata número → string BRL ("2.382,06"). Retorna "" para zero/inválido. */
export function formatBRL(num: number): string {
  if (!num || num <= 0) return ""
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/** Trata dígitos como centavos e formata: "123456" → "1.234,56" */
function centsToFormatted(digits: string): string {
  if (!digits) return ""
  const cents = parseInt(digits, 10)
  if (!cents) return ""
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

type Props = {
  value: string // string BRL ("2.382,06") ou ""
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
  disabled,
  className,
}: Props) {
  const [display, setDisplay] = useState(() => formatBRL(parseBRL(value)))
  const prevValue = useRef(value)

  // Sincroniza quando o prop muda externamente (ex: reset do form)
  useEffect(() => {
    if (value === prevValue.current) return
    prevValue.current = value
    setDisplay(formatBRL(parseBRL(value)))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "")
    const formatted = centsToFormatted(digits)
    setDisplay(formatted)
    prevValue.current = formatted
    onChange(formatted)
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <span className="pointer-events-none absolute left-3 select-none text-sm text-white/40">
        R$
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9"
      />
    </div>
  )
}
