"use client"

import { useFormState, useFormStatus } from "react-dom"
import { useState } from "react"
import { motion } from "motion/react"
import { Check, Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { redefinirSenhaAction, type RedefinirSenhaState } from "./actions"

const initial: RedefinirSenhaState = {}

type Req = { label: string; ok: boolean }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="h-11 w-full bg-white text-neutral-950 hover:bg-white/90 disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Salvando..." : "Definir nova senha"}
    </Button>
  )
}

export function RedefinirSenhaForm() {
  const [state, formAction] = useFormState(redefinirSenhaAction, initial)
  const [nova, setNova]       = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [showNova, setShowNova]   = useState(false)
  const [showConf, setShowConf]   = useState(false)

  const reqs: Req[] = [
    { label: "Mínimo 6 caracteres",    ok: nova.length >= 6 },
    { label: "Letra maiúscula",         ok: /[A-Z]/.test(nova) },
    { label: "Letra minúscula",         ok: /[a-z]/.test(nova) },
    { label: "Número",                  ok: /[0-9]/.test(nova) },
    { label: "Caractere especial",      ok: /[^A-Za-z0-9]/.test(nova) },
  ]

  return (
    <motion.form
      action={formAction}
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {state?.error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </div>
      )}

      {/* Nova senha */}
      <div className="space-y-2">
        <Label htmlFor="nova_senha" className="text-xs font-medium uppercase tracking-wider text-white/70">
          Nova senha
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id="nova_senha"
            name="nova_senha"
            type={showNova ? "text" : "password"}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            autoComplete="new-password"
            required
            placeholder="••••••••"
            className="h-11 w-full rounded-md border border-white/10 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowNova((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
          >
            {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state?.fieldErrors?.nova_senha && (
          <p className="text-xs text-red-300">{state.fieldErrors.nova_senha}</p>
        )}

        {/* Checklist de requisitos */}
        {nova.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
            {reqs.map((r) => (
              <span
                key={r.label}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] transition-colors",
                  r.ok ? "text-emerald-400" : "text-white/35",
                )}
              >
                <span className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                  r.ok
                    ? "border-emerald-500/50 bg-emerald-500/15"
                    : "border-white/15 bg-white/[0.03]",
                )}>
                  {r.ok && <Check className="h-2 w-2 text-emerald-400" strokeWidth={3} />}
                </span>
                {r.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Confirmar senha */}
      <div className="space-y-2">
        <Label htmlFor="confirmar_senha" className="text-xs font-medium uppercase tracking-wider text-white/70">
          Confirmar nova senha
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id="confirmar_senha"
            name="confirmar_senha"
            type={showConf ? "text" : "password"}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            required
            placeholder="••••••••"
            className={cn(
              "h-11 w-full rounded-md border bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:outline-none focus:ring-1 focus:ring-white/20",
              confirmar.length > 0 && nova !== confirmar
                ? "border-red-500/40 focus:border-red-400/60"
                : "border-white/10 focus:border-white/30 focus:bg-white/[0.08]",
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowConf((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
          >
            {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state?.fieldErrors?.confirmar_senha && (
          <p className="text-xs text-red-300">{state.fieldErrors.confirmar_senha}</p>
        )}
        {confirmar.length > 0 && nova !== confirmar && !state?.fieldErrors?.confirmar_senha && (
          <p className="text-xs text-red-300/80">As senhas não coincidem.</p>
        )}
      </div>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </motion.form>
  )
}
