# Nexus — Padrões do sistema

Este arquivo documenta convenções de UI/UX e código estabelecidas durante o desenvolvimento. **Sempre consultar antes de criar UI nova** — manter consistência reduz fricção.

## Stack

- Next.js 14 (App Router, RSC, TS strict) + Tailwind + shadcn/ui
- Supabase (Postgres + RLS + Auth)
- Resend para email transacional
- Recharts para gráficos
- Lottie pra loader principal

## Identidade visual

- Paleta primária:
  - `nexus-deep` = `#004E5A`
  - `nexus-bright` = `#1498D5`
  - `nexus-bright-soft` = variação mais clara do azul
- Empresas com cor própria:
  - Magic Trips: `#004E5A`
  - Del Mondo: `#1498D5`
- Tema **dark** sempre. Backgrounds `bg-white/[0.02]` em cards, `border-white/[0.06]` em divisores. Nunca usar branco puro como background.

## Padrão de ações em linhas de tabela ⭐

**Sempre que houver tabela de listagem, ações ficam à direita em coluna "Ações" usando ícones com borda permanente.**

Estrutura:
- `<div className="flex items-center justify-end gap-1.5">` — wrapper
- Cada ação é um `IconAction` `h-9 w-9` com borda + fundo tintado leve sempre visível, hover intensifica
- Ícone interno é `h-4 w-4` do lucide-react
- Tooltip via `title` + `aria-label` com o rótulo (acessibilidade)

Tones (cor da borda/fundo/ícone):
- `neutral` — branco transparente (Visualizar, ações secundárias)
- `bright` — azul Nexus (Editar, abrir modal de edição)
- `amber` — âmbar (Inativar, ações de pausa)
- `emerald` — verde (Ativar, ações de retomar)
- `rose` — rosa (Excluir, ações destrutivas)

Classes do tone (exemplo `bright`):
```
border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright
hover:border-nexus-bright/50 hover:bg-nexus-bright/15
```

Classe base:
```
inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors
disabled:cursor-not-allowed disabled:opacity-40
```

**Regras de visibilidade:**
- "Visualizar" (Eye) — sempre visível pra quem tem `ler`
- "Editar" (Pencil) — visível pra quem tem `editar`. Em rows do `Administrador` (Admin Master), **continua visível mas `disabled`** com tooltip explicando — não some
- "Inativar/Ativar" (Power) — mesma regra do Editar. Adicionalmente `disabled` quando `isSelf` (próprio usuário)
- "Excluir" (Trash2) — opcional, gated por `excluir`
- Ações com mutation usam `useTransition` + spinner inline via `LoaderButton`

**Implementação canônica:** `components/usuarios/usuario-row-actions.tsx` e `components/perfis/perfil-row-actions.tsx`. Copiar daí ao criar novos `*-row-actions`.

**O nome do registro na primeira coluna NÃO é link** — abrir detalhe é responsabilidade exclusiva do botão 👁️ Visualizar.

**Linhas de tabela NÃO têm `cursor-pointer`** — só elementos clicáveis (botões/links) mostram cursor de mão. Hover sutil em `hover:bg-white/[0.025]` apenas pra feedback visual.

## Padrão de interação por ação

Este é o **contrato do sistema** — seguir sempre:

| Ação | Comportamento |
|---|---|
| **Cadastrar** (novo) | Abre `*-form-modal.tsx` em `mode="create"` |
| **Visualizar** (eye) | Abre o mesmo `*-form-modal.tsx` em `mode="edit"` com `readOnly` — campos desabilitados, sem botão Salvar, footer mostra "Fechar" |
| **Editar** (pencil) | Abre o mesmo `*-form-modal.tsx` em `mode="edit"` (sem readOnly) |
| **Ativar/Inativar** (power) | Abre `<Dialog>` de confirmação com `LoaderButton` na cor do tone (âmbar pra inativar, emerald pra ativar). Sem confirmação direta |
| **Excluir** (trash2) | Abre `<Dialog>` de confirmação destrutiva com `variant="destructive"` no LoaderButton |

**Implicações de implementação:**
- Todo `*-form-modal.tsx` deve aceitar prop `readOnly?: boolean`. Em readOnly:
  - Todos inputs/selects/switches ficam `disabled`
  - Seções de senha/criação ficam ocultas (`isCreate && !readOnly`)
  - Footer: só botão "Fechar" (`DialogClose`), sem submit
  - Title vira "Detalhes do {recurso}"
