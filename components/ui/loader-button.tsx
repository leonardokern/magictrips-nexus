"use client"

import * as React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type Props = ButtonProps & {
  /** Estado de loading: bloqueia o clique e mostra spinner. */
  loading?: boolean
  /** Texto opcional pra mostrar ao lado do spinner em loading (default = mesmo children). */
  loadingText?: React.ReactNode
}

/**
 * Botão padrão pra ações assíncronas (salvar/criar/abrir-com-fetch/etc).
 * Mantém largura visualmente estável: substitui o ícone-líder (ou prefixa) por um spinner
 * e desabilita o clique. Não troca o texto por "Salvando…" — usa spinner pra economizar leitura.
 *
 * Pra usar com `useTransition`:
 *   <LoaderButton loading={isPending} onClick={() => startTransition(...)}>Salvar</LoaderButton>
 */
export const LoaderButton = React.forwardRef<HTMLButtonElement, Props>(
  function LoaderButton(
    { loading, loadingText, disabled, children, className, ...rest },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        disabled={loading || disabled}
        aria-busy={loading || undefined}
        className={cn(className)}
        {...rest}
      >
        {loading ? <Spinner /> : null}
        {loading && loadingText ? loadingText : children}
      </Button>
    )
  },
)
