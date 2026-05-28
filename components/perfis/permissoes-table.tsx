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
}

// Colunas em ordem de exibição. Manter alinhado com o catálogo em
// lib/constants/permissoes.ts — se aparecer ação nova, adicionar aqui.
const ACOES_COLUNAS: { key: string; label: string }[] = [
  { key: "ver", label: "Ver" },
  { key: "ler", label: "Ler" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
  { key: "aprovar", label: "Aprovar" },
  { key: "csv", label: "CSV" },
  { key: "excel", label: "Excel" },
]

export function PermissoesTable({
  value,
  onChange,
  readOnlyAllTrue,
  disabled,
}: Props) {
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
    <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* min-width garante que todas as colunas sejam visíveis antes de rolar */}
      <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth: 820 }}>
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
          {MODULOS_PERMISSAO.map((mod) => {
            const perms = value[mod.key] ?? {}
            const acoesDisponiveis: string[] = mod.acoes.map((a) => a.key)
            return (
              <tr
                key={mod.key}
                className="group transition-colors hover:bg-white/[0.025]"
              >
                <td className="sticky left-0 z-10 border-b border-white/[0.04] bg-[#0b1424] px-4 py-3 align-middle group-hover:bg-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => toggleLinhaInteira(mod.key, acoesDisponiveis)}
                    disabled={readOnlyAllTrue || disabled}
                    className="block text-left text-sm font-medium text-white hover:text-nexus-bright disabled:cursor-default disabled:hover:text-white"
                    title="Clique para marcar/desmarcar toda a linha"
                  >
                    {mod.label}
                  </button>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                    {mod.description}
                  </p>
                </td>

                {ACOES_COLUNAS.map((acao) => {
                  const aplicavel = acoesDisponiveis.includes(acao.key)
                  if (!aplicavel) {
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
                  const checked = readOnlyAllTrue
                    ? true
                    : Boolean(perms[acao.key])
                  return (
                    <td
                      key={acao.key}
                      className="border-b border-white/[0.04] py-3 text-center align-middle"
                      style={{ width: 76 }}
                    >
                      <div className="flex justify-center">
                        <Checkbox
                          checked={checked}
                          disabled={readOnlyAllTrue || disabled}
                          onCheckedChange={(c) =>
                            toggle(mod.key, acao.key, c === true)
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
