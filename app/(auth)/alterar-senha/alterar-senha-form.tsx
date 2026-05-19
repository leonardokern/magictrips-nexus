"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Lock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { alterarMinhaSenha } from "@/app/(dashboard)/usuarios/actions"

export function AlterarSenhaForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    startTransition(async () => {
      const r = await alterarMinhaSenha({
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
        confirmar_senha: confirmarSenha,
      })

      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }

      toast.success("Senha alterada com sucesso.")
      router.push("/dashboard")
      router.refresh()
    })
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <PasswordField
        id="senha_atual"
        label="Senha atual"
        value={senhaAtual}
        onChange={setSenhaAtual}
        error={errors.senha_atual}
        autoComplete="current-password"
      />

      <PasswordField
        id="nova_senha"
        label="Nova senha"
        value={novaSenha}
        onChange={setNovaSenha}
        error={errors.nova_senha}
        autoComplete="new-password"
        hint="Mínimo 8 caracteres."
      />

      <PasswordField
        id="confirmar_senha"
        label="Confirmar nova senha"
        value={confirmarSenha}
        onChange={setConfirmarSenha}
        error={errors.confirmar_senha}
        autoComplete="new-password"
      />

      <div className="pt-2">
        <Button
          type="submit"
          className="h-11 w-full bg-white text-neutral-950 hover:bg-white/90 disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? "Alterando..." : "Alterar senha"}
        </Button>
      </div>
    </motion.form>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: string
  autoComplete?: string
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wider text-white/70"
      >
        {label}
      </Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          id={id}
          name={id}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          placeholder="••••••••"
          className="h-11 w-full rounded-md border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>
      {hint && !error && <p className="text-xs text-white/45">{hint}</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
