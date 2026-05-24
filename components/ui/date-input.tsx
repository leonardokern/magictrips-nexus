"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "./input"
import { cn } from "@/lib/utils"

type Props = {
  value: string // ISO YYYY-MM-DD ou ""
  onChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Converte ISO (YYYY-MM-DD) → display (DD/MM/AAAA). */
function isoToDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return ""
  return `${d}/${m}/${y}`
}

/** Converte display completo (DD/MM/YYYY) → ISO, ou null se inválido. */
function displayToIso(display: string): string | null {
  if (display.length !== 10) return null
  const [d, m, y] = display.split("/")
  if (!d || !m || !y || y.length !== 4) return null
  const nd = Number(d), nm = Number(m), ny = Number(y)
  if (!nd || !nm || !ny) return null
  // Valida via Date para pegar casos como 31/02
  const date = new Date(ny, nm - 1, nd)
  if (
    date.getFullYear() !== ny ||
    date.getMonth() + 1 !== nm ||
    date.getDate() !== nd
  ) return null
  return `${y}-${m}-${d}`
}

/** Aplica máscara DD/MM/AAAA a partir do que o usuário digitou. */
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled,
  className,
}: Props) {
  const [display, setDisplay] = useState(() => isoToDisplay(value))
  const prevIso = useRef(value)

  // Sincroniza quando o prop muda externamente (ex: reset do form)
  useEffect(() => {
    if (value !== prevIso.current) {
      prevIso.current = value
      setDisplay(isoToDisplay(value))
    }
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value)
    setDisplay(masked)
    const iso = displayToIso(masked) ?? ""
    prevIso.current = iso
    onChange(iso)
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={10}
      disabled={disabled}
      className={cn("tabular-nums", className)}
    />
  )
}
