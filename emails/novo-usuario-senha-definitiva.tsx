import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout } from "./_layout"

type Props = {
  nome: string
  email: string
  appUrl: string
  criadoPor?: string
}

/**
 * Email enviado quando o admin cria usuário com senha definitiva (sem forçar
 * troca). NÃO incluímos a senha em plain — admin combina com o usuário por
 * canal mais seguro (verbal/chat). Email só avisa que a conta existe.
 */
export default function NovoUsuarioSenhaDefinitiva({
  nome,
  email,
  appUrl,
  criadoPor,
}: Props) {
  return (
    <EmailLayout preview={`Bem-vindo ao Nexus, ${nome}`}>
      <Heading className="m-0 text-xl font-semibold text-white">
        Bem-vindo ao Nexus, {nome.split(" ")[0]}
      </Heading>
      <Text className="mt-2 text-sm leading-relaxed text-white/75">
        Sua conta foi criada{criadoPor ? ` por ${criadoPor}` : ""} e já está
        ativa. Use o e-mail abaixo para fazer login no sistema. A senha foi
        definida diretamente pelo administrador — solicite-a a ele caso ainda
        não tenha recebido.
      </Text>

      <Section className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <Text className="m-0 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
          Seu e-mail de acesso
        </Text>
        <Text className="m-0 mt-1 font-mono text-base text-white">
          {email}
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

      <Text className="mt-6 text-[12px] leading-relaxed text-white/55">
        Você pode trocar sua senha a qualquer momento em{" "}
        <strong className="text-white/80">Perfil → Alterar senha</strong> dentro
        do sistema.
      </Text>
    </EmailLayout>
  )
}
