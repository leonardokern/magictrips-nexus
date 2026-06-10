import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout } from "./_layout"

type Props = {
  resetUrl: string
  appUrl: string
}

export default function ResetSenha({ resetUrl, appUrl }: Props) {
  void appUrl
  return (
    <EmailLayout preview="Redefinição de senha — Nexus">
      <Heading className="m-0 text-xl font-semibold text-white">
        Redefinir sua senha
      </Heading>
      <Text className="mt-2 text-sm leading-relaxed text-white/75">
        Recebemos uma solicitação para redefinir a senha da sua conta no Nexus.
        Clique no botão abaixo para criar uma nova senha.
      </Text>

      <Section className="mt-6 text-center">
        <Button
          href={resetUrl}
          className="rounded-md bg-[#1498D5] px-6 py-3 text-sm font-medium text-white"
        >
          Redefinir senha
        </Button>
      </Section>

      <Text className="mt-6 text-[12px] leading-relaxed text-white/45">
        Este link expira em 1 hora. Se você não solicitou a redefinição,
        ignore este e-mail — sua senha permanece a mesma.
      </Text>
    </EmailLayout>
  )
}
