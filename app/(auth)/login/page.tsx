import type { Metadata } from "next"
import Image from "next/image"
import { BeamsBackground } from "@/components/ui/beams-background"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar",
}

type Props = {
  searchParams: Promise<{ erro?: string; aviso?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { erro, aviso } = await searchParams

  return (
    <BeamsBackground intensity="medium" className="flex min-h-screen items-center justify-center">
      <div className="flex min-h-screen flex-col items-center justify-between px-4 py-10">
        {/* spacer top */}
        <div aria-hidden className="hidden md:block md:h-8" />

        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          {/* Logo principal Nexus (cores nativas das duas marcas combinadas) */}
          <div className="-mb-6 flex flex-col items-center">
            <Image
              src="/brand/nexus-logo.png"
              alt="Nexus — Magic Trips"
              width={512}
              height={512}
              priority
              className="h-44 w-44 select-none object-contain [filter:brightness(0)_invert(1)_drop-shadow(0_8px_40px_rgba(20,152,213,0.35))] md:h-72 md:w-72"
            />
          </div>

          {/* Card glass */}
          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-md">
            <div className="mb-6 space-y-1.5 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Bem-vindo(a)
              </h1>
              <p className="text-sm text-white/60">
                Entre com suas credenciais para acessar o sistema.
              </p>
            </div>

            {aviso === "senha-redefinida" && (
              <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                Senha redefinida com sucesso! Faça login com a nova senha.
              </div>
            )}
            {erro === "sessao-expirada" && (
              <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                O link expirou. Solicite um novo link de redefinição.
              </div>
            )}
            {erro === "link-invalido" && (
              <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                Link inválido ou expirado. Solicite um novo link.
              </div>
            )}
            <LoginForm avisoInativo={erro === "inativo"} />
          </div>
        </div>

        {/* Footer com logo da empresa */}
        <footer className="mt-8 flex w-full max-w-2xl flex-col items-center gap-5 pt-4">
          <Image
            src="/brand/magic-trips-white.png"
            alt="Magic Trips"
            width={448}
            height={168}
            className="h-32 w-auto select-none object-contain opacity-80 transition-opacity hover:opacity-100"
          />
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            Plataforma interna
          </p>
        </footer>
      </div>
    </BeamsBackground>
  )
}
