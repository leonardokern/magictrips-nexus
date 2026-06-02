import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { formatBRL } from "@/lib/utils/sum-parser"
import { NovaVendaButton } from "@/components/vendas/nova-venda-button"
import { VendaRowActions } from "@/components/vendas/venda-row-actions"
import { VendasSearchInput } from "@/components/vendas/vendas-search-input"
import {
  ExportarVendasButton,
  type VendaSelecionavel,
} from "@/components/vendas/exportar-vendas-modal"
import { getStatusLabel, getStatusChip } from "@/lib/utils/venda-status"

export const metadata: Metadata = { title: "Vendas" }

/** Tamanho da página da lista de "Validadas". Pendentes não pagina (volume baixo). */
const PAGE_SIZE = 20

const STATUS_PENDENTES = ["pendente_validacao", "em_revisao"] as const

const SELECT_LISTA = `
  id, identificador, data_venda, status, pax, created_at, usuario_id,
  comissao_percentual,
  empresa:empresas(nome, slug),
  cliente:clientes(nome),
  agente:usuarios!vendas_usuario_id_fkey(nome),
  produtos:venda_produtos(valor_venda, rav, rav_extra_fornecedor)
` as const

type SearchParams = { page?: string; q?: string }

export default async function VendasPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver vendas.
      </div>
    )
  }

  // Paginação só da seção "Validadas" — pendentes têm volume baixo
  const pageParam = parseInt(searchParams?.page ?? "1", 10)
  const pageAtual = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const fromAprovadas = (pageAtual - 1) * PAGE_SIZE
  const toAprovadas = fromAprovadas + PAGE_SIZE - 1

  // ── Termo de busca (ID da venda ou nome do cliente) ────────────────────
  const qRaw = (searchParams?.q ?? "").trim().slice(0, 100)
  const hasSearch = qRaw.length > 0
  // Escapa wildcards do ILIKE (% e _) pra que vire match literal
  const qEscaped = qRaw.replace(/[%_]/g, "\\$&")

  const supabase = await createClient()

  // Quando há termo de busca, primeiro descobrimos os IDs de clientes
  // que dão match no nome (uma query) — depois filtramos vendas por
  // identificador ILIKE OU cliente_id IN (...).
  let clienteIds: string[] = []
  if (hasSearch) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .ilike("nome", `%${qEscaped}%`)
      .limit(500)
    clienteIds = (data ?? []).map((c) => c.id)
  }

  /** Aplica o filtro de busca em qualquer query de vendas — só se houver termo. */
  type Querify = {
    or: (s: string) => Querify
  }
  function aplicarBusca<Q extends Querify>(query: Q): Q {
    if (!hasSearch) return query
    const partes = [`identificador.ilike.%${qEscaped}%`]
    if (clienteIds.length > 0) {
      partes.push(`cliente_id.in.(${clienteIds.join(",")})`)
    }
    return query.or(partes.join(",")) as Q
  }

  // 2 queries em paralelo (busca aplicada quando q presente):
  //  1. Pendentes — sem paginação (volume baixo)
  //  2. Aprovadas paginadas — janela atual + count total
  const [pendentesRes, aprovadasRes] = await Promise.all([
    aplicarBusca(
      supabase
        .from("vendas")
        .select(SELECT_LISTA)
        .in("status", STATUS_PENDENTES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(200),
    ),
    aplicarBusca(
      supabase
        .from("vendas")
        .select(SELECT_LISTA, { count: "exact" })
        .eq("status", "aprovado")
        .order("data_aprovacao", { ascending: false, nullsFirst: false })
        .range(fromAprovadas, toAprovadas),
    ),
  ])

  const podeAprovar = can(user, "vendas", "aprovar")
  // "Editar global" = capacidade de editar QUALQUER venda da empresa (Admin/Gerente).
  // Agentes também têm `vendas.editar`, mas só pra suas próprias vendas em
  // rascunho/em_revisao — esse caso é coberto pela regra de ownership no row.
  const podeEditarGlobal = can(user, "vendas", "aprovar")
  /** Permissão base `vendas.editar` — necessária pra edição em qualquer contexto. */
  const podeEditarBasico = can(user, "vendas", "editar")
  const podeExcluir = can(user, "vendas", "excluir")
  const mostraComissao = podeAprovar

  function calcular<T extends { produtos: unknown; comissao_percentual?: number | null }>(v: T) {
    type ProdRow = { valor_venda: number; rav: number | null; rav_extra_fornecedor: number | null }
    const prods = (v.produtos as ProdRow[] | null) ?? []
    const total = prods.reduce((a, p) => a + Number(p.valor_venda ?? 0), 0)
    const ravTotal = prods.reduce(
      (a, p) => a + Number(p.rav ?? 0) + Number(p.rav_extra_fornecedor ?? 0),
      0,
    )
    const pctComissao = Number(v.comissao_percentual ?? 0)
    const comissao = (ravTotal * pctComissao) / 100
    return { total, ravTotal, comissao }
  }

  const pendentesTodos = (pendentesRes.data ?? []).map((v) => ({ ...v, ...calcular(v) }))
  // Pro agente: separar `em_revisao` (precisa de ação) de `pendente_validacao` (esperando).
  // Pro Admin/Gerente: tudo junto na mesma seção (ação deles é a mesma — aprovar/revisar).
  const emRevisao = !podeAprovar
    ? pendentesTodos.filter((v) => v.status === "em_revisao")
    : []
  const pendentes = !podeAprovar
    ? pendentesTodos.filter((v) => v.status === "pendente_validacao")
    : pendentesTodos
  const aprovadas = (aprovadasRes.data ?? []).map((v) => ({ ...v, ...calcular(v) }))
  const totalAprovadas = aprovadasRes.count ?? 0

  // Lista completa de vendas validadas (sem paginação) — usada APENAS pelo
  // modal de exportação Excel. Não onera a render quando o usuário não tem
  // permissão de exportar — só carrega pra Admin/Gerente. Sem busca aplicada
  // — exportação é sobre a base inteira; o operador filtra dentro do modal.
  let vendasParaExportar: VendaSelecionavel[] = []
  if (podeAprovar) {
    const { data } = await supabase
      .from("vendas")
      .select(SELECT_LISTA)
      .eq("status", "aprovado")
      .order("data_aprovacao", { ascending: false, nullsFirst: false })
      .limit(1000)
    vendasParaExportar = (data ?? []).map((v) => {
      const calc = calcular(v)
      const clienteObj = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente
      const agenteObj = Array.isArray(v.agente) ? v.agente[0] : v.agente
      return {
        id: v.id,
        identificador: v.identificador,
        dataVenda: v.data_venda ?? "",
        cliente: clienteObj?.nome ?? "—",
        agente: agenteObj?.nome ?? "—",
        valor: calc.total,
        rav: calc.ravTotal,
        comissao: calc.comissao,
      }
    })
  }
  const totalPaginas = Math.max(1, Math.ceil(totalAprovadas / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Vendas
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            {podeAprovar
              ? "Relatório de Venda — Admin/Gerente cadastram vendas já validadas. Agentes seguem fluxo de aprovação."
              : "Suas vendas — agentes cadastram para aprovação. Admin/Gerente da empresa valida em seguida."}
          </p>
        </div>

        {can(user, "vendas", "criar") && <NovaVendaButton />}
      </div>

      {/* Busca */}
      <div className="flex items-center justify-between gap-3">
        <VendasSearchInput />
        {hasSearch && (
          <span className="text-xs text-white/45">
            Buscando por <strong className="text-white/80">&ldquo;{qRaw}&rdquo;</strong>
          </span>
        )}
      </div>

      {/* ── Seção 0 (só agente): Em revisão — ação requerida ────────────── */}
      {!podeAprovar && emRevisao.length > 0 && (
        <VendasSection
          titulo="Precisa de revisão"
          descricao="O gerente devolveu estas vendas com observações. Corrija o que foi apontado e envie de novo para validação."
          emptyMsg=""
          linhas={emRevisao}
          userId={user.id}
          podeAprovar={podeAprovar}
          acento="orange"
          icone={AlertTriangle}
          contador={emRevisao.length}
          podeEditarGlobal={podeEditarGlobal}
          podeEditarBasico={podeEditarBasico}
          podeExcluir={podeExcluir}
          mostraComissao={mostraComissao}
        />
      )}

      {/* ── Seção 1: Aguardando validação ─────────────────────────────────── */}
      <VendasSection
        titulo={podeAprovar ? "Aguardando validação" : "Aguardando aprovação"}
        descricao={
          podeAprovar
            ? "Vendas submetidas por agentes que ainda precisam de aprovação."
            : "Vendas que você enviou e estão na fila do gerente. Sem ação necessária da sua parte."
        }
        emptyMsg={
          hasSearch
            ? `Nenhum resultado para "${qRaw}".`
            : podeAprovar
              ? "Nenhuma venda aguardando validação."
              : "Nenhuma venda na fila."
        }
        linhas={pendentes}
        userId={user.id}
        podeAprovar={podeAprovar}
        acento="amber"
        icone={ShieldCheck}
        contador={pendentes.length}
        podeEditarGlobal={podeEditarGlobal}
        podeEditarBasico={podeEditarBasico}
        podeExcluir={podeExcluir}
        mostraComissao={mostraComissao}
      />

      {/* ── Seção 2: Validadas ────────────────────────────────────────────── */}
      <VendasSection
        titulo="Validadas"
        descricao={
          podeAprovar
            ? "Vendas aprovadas. Admin/Gerente podem excluir do sistema com auditoria."
            : "Suas vendas já aprovadas — visualização apenas."
        }
        emptyMsg={
          hasSearch
            ? `Nenhum resultado para "${qRaw}".`
            : "Nenhuma venda validada ainda."
        }
        linhas={aprovadas}
        userId={user.id}
        podeAprovar={podeAprovar}
        podeEditarGlobal={podeEditarGlobal}
        podeEditarBasico={podeEditarBasico}
        podeExcluir={podeExcluir}
        mostraComissao={mostraComissao}
        acento="emerald"
        icone={CheckCircle2}
        contador={totalAprovadas}
        paginacao={{
          pageAtual,
          totalPaginas,
          totalItens: totalAprovadas,
          pageSize: PAGE_SIZE,
        }}
        headerExtra={
          podeAprovar && vendasParaExportar.length > 0 ? (
            <ExportarVendasButton vendas={vendasParaExportar} />
          ) : undefined
        }
      />
    </div>
  )
}

// ─── Componente: seção (tabela + cards mobile) ───────────────────────────────

type Linha = {
  id: string
  identificador: string
  data_venda: string
  status: string
  pax: number
  usuario_id: string
  empresa: { nome: string; slug: string } | { nome: string; slug: string }[] | null
  cliente: { nome: string } | { nome: string }[] | null
  agente: { nome: string } | { nome: string }[] | null
  total: number
  ravTotal: number
  comissao: number
}

type Acento = "amber" | "emerald" | "orange"

const ACENTO_CONFIG: Record<
  Acento,
  { icone: string; texto: string; chip: string; ring: string }
> = {
  amber: {
    icone: "bg-amber-500/15 text-amber-300",
    texto: "text-amber-200",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    ring: "ring-amber-500/25",
  },
  emerald: {
    icone: "bg-emerald-500/15 text-emerald-300",
    texto: "text-emerald-200",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    ring: "ring-emerald-500/25",
  },
  orange: {
    icone: "bg-orange-500/15 text-orange-300",
    texto: "text-orange-200",
    chip: "border-orange-500/40 bg-orange-500/15 text-orange-200",
    ring: "ring-orange-500/30",
  },
}

function VendasSection({
  titulo,
  descricao,
  emptyMsg,
  linhas,
  userId,
  podeAprovar,
  podeEditarGlobal,
  podeEditarBasico,
  podeExcluir,
  mostraComissao,
  acento,
  icone: Icone,
  contador,
  paginacao,
  headerExtra,
}: {
  titulo: string
  descricao: string
  emptyMsg: string
  linhas: Linha[]
  userId: string
  podeAprovar: boolean
  podeEditarGlobal: boolean
  podeEditarBasico: boolean
  podeExcluir: boolean
  mostraComissao: boolean
  acento: Acento
  icone: React.ComponentType<{ className?: string }>
  contador: number
  paginacao?: {
    pageAtual: number
    totalPaginas: number
    totalItens: number
    pageSize: number
  }
  /** Ação opcional à direita do título (ex: botão de exportar Excel). */
  headerExtra?: React.ReactNode
}) {
  const cfg = ACENTO_CONFIG[acento]
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
            cfg.icone,
            cfg.ring,
          )}
        >
          <Icone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-base font-semibold", cfg.texto)}>
              {titulo}
            </h3>
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold tabular-nums",
                cfg.chip,
              )}
            >
              {contador > 99 ? "99+" : contador}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-white/45">{descricao}</p>
        </div>
        {headerExtra && (
          <div className="ml-auto shrink-0 self-center">{headerExtra}</div>
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">ID</TableHead>
              <TableHead className="text-white/55">Data</TableHead>
              <TableHead className="text-white/55">Cliente</TableHead>
              <TableHead className="text-white/55">Responsável</TableHead>
              <TableHead className="text-right text-white/55">Valor</TableHead>
              <TableHead className="text-right text-white/55">RAV</TableHead>
              <TableHead className="text-right text-white/55">Comissão</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={9}
                  className="h-20 text-center text-sm text-white/45"
                >
                  {emptyMsg}
                </TableCell>
              </TableRow>
            ) : (
              linhas.map((v) => {
                const props = computeRowProps(v, {
                  userId,
                  podeAprovar,
                  podeEditarGlobal,
                  podeEditarBasico,
                  podeExcluir,
                  mostraComissao,
                })
                const emRevisao = v.status === "em_revisao"
                return (
                  <TableRow
                    key={v.id}
                    className={
                      emRevisao
                        ? "border-white/[0.06] border-l-2 border-l-orange-400/50 bg-orange-400/[0.04] hover:bg-orange-400/[0.07]"
                        : "border-white/[0.06] hover:bg-white/[0.025]"
                    }
                  >
                    <TableCell className="font-mono text-xs font-medium text-nexus-bright">
                      {v.identificador}
                    </TableCell>
                    <TableCell className="text-sm text-white/85">
                      {formatDateBR(v.data_venda)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-white">
                      {props.clienteNome}
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {props.agenteNome}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-white">
                      {formatBRL(v.total)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-white/75">
                      {formatBRL(v.ravTotal)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-amber-300/85">
                      {formatBRL(v.comissao)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                          getStatusChip(v.status)
                        }
                      >
                        {getStatusLabel(v.status, { podeAprovar })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* key explícita garante que mudanças de status entre
                          render e re-render (ex: aprovação) forcem unmount
                          completo do componente — evita estado residual
                          (detalhes cached, viewOpen, etc.) vazando entre
                          vendas distintas se a posição da linha mudar. */}
                      <VendaRowActions
                        key={`${v.id}-${v.status}`}
                        venda={{
                          id: v.id,
                          identificador: v.identificador,
                          status: v.status,
                          usuario_id: v.usuario_id,
                          clienteNome: props.clienteNome,
                          totalVenda: formatBRL(v.total),
                        }}
                        podeAprovar={podeAprovar}
                        podeEditar={props.podeEditarEsta}
                        podeExcluir={props.podeExcluirEsta}
                        mostraComissao={mostraComissao}
                        modoGerente={podeAprovar}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {linhas.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center text-sm text-white/45">
            {emptyMsg}
          </div>
        ) : (
          linhas.map((v) => {
            const props = computeRowProps(v, {
              userId,
              podeAprovar,
              podeEditarGlobal,
              podeEditarBasico,
              podeExcluir,
              mostraComissao,
            })
            const emRevisao = v.status === "em_revisao"
            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-xl border bg-white/[0.02] p-4",
                  emRevisao
                    ? "border-l-2 border-orange-400/50 border-white/[0.06] bg-orange-400/[0.04]"
                    : "border-white/[0.06]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-nexus-bright">
                    {v.identificador}
                  </span>
                  <span
                    className={
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                      getStatusChip(v.status)
                    }
                  >
                    {getStatusLabel(v.status, { podeAprovar })}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{props.clienteNome}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
                    {formatBRL(v.total)}
                  </p>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/50">
                  <span>{formatDateBR(v.data_venda)}</span>
                  <span>·</span>
                  <span>{props.empresaNome}</span>
                  <span>·</span>
                  <span>{v.pax} PAX</span>
                </div>
                {props.agenteNome !== "—" && (
                  <p className="mt-1 text-xs text-white/40">{props.agenteNome}</p>
                )}
                <div className="mt-3 flex justify-end border-t border-white/[0.04] pt-3">
                  <VendaRowActions
                    key={`${v.id}-${v.status}`}
                    venda={{
                      id: v.id,
                      identificador: v.identificador,
                      status: v.status,
                      usuario_id: v.usuario_id,
                      clienteNome: props.clienteNome,
                      totalVenda: formatBRL(v.total),
                    }}
                    podeAprovar={podeAprovar}
                    podeEditar={props.podeEditarEsta}
                    podeExcluir={props.podeExcluirEsta}
                    mostraComissao={mostraComissao}
                    modoGerente={podeAprovar}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Paginação (apenas quando a seção for paginada) */}
      {paginacao && paginacao.totalPaginas > 1 && (
        <PaginacaoControl
          pageAtual={paginacao.pageAtual}
          totalPaginas={paginacao.totalPaginas}
          totalItens={paginacao.totalItens}
          pageSize={paginacao.pageSize}
        />
      )}
    </section>
  )
}

/** Controles de paginação RSC-friendly — links com `?page=N` (sem JS).
 *  Mostra "1 de 5 · 100 vendas" + setas prev/next e botões de páginas
 *  vizinhas (até 5 visíveis). Página inicial = não mostra setinha pra trás;
 *  última página = não mostra pra frente. */
function PaginacaoControl({
  pageAtual,
  totalPaginas,
  totalItens,
  pageSize,
}: {
  pageAtual: number
  totalPaginas: number
  totalItens: number
  pageSize: number
}) {
  const inicio = (pageAtual - 1) * pageSize + 1
  const fim = Math.min(pageAtual * pageSize, totalItens)

  // Janela de até 5 páginas centralizada em pageAtual
  const janela: number[] = []
  const ini = Math.max(1, pageAtual - 2)
  const finJ = Math.min(totalPaginas, ini + 4)
  for (let p = ini; p <= finJ; p++) janela.push(p)

  function href(p: number): string {
    const qs = new URLSearchParams()
    if (p > 1) qs.set("page", String(p))
    const s = qs.toString()
    return s ? `?${s}` : "?"
  }

  return (
    <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-white/45">
        Exibindo {inicio}–{fim} de {totalItens} vendas
      </p>
      <nav className="flex items-center gap-1.5" aria-label="Paginação">
        <Link
          href={href(pageAtual - 1)}
          aria-label="Página anterior"
          aria-disabled={pageAtual <= 1}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors",
            pageAtual <= 1
              ? "pointer-events-none border-white/[0.04] text-white/20"
              : "border-white/10 text-white/70 hover:border-white/25 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          ‹
        </Link>
        {janela.map((p) => {
          const ativo = p === pageAtual
          return (
            <Link
              key={p}
              href={href(p)}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors tabular-nums",
                ativo
                  ? "border-nexus-bright/50 bg-nexus-bright/15 text-white"
                  : "border-white/10 text-white/65 hover:border-white/25 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {p}
            </Link>
          )
        })}
        <Link
          href={href(pageAtual + 1)}
          aria-label="Próxima página"
          aria-disabled={pageAtual >= totalPaginas}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors",
            pageAtual >= totalPaginas
              ? "pointer-events-none border-white/[0.04] text-white/20"
              : "border-white/10 text-white/70 hover:border-white/25 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          ›
        </Link>
      </nav>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRowProps(
  v: Linha,
  ctx: {
    userId: string
    podeAprovar: boolean
    podeEditarGlobal: boolean
    /** Permissão genérica `vendas.editar` — exigida tanto pra edição global
     *  (Admin/Gerente) quanto pra edição das próprias vendas (Agente). */
    podeEditarBasico: boolean
    podeExcluir: boolean
    mostraComissao: boolean
  },
) {
  // Agente só edita as próprias em rascunho/em_revisao. Admin/Gerente edita
  // qualquer status (exceto aprovado, onde a UI de edição não faz sentido).
  // Em ambos os casos exige `vendas.editar`.
  const podeEditarEsta =
    ctx.podeEditarBasico &&
    ((ctx.podeEditarGlobal && v.status !== "aprovado") ||
      (v.usuario_id === ctx.userId &&
        (v.status === "rascunho" || v.status === "em_revisao")))

  // Excluir: somente quem tem permissão; só faz sentido em validada.
  const podeExcluirEsta = ctx.podeExcluir && v.status === "aprovado"

  const empresaObj = Array.isArray(v.empresa) ? v.empresa[0] : v.empresa
  const clienteObj = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente
  const agenteObj = Array.isArray(v.agente) ? v.agente[0] : v.agente

  return {
    podeEditarEsta,
    podeExcluirEsta,
    clienteNome: clienteObj?.nome ?? "—",
    empresaNome: empresaObj?.nome ?? "—",
    agenteNome: agenteObj?.nome ?? "—",
  }
}

function formatDateBR(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
