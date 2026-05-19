import type { Metadata } from "next"
import Image from "next/image"
import { BeamsBackground } from "@/components/ui/beams-background"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { AlterarSenhaForm } from "./alterar-senha-form"

export const metadata: Metadata = {
  title: "Alterar senha",
}

export default async function AlterarSenhaPage() {
  const user = await requireCurrentUser()

  return (
    <BeamsBackground intensity="medium" className="flex min-h-screen items-center justify-center">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <Image
            src="/brand/compass-logo.png"
            alt="Compass — Magic Trips"
            width={384}
            height={384}
            priority
            className="h-52 w-52 select-none object-contain"
            style={{ filter: "invert(1) brightness(1.4)" }}
          />

          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-md">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Alterar senha
              </h1>
              <p className="text-sm text-white/60">
                {user.forcePasswordChange
                  ? "Crie uma nova senha pessoal para continuar."
                  : "Atualize a sua senha."}
              </p>
            </div>
            <AlterarSenhaForm />
          </div>
        </div>
      </div>
    </BeamsBackground>
  )
}
