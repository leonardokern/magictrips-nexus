"use client"

import { useState } from "react"
import { Check, Copy, Mail, MailX, ShieldAlert } from "lucide-react"
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
  /** Email pra exibir destinatário (quando enviou) */
  email?: string
  /** Status do envio do email de boas-vindas (undefined = não tentou) */
  emailEnviado?: boolean
  /** Mensagem de erro do envio (quando emailEnviado=false) */
  emailErro?: string
}

export function SenhaProvisoriaDialog({
  open,
  onClose,
  senha,
  contexto,
  nome,
  email,
  emailEnviado,
  emailErro,
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
            {emailEnviado
              ? "Um e-mail com as instruções de acesso foi enviado. A senha abaixo continua disponível como backup caso o e-mail não chegue."
              : "Copie a senha provisória e envie ao usuário pelo canal de sua preferência. No primeiro login ele será obrigado a trocá-la."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Status do envio do email */}
          {emailEnviado === true && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <Mail className="h-4 w-4 shrink-0" />
              <span>
                E-mail de boas-vindas enviado{email ? ` para ${email}` : ""}.
              </span>
            </div>
          )}
          {emailEnviado === false && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <MailX className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Falha ao enviar e-mail.</p>
                {emailErro && <p className="mt-0.5 text-rose-200/70">{emailErro}</p>}
                <p className="mt-0.5 text-rose-200/70">
                  Copie a senha abaixo e repasse manualmente.
                </p>
              </div>
            </div>
          )}

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
            className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
          >
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
