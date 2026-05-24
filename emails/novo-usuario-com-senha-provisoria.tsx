import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout } from "./_layout"

type Props = {
  nome: string
  email: string
  senhaProvisoria: string
  appUrl: string
  criadoPor?: string
}

/**
 * Email enviado quando o admin cria usuário com a flag "forçar troca de senha".
 * Inclui a senha provisória em plain — é uma senha **descartável** que será
 * trocada obrigatoriamente no primeiro acesso.
 */
export default function NovoUsuarioComSenhaProvisoria({
  nome,
  email,
  senhaProvisoria,
  appUrl,
  criadoPor,
}: Props) {
  return (
    <EmailLayout preview={`Bem-vindo ao Nexus, ${nome}`}>
      <Heading className="m-0 text-xl font-semibold text-white">
        Bem-vindo ao Nexus, {nome.split(" ")[0]}
      </Heading>
      <Text className="mt-2 text-sm leading-relaxed text-white/75">
        Sua conta foi criada{criadoPor ? ` por ${criadoPor}` : ""}. Use as
        credenciais abaixo no primeiro acesso. Você precisará{" "}
        <strong className="text-white">definir uma nova senha</strong> antes de
        usar o sistema.
      </Text>

      {/* Credenciais — card destacado */}
      <Section className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <Text className="m-0 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
          Seu e-mail de acesso
        </Text>
        <Text className="m-0 mt-1 font-mono text-base text-white">
          {email}
        </Text>

        <Text className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
          Senha provisória
        </Text>
        <Text className="m-0 mt-1 font-mono text-base tracking-wider text-[#1498D5]">
          {senhaProvisoria}
        </Text>
      </Section>

      <Section className="mt-6 text-center">
        <Button
          href={`${appUrl}/login`}
          className="rounded-md bg-[#1498D5] px-6 py-3 text-sm font-medium text-white"
        >
          Acessar o Nexus
        </Button>
      </Section>

      <Text className="mt-6 text-[12px] leading-relaxed text-amber-300/80">
        ⚠️ Por segurança, esta senha é temporária. Você será solicitado a criar
        uma senha nova no primeiro login.
      </Text>
    </EmailLayout>
  )
}
