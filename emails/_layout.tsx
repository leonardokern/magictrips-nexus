import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import type * as React from "react"

type Props = {
  preview: string
  children: React.ReactNode
}

/**
 * Layout base compartilhado pelos emails transacionais do Nexus.
 * Mantém header de marca, container central e footer constante.
 */
export function EmailLayout({ preview, children }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                nexus: {
                  deep: "#004E5A",
                  bright: "#1498D5",
                },
              },
            },
          },
        }}
      >
        <Body className="bg-[#0b1424] py-10 font-sans">
          <Container className="mx-auto max-w-[560px] rounded-2xl border border-white/10 bg-[#111c33] p-8">
            {/* Header: marca */}
            <Section className="mb-6 text-center">
              <Text className="m-0 text-xs uppercase tracking-[0.32em] text-[#46B1E0]">
                Nexus · Magic Trips
              </Text>
            </Section>

            <Hr className="my-0 border-white/[0.08]" />

            <Section className="pt-6">{children}</Section>

            <Hr className="mt-8 border-white/[0.08]" />

            <Section className="pt-4">
              <Text className="m-0 text-center text-[11px] leading-relaxed text-white/45">
                Este e-mail foi enviado automaticamente pelo sistema Nexus.
                <br />
                Se você não esperava receber, ignore esta mensagem.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