- **Nunca** redirecionar pra `/recurso/[id]` ao clicar em Visualizar — sempre modal
- Rotas `/[recurso]/[id]/page.tsx` são opcionais (deep-link), mas a UX padrão é modal. Se a rota existe, ela serve como compatibilidade com URL compartilhada, não como ação primária

**Implementação canônica:** `components/usuarios/usuario-row-actions.tsx` cobre os 3 modais (view/edit/confirm) num único componente — copiar daí ao criar novos.

## Padrão de modais

- Todo CRUD que envolve formulário é **modal**, não rota dedicada. `*-form-modal.tsx` no `components/<dominio>/`.
- Páginas `/[recurso]/novo` e `/[recurso]/[id]/editar` são **proibidas** — sempre que aparecer, deletar.
- Modais grandes (wizard, gerenciar campos) usam:
  ```
  flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0
  ```
  com `DialogHeader` sticky no topo (`shrink-0 border-b`) e `DialogFooter` sticky no rodapé (`shrink-0 border-t bg-card/95 backdrop-blur`). Body do form com `flex-1 overflow-y-auto px-6 py-5`.
- O `Dialog` base já garante `max-h-[calc(100vh-2rem)]` + `overflow-y-auto` pra modais simples — adaptativo a qualquer altura de tela.
- X de fechar do `Dialog`: estilizado como botão com borda (`border border-white/10 h-9 w-9`).
- Quando o modal carrega dados sob demanda, mostrar `<ModalLoader />` (componente em `components/ui/modal-loader.tsx`) com Lottie + label.
- Botões "Salvar/Criar/Excluir" usam `<LoaderButton loading={isPending}>...` (spinner inline em vez de trocar texto pra "Salvando…").

## Padrão de loaders

- `<Spinner />` — spinner inline (Loader2 do lucide com `animate-spin`)
- `<LoaderButton loading={...} loadingText={...}>` — botão com spinner que substitui o ícone-líder quando `loading=true`
- `<ModalLoader label="..." />` — Lottie grande + label centralizada, pra body de modal
- `<LottieLoader />` — Lottie cru, pra usos isolados

## Email transacional

- Templates em `emails/*.tsx` usando `@react-email/components`
- Layout base: `emails/_layout.tsx` (header "Nexus · Magic Trips", footer constante, fundo `#0b1424`)
- Helper: `lib/email/send.ts` — `enviarEmail*` por template nomeado
- **Best-effort**: sem `RESEND_API_KEY` o envio é pulado silenciosamente, fluxo principal continua
- Always render via `await render(<Component />)` do `@react-email/render` antes de passar `html` pro Resend (passar `react` direto quebra em runtime Node)
- Domínio verificado no Resend: `nexus.magictrips.com.br`
- DNS gerenciado pelo Cloudflare (NS), domínio registrado na Locaweb

## Permissões

- Catálogo em `lib/constants/permissoes.ts`, tipos em `lib/hooks/use-permissions.ts`
- Ações canônicas: `ler`, `ver`, `criar`, `editar`, `excluir`, `aprovar`, `csv`, `excel`
- Módulo `dashboard` com ação `ver` controla quem vê o painel inicial (Admin + Gerente por padrão)
- `Administrador` tem bypass (`can()` sempre `true`)
- Toda nova permissão exige: catálogo + tipo + migration UPDATE em `perfis_acesso`

## Mobile — layout app-like ⭐

O mobile usa padrões nativos de app, não responsivo adaptado. Pontos críticos:

### Header
- **Mobile** (`< md`): `sticky top-0`, full-width, `border-b border-white/[0.08] bg-card/90`, `h-16`. Sem bordas arredondadas, sem gap do topo.
- **Desktop** (`md+`): card flutuante `sticky top-3`, `rounded-2xl border border-white/[0.06] bg-card/60`, `h-20`. O offset de 12px vem **só** do `p-3` do wrapper — **não adicionar `md:mt-3`** no header ou ele fica desalinhado com o sidebar.
- Wrapper da coluna direita: `md:p-3 md:pl-0` (sem padding no mobile pra o header ir full-bleed).

