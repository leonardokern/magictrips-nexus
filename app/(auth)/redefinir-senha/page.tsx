import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { BeamsBackground } from "@/components/ui/beams-background"
import { createClient } from "@/lib/supabase/server"
import { RedefinirSenhaForm } from "./redefinir-senha-form"

export const metadata: Metadata = {
  title: "Redefinir senha — Nexus",
}

export default async function RedefinirSenhaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sem sessão de recovery: redireciona para login
  if (!user) redirect("/login?erro=sessao-expirada")

  return (
    <BeamsBackground intensity="medium" className="flex min-h-screen items-center justify-center">
      <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <Image
            src="/brand/nexus-logo.png"
            alt="Nexus — Magic Trips"
            width={384}
            height={384}
            priority
            className="h-52 w-52 select-none object-contain drop-shadow-[0_8px_32px_rgba(20,152,213,0.25)]"
          />

          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-md">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Redefinir senha
              </h1>
              <p className="text-sm text-white/60">
                Crie uma nova senha para acessar o Nexus.
              </p>
            </div>

            <RedefinirSenhaForm />
          </div>
        </div>
      </div>
    </BeamsBackground>
  )
}
