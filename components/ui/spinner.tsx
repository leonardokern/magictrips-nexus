import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Tamanho em rem-equivalente Tailwind. Default `h-4 w-4`. */
  size?: "xs" | "sm" | "md" | "lg"
}

const sizeMap: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
}

/**
 * Spinner inline pra botões/inputs/etc.
 * Usa Loader2 do lucide com animação `animate-spin`. Cor = currentColor.
 * Pra loader grande de tela cheia/modal use `LottieLoader`.
 */
export function Spinner({ className, size = "sm" }: Props) {
  return (
    <Loader2
      className={cn("animate-spin", sizeMap[size], className)}
      aria-hidden="true"
    />
  )
}
