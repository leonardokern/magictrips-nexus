"use client"

import { useFormState, useFormStatus } from "react-dom"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowLeft, CheckCircle2, Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  loginAction,
  esquecerSenhaAction,
  type LoginState,
  type EsqueciSenhaState,
} from "./actions"

// ── Submit buttons ────────────────────────────────────────────────────────────

function LoginSubmitButton() {
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

function EsqueciSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="h-11 w-full bg-white text-neutral-950 hover:bg-white/90 disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Enviando..." : "Enviar instruções"}
    </Button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

type View = "login" | "esqueci"

type Props = {
  avisoInativo?: boolean
}

export function LoginForm({ avisoInativo }: Props) {
  const [view, setView] = useState<View>("login")
  const [loginState, loginFormAction] = useFormState(loginAction, {} as LoginState)
  const [esqueciState, esqueciFormAction] = useFormState(esquecerSenhaAction, {} as EsqueciSenhaState)

  return (
    <AnimatePresence mode="wait">
      {view === "login" ? (
        <motion.form
          key="login"
          action={loginFormAction}
          className="space-y-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {avisoInativo && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Seu acesso está inativo. Fale com o administrador.
            </div>
          )}

          {loginState?.error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {loginState.error}
            </div>
          )}

          {/* E-mail */}
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

          {/* Senha */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="senha" className="text-xs font-medium uppercase tracking-wider text-white/70">
                Senha
              </Label>
              <button
                type="button"
                onClick={() => setView("esqueci")}
                className="text-[11px] text-white/45 transition-colors hover:text-nexus-bright"
              >
                Esqueci minha senha
              </button>
            </div>
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
            <LoginSubmitButton />
          </div>
        </motion.form>
      ) : (
        /* ── Vista: Esqueci minha senha ───────────────────────────────── */
        <motion.div
          key="esqueci"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {esqueciState?.success ? (
            /* Sucesso */
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-white">Instruções enviadas</p>
                <p className="text-sm leading-relaxed text-white/60">
                  Se o e-mail estiver cadastrado no sistema, você receberá as instruções de
                  redefinição em instantes. Verifique também a caixa de spam.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView("login")}
                className="flex w-full items-center justify-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para o login
              </button>
            </div>
          ) : (
            /* Formulário */
            <form action={esqueciFormAction} className="space-y-4">
              <div className="mb-5 space-y-1">
                <p className="text-sm font-semibold text-white">Redefinir senha</p>
                <p className="text-xs leading-relaxed text-white/55">
                  Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
                </p>
              </div>

              {esqueciState?.error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {esqueciState.error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email-esqueci" className="text-xs font-medium uppercase tracking-wider text-white/70">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    id="email-esqueci"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    placeholder="seu@email.com"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
              </div>

              <div className="pt-1">
                <EsqueciSubmitButton />
              </div>

              <button
                type="button"
                onClick={() => setView("login")}
                className="flex w-full items-center justify-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para o login
              </button>
            </form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