### Navigation
`BottomNav` (`components/dashboard/bottom-nav.tsx`) — substitui o hamburger. **`MobileNav` foi removido.** 3 tabs prioritários + "Mais" com bottom sheet via `createPortal`.

### UserMenu mobile
Chip com avatar `h-7 w-7` + nome abreviado. Helper `formatNomeAbreviado("Leonardo Kern Pereira")` → `"Leonardo K. P."` em `user-menu.tsx` e `layout.tsx`.

### NotificationsButton desktop
Inner wrapper `<span className="relative flex h-9 w-9 ...">` dentro do botão garante que a altura desktop bata com o UserMenu chip (`py-2` + `h-9` ≈ 52px).

### Dashboards
Dois árvores JSX: `<div className="md:hidden">` (app-like) + `<div className="hidden md:block">` (original). Hero card mobile: `bg-gradient-to-br from-nexus-deep/60 via-[#0d1a24] to-nexus-bright/10`.

### Filtros de listagem
Selects de filtro ocultos no mobile com `<div className="hidden md:contents">`. Input de busca sempre visível.

---

## Clientes — peculiaridades

- **Email opcional** (migration 079): `clientes.email` aceita NULL. Checagem de duplicidade por email só roda se email preenchido.
- **Estrangeiro** (migration 078): toggle "Brasileiro(a) / Estrangeiro(a)" ao lado do nome. Quando estrangeiro: CPF → doc livre, CEP → código postal livre sem ViaCEP, UF/Cidade → texto livre, País → `PaisCombobox` (195 países, busca PT-BR). País salvo em `endereco.pais` (ISO 3166-1 alpha-2). Obrigatório para estrangeiros.
- **Filtros de listagem**: página de clientes tem apenas busca por nome/CPF/CNPJ/e-mail. Selects de tipo/status/empresa foram removidos.

## Perfis de acesso — peculiaridades

- **Tipo `marketing`** (migration 074): terceiro tipo além de `operacao` e `agente`. Cross-empresa (`empresa_id = null`), comissão especial, badge amarelo. Comportamento igual a `operacao` por ora.
- **Clonar perfil**: botão "Novo Perfil" abre picker com "Do zero" ou "A partir de um perfil existente". Segunda opção pré-preenche permissões da cópia, nome fica vazio. `components/perfis/novo-perfil-button.tsx`.
- **Reset de senha**: usa `createAdminClient().auth.admin.generateLink({ type: "recovery" })` + envia via Resend. **Não** usa `supabase.auth.resetPasswordForEmail()` (SMTP nativo do Supabase — limite 4/h, cai em spam).

## Pegadinhas conhecidas

- **`gen_salt`/`crypt`**: pgcrypto vive em `extensions` schema no Supabase. RPCs com `SET search_path = public` precisam qualificar como `extensions.gen_salt`/`extensions.crypt` ou falham com `function does not exist`.
- **`usuarios.empresa_id` não existe mais** — coluna foi removida na migração N:N (021). Audit logs usam NULL em vez de subquery dessa coluna inexistente.
- **Página `/[recurso]/novo` ou `/[recurso]/[id]/editar`** quase sempre é dead code — usamos modais. Verificar referências antes de criar.
- **shadcn `cn`** = `twMerge(clsx(...))` — consumer sempre pode sobrescrever defaults do componente base.
- **Header offset desktop**: o gap de 12px do header vem do `p-3` do wrapper, não de `mt-3` no próprio header. Dobrar com `md:mt-3` deslinha header e sidebar.
- **Lazy-load em modal — sempre limpar ao fechar**: modais com `if (detalhes) return` para cachear dados devem incluir `if (!open) { setDetalhes(null); return }` antes do guard. Sem isso, reabertura após update de dados (ex: novo anexo) mostra snapshot antigo. Padrão correto: `if (!open) { setX(null); return }; if (x) return; fetch()...`

## Comandos comuns

```bash
npm run dev                                # dev server localhost:3000
npx tsc --noEmit                           # type-check sem build
npm install <pacote>                       # adiciona dep
```

Supabase project: `papgnqzrkpbicuzkfzcr` (Compass org LK Labs). Migrations em `supabase/migrations/NNN_*.sql`.
