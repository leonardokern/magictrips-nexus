"use server"

import { Resend } from "resend"
import { render } from "@react-email/render"
import NovoUsuarioComSenhaProvisoria from "@/emails/novo-usuario-com-senha-provisoria"
import NovoUsuarioSenhaDefinitiva from "@/emails/novo-usuario-senha-definitiva"

/**
 * Wrapper do Resend para envio de emails transacionais.
 *
 * Filosofia:
 *  - **Best-effort**: se RESEND_API_KEY não está configurada (ex: dev local
 *    sem credenciais) ou se o envio falha, logamos e seguimos. Email nunca
 *    bloqueia o fluxo principal (criar usuário, resetar senha, etc).
 *  - **Single source of truth pra remetente**: lê EMAIL_FROM do env. Se faltar,
 *    usa fallback explícito (que vai falhar — força configuração consciente).
 *  - **URL pública do app**: APP_URL alimenta os botões "Acessar o Nexus"
 *    nos templates. Default = http://localhost:3000 em dev.
 */

type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: "disabled" | "error"; error?: string }

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function getFrom(): string {
  return process.env.EMAIL_FROM ?? "Nexus <onboarding@resend.dev>"
}

function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000"
}

// ─── Sender genérico ────────────────────────────────────────────────────────

async function sendReactEmail(args: {
  to: string
  subject: string
  react: React.ReactElement
}): Promise<SendResult> {
  const client = getClient()
  if (!client) {
    // Modo dev/sem credenciais: degrada silenciosamente.
    console.warn(
      "[email] RESEND_API_KEY ausente — pulando envio para",
      args.to,
    )
    return { ok: false, reason: "disabled" }
  }

  try {
    // Renderizamos pra HTML manualmente (em vez de passar `react` direto pro
    // Resend) — isso evita a dependência runtime do Resend SDK em
    // @react-email/render via import dinâmico, que tava quebrando com
    // "render is not a function" em produção/Node.
    const html = await render(args.react)
    const { data, error } = await client.emails.send({
      from: getFrom(),
      to: args.to,
      subject: args.subject,
      html,
    })
    if (error || !data) {
      console.error("[email] Resend retornou erro:", error)
      return { ok: false, reason: "error", error: error?.message }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[email] Exception no envio:", message)
    return { ok: false, reason: "error", error: message }
  }
}

// ─── Templates nomeados ─────────────────────────────────────────────────────

export async function enviarEmailNovoUsuarioComSenhaProvisoria(params: {
  to: string
  nome: string
  senhaProvisoria: string
  criadoPor?: string
}): Promise<SendResult> {
  return sendReactEmail({
    to: params.to,
    subject: "Bem-vindo ao Nexus — sua senha provisória",
    react: NovoUsuarioComSenhaProvisoria({
      nome: params.nome,
      email: params.to,
      senhaProvisoria: params.senhaProvisoria,
      appUrl: getAppUrl(),
      criadoPor: params.criadoPor,
    }),
  })
}

export async function enviarEmailNovoUsuarioSenhaDefinitiva(params: {
  to: string
  nome: string
  criadoPor?: string
}): Promise<SendResult> {
  return sendReactEmail({
    to: params.to,
    subject: "Bem-vindo ao Nexus — sua conta foi criada",
    react: NovoUsuarioSenhaDefinitiva({
      nome: params.nome,
      email: params.to,
      appUrl: getAppUrl(),
      criadoPor: params.criadoPor,
    }),
  })
}
