"use client"

import { useState } from "react"
import { Check, Copy, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  open: boolean
  onClose: () => void
  senha: string
  /** Texto contextual: "criado" ou "tem nova senha" */
  contexto: "criar" | "resetar"
  /** Nome do usuário pra exibir */
  nome?: string
}

export function SenhaProvisoriaDialog({
  open,
  onClose,
  senha,
  contexto,
  nome,
}: Props) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(senha)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contexto === "criar"
              ? `Usuário criado${nome ? ` — ${nome}` : ""}`
              : `Senha redefinida${nome ? ` — ${nome}` : ""}`}
          </DialogTitle>
          <DialogDescription>
            Copie a senha provisória e envie ao usuário pelo canal de sua
            preferência. No primeiro login ele será obrigado a trocá-la.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Esta senha não será mostrada novamente.
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2.5">
            <code className="flex-1 font-mono text-sm tracking-wider text-white">
              {senha}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copiar}
              className="h-7 px-2 text-white/60 hover:bg-white/[0.06] hover:text-white"
            >
              {copiado ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="bg-indigo-500 text-white hover:bg-indigo-400"
          >
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
