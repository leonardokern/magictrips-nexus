# Migrations — Compass

Migrations versionadas do banco PostgreSQL (Supabase).

## Convenção

- Nome: `{numero}_{nome_descritivo}.sql` (ex: `001_empresas_perfis.sql`)
- Ordem importa — aplicar em sequência numérica
- Cada migration é atômica (transação implícita do Supabase CLI)
- Nunca editar uma migration já aplicada — criar uma nova

## Ordem de aplicação (V1.0)

| # | Arquivo | Conteúdo |
|---|---|---|
| 001 | empresas_perfis.sql | empresas + perfis_acesso + seed |
| 002 | usuarios.sql | usuarios (espelha auth.users) |
| 003 | clientes.sql | clientes |
| 004 | fornecedores.sql | fornecedores |
| 005 | campos_dinamicos.sql | campos_extra + opções + tipos_produto + junction + seed |
| 006 | vendas.sql | vendas + passageiros + produtos + junction |
| 007 | cobranca.sql | cobranca_cliente + itens |
| 008 | cartoes.sql | cartões da agência |
| 009 | parcelas.sql | parcelas_receber + parcelas_pagar |
| 010 | ciclos_faturamento.sql | ciclos de faturamento |
| 011 | logs_lembretes.sql | lembretes + audit_logs + integration_logs |
| 012 | rls.sql | RLS policies de todas as tabelas |

## Aplicar localmente

```bash
supabase db reset           # zera e re-aplica todas as migrations
supabase db push            # aplica em remoto
```

## Aplicar via MCP

Cada migration foi aplicada via `mcp__supabase__apply_migration` no projeto `papgnqzrkpbicuzkfzcr` (org LK Labs).
