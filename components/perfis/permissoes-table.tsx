"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { MODULOS_PERMISSAO } from "@/lib/constants/permissoes"
import type { PermissoesValue } from "@/lib/schemas/perfil"

type Props = {
  value: PermissoesValue
  onChange: (next: PermissoesValue) => void
  /** Marca tudo como true e desabilita interação (Administrador). */
  readOnlyAllTrue?: boolean
  disabled?: boolean
  /** Flags de feature — quando false, oculta módulos ainda não liberados. */
  agendaEnabled?: boolean
  propostasEnabled?: boolean
}

// Colunas em ordem de exibição. Manter alinhado com o catálogo em
// lib/constants/permissoes.ts — se aparecer ação nova, adicionar aqui.
// "ver" e "ler" são tratados como a mesma coluna — módulos usam um ou outro.
const ACOES_COLUNAS: { key: string; label: string; aliases?: string[] }[] = [
  { key: "ver", label: "Ver", aliases: ["ler"] },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
  { key: "aprovar", label: "Aprovar" },
]

export function PermissoesTable({
  value,
  onChange,
  readOnlyAllTrue,
  disabled,
  agendaEnabled,
  propostasEnabled,
}: Props) {
  const modulos = MODULOS_PERMISSAO.filter((m) => {
    if (m.key === "agenda" && !agendaEnabled) return false
    if (m.key === "propostas" && !propostasEnabled) return false
    return true
  })
  function toggle(modulo: string, acao: string, checked: boolean) {
    if (readOnlyAllTrue || disabled) return
    onChange({
      ...value,
      [modulo]: { ...(value[modulo] ?? {}), [acao]: checked },
    })
  }

  function toggleLinhaInteira(modulo: string, acoesDisponiveis: string[]) {
    if (readOnlyAllTrue || disabled) return
    const perms = value[modulo] ?? {}
    const todasMarcadas = acoesDisponiveis.every((a) => perms[a])
    const novo: Record<string, boolean> = {}
    for (const a of acoesDisponiveis) novo[a] = !todasMarcadas
    onChange({ ...value, [modulo]: novo })
  }

  return (
    <div className="overflow-x-auto overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02]" style={{ maxHeight: "60vh" }}>
      {/* min-width garante que todas as colunas sejam visíveis antes de rolar */}
      <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            {/* Coluna módulo: ocupa espaço restante */}
            <th className="sticky left-0 top-0 z-20 border-b border-white/[0.06] bg-[#0b1424] px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/55">
              Módulo
            </th>
            {ACOES_COLUNAS.map((acao) => (
              <th
                key={acao.key}
                className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0b1424] py-3 text-center text-[11px] font-medium uppercase tracking-wider text-white/55"
                style={{ width: 76 }}
              >
                {acao.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modulos.map((mod) => {
            const perms = value[mod.key] ?? {}
            const acoesDisponiveis: string[] = mod.acoes.map((a) => a.key)
            const linhaDesabilitada = Boolean(mod.naoDisponivel)
            // readOnlyAllTrue (Administrador) ignora "em breve" — Admin
            // sempre marca tudo. Para os demais perfis, naoDisponivel trava
            // toda a interação da linha.
            const desabilitaInteracao =
              readOnlyAllTrue || disabled || linhaDesabilitada

            return (
              <tr
                key={mod.key}
                className={`group transition-colors ${
                  linhaDesabilitada
                    ? "opacity-50"
                    : "hover:bg-white/[0.025]"
                }`}
                aria-disabled={linhaDesabilitada || undefined}
              >
                <td
                  className={`sticky left-0 z-10 border-b border-white/[0.04] bg-[#0b1424] px-4 py-3 align-middle ${
                    linhaDesabilitada ? "" : "group-hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleLinhaInteira(mod.key, acoesDisponiveis)}
                      disabled={desabilitaInteracao}
                      className="block text-left text-sm font-medium text-white hover:text-nexus-bright disabled:cursor-not-allowed disabled:hover:text-white"
                      title={
                        linhaDesabilitada
                          ? "Módulo ainda não disponível"
                          : "Clique para marcar/desmarcar toda a linha"
                      }
                    >
                      {mod.label}
                    </button>
                    {linhaDesabilitada && (
                      <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/55">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                    {mod.description}
                  </p>
                </td>

                {ACOES_COLUNAS.map((acao) => {
                  // Resolve qual chave real o módulo usa para esta coluna
                  // (ex: coluna "ver" pode mapear para "ler" no módulo)
                  const chaveReal =
                    acoesDisponiveis.includes(acao.key)
                      ? acao.key
                      : (acao.aliases ?? []).find((a) => acoesDisponiveis.includes(a)) ?? null
                  if (!chaveReal) {
                    return (
                      <td
                        key={acao.key}
                        className="border-b border-white/[0.04] py-3 text-center align-middle text-white/20"
                        style={{ width: 76 }}
                      >
                        —
                      </td>
                    )
                  }
                  const checked = readOnlyAllTrue ? true : Boolean(perms[chaveReal])
                  return (
                    <td
                      key={acao.key}
                      className="border-b border-white/[0.04] py-3 text-center align-middle"
                      style={{ width: 76 }}
                    >
                      <div className="flex justify-center">
                        <Checkbox
                          checked={checked}
                          disabled={desabilitaInteracao}
                          onCheckedChange={(c) =>
                            toggle(mod.key, chaveReal, c === true)
                          }
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
