# Compass

Plataforma interna de gestão da **MagicTrips** e **Del Mondo**.

> Substitui o fluxo atual (Google Forms + WhatsApp + planilha + Otoos) por um sistema único: agente registra a venda → gerente aprova → parcelas geradas automaticamente → exportação para Otoos.

## Stack

- **Next.js 14** (App Router + RSC) + TypeScript strict
- **Tailwind CSS 3** + shadcn/ui
- **Supabase** (PostgreSQL + RLS + Auth + Storage + Edge Functions)
- **Resend** (email transacional)
- **Vercel** (deploy)

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env.local
# preencher .env.local com os valores reais

# 3. Subir o dev server
npm run dev
```

Acesse `http://localhost:3000`.

## Estrutura

```
magictrips-compass/
├── app/                    # Next.js App Router
│   ├── (auth)/login/       # tela de login
│   └── (dashboard)/        # rotas autenticadas
├── components/
│   ├── ui/                 # shadcn/ui primitivos
│   └── forms/              # formulários de domínio
├── lib/
│   ├── supabase/           # client.ts + server.ts + middleware.ts
│   ├── hooks/              # useAuth, usePermissions
│   └── utils/              # money, dates, expressions
├── types/database.types.ts # gerado pelo Supabase CLI
└── supabase/
    ├── migrations/         # SQL versionado
    └── seed.sql            # seed do usuário admin
```

## Banco de dados

Schema completo aplicado via 13 migrations em `supabase/migrations/`. RLS habilitado em todas as 22 tabelas.

Para regenerar os tipos TypeScript:

```bash
# Via Supabase MCP:
# generate_typescript_types → types/database.types.ts
```

## Documentação

- **CLAUDE.md** — contexto resumido do projeto (carregado automaticamente pelo Claude Code)
- **Skill `magictrips`** — conhecimento completo em `Documents/Claude/Projects/Magic Trips/skill/`

## Convenções

- Interface 100% em **português brasileiro**
- Valores monetários: **R$** com 2 casas decimais
- Datas: **DD/MM/YYYY** na UI, ISO 8601 no banco
- Cores: sempre via **tokens semânticos** (`bg-background`, `text-foreground`...) — nunca `bg-white`, `text-black`
- Vendas: **nunca deletar**, apenas cancelar
- Audit: toda ação crítica gera registro em `audit_logs`

## Credenciais iniciais

| Usuário | Senha |
|---|---|
| `admin@magictrips.com.br` | `adminmagic` |

**Trocar a senha após o primeiro login em produção.**
