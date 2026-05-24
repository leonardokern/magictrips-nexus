import { LottieLoader } from "@/components/ui/lottie-loader"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Texto opcional embaixo do loader. */
  label?: string
}

/**
 * Loader pra renderizar dentro do corpo de um Dialog/Modal enquanto o conteúdo
 * remoto é carregado. Centra o LottieLoader e dá altura mínima pra não colapsar.
 */
export function ModalLoader({ className, label = "Carregando…" }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-3 py-8",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <LottieLoader className="h-20 w-20" />
      <span className="text-xs text-white/55">{label}</span>
    </div>
  )
}
