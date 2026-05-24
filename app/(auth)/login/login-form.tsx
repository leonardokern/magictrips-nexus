"use client"

import { useFormState, useFormStatus } from "react-dom"
import { motion } from "motion/react"
import { Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { loginAction, type LoginState } from "./actions"

const initialState: LoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="h-11 w-full bg-white text-neutral-950 hover:bg-white/90 disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  )
}

type Props = {
  avisoInativo?: boolean
}

export function LoginForm({ avisoInativo }: Props) {
  const [state, formAction] = useFormState(loginAction, initialState)

  return (
    <motion.form
      action={formAction}
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {avisoInativo && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          Seu acesso está inativo. Fale com o administrador.
        </div>
      )}

      {state?.error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-white/70">
          E-mail
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="seu@email.com"
            className="h-11 w-full rounded-md border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha" className="text-xs font-medium uppercase tracking-wider text-white/70">
          Senha
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 w-full rounded-md border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </motion.form>
  )
}
