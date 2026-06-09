/**
 * Renderiza os templates de email pra HTML estático em tmp/.
 * Uso: npx tsx scripts/render-emails.mjs
 */
import React from "react"
import { render } from "@react-email/render"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

// O esbuild do tsx compila JSX clássico (React.createElement) mas não
// injeta o import — defino global pra os templates funcionarem.
globalThis.React = React

const { default: NovoUsuarioComSenhaProvisoria } = await import(
  "../emails/novo-usuario-com-senha-provisoria.tsx"
)
const { default: NovoUsuarioSenhaDefinitiva } = await import(
  "../emails/novo-usuario-senha-definitiva.tsx"
)

const OUT = resolve("tmp")
mkdirSync(OUT, { recursive: true })

const htmlProvisoria = await render(
  React.createElement(NovoUsuarioComSenhaProvisoria, {
    nome: "Bruno Anunciação",
    email: "bruno@magictrips.com.br",
    senhaProvisoria: "Ab3#xK9z",
    appUrl: "https://nexus.magictrips.com.br",
    criadoPor: "Marcelo Maciel",
  }),
)

const htmlDefinitiva = await render(
  React.createElement(NovoUsuarioSenhaDefinitiva, {
    nome: "Bruno Anunciação",
    email: "bruno@magictrips.com.br",
    appUrl: "https://nexus.magictrips.com.br",
    criadoPor: "Marcelo Maciel",
  }),
)

writeFileSync(resolve(OUT, "email-provisoria.html"), htmlProvisoria)
writeFileSync(resolve(OUT, "email-definitiva.html"), htmlDefinitiva)

console.log("OK")
console.log("  tmp/email-provisoria.html  —", htmlProvisoria.length, "bytes")
console.log("  tmp/email-definitiva.html  —", htmlDefinitiva.length, "bytes")
