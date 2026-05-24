"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ModalLoader } from "@/components/ui/modal-loader"
import { NovoCampoExtraButton } from "./novo-campo-extra-button"
import { CampoExtraRowActions } from "./campo-extra-row-actions"
import {
  listarCamposParaGerenciar,
  type CampoExtraComUso,
} from "@/app/(dashboard)/tipos-produto/actions"
import { TIPO_CAMPO_LABEL } from "@/lib/schemas/tipo-produto"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  podeCriar: boolean
  podeEditar: boolean
  podeExcluir: boolean
}

export function GerenciarCamposModal({
  open,
  onOpenChange,
  podeCriar,
  podeEditar,
  podeExcluir,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [campos, setCampos] = useState<CampoExtraComUso[]>([])

  // Recarrega sempre que o modal abre — assim mudanças feitas via mutations
  // ficam refletidas. Mutations internas (criar/editar/toggle/excluir) chamam
  // router.refresh, mas como o modal usa state local, precisamos sincronizar.
  useEffect(() => {
    if (!open) return
    let cancel = false
    setLoading(true)
    listarCamposParaGerenciar().then((r) => {
      if (cancel) return
      if (!r.ok) {
        toast.error(r.error)
        setCampos([])
      } else {
        setCampos(r.data ?? [])
      }
      setLoading(false)
    })
    return () => {
      cancel = true
    }
  }, [open])

  // Após uma mutation (criar/editar/inativar/excluir) os componentes filhos
  // disparam router.refresh, mas como o modal vive client-side com state próprio,
  // expomos um reload manual via callback.
  async function reload() {
    setLoading(true)
    const r = await listarCamposParaGerenciar()
    if (!r.ok) toast.error(r.error)
    else setCampos(r.data ?? [])
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-14">
            <div>
              <DialogTitle>Gerenciar campos</DialogTitle>
              <DialogDescription className="mt-1 max-w-xl">
                Catálogo de campos extras que podem ser vinculados a um tipo de
                produto. Define nome, tipo (texto, número, data, lista, sim/não)
                e opções (no caso de listas).
              </DialogDescription>
            </div>
            {podeCriar && <NovoCampoExtraButton onSuccess={reload} />}
          </div>
        </DialogHeader>

        {loading ? (
          <ModalLoader label="Carregando campos…" />
        ) : (
          <div className="max-h-[60vh] overflow-auto overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[#0b1424]">
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-white/55">Nome</TableHead>
                  <TableHead className="text-white/55">Tipo</TableHead>
                  <TableHead className="text-white/55">Detalhes</TableHead>
                  <TableHead className="text-white/55">Em uso</TableHead>
                  <TableHead className="text-white/55">Status</TableHead>
                  <TableHead className="text-right text-white/55">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campos.length === 0 ? (
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-sm text-white/45"
                    >
                      Nenhum campo cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  campos.map((c) => (
                    <TableRow
                      key={c.id}
                      className="border-white/[0.06] hover:bg-white/[0.025]"
                    >
                      <TableCell className="font-medium text-white">
                        {c.nome}
                      </TableCell>
                      <TableCell className="text-sm text-white/75">
                        {TIPO_CAMPO_LABEL[c.tipo_campo] ?? c.tipo_campo}
                      </TableCell>
                      <TableCell className="text-xs text-white/55">
                        {c.tipo_campo === "dropdown" ? (
                          c.opcoes.length === 0 ? (
                            <span className="text-amber-300">
                              Sem opções cadastradas
                            </span>
                          ) : (
                            <span>
                              {c.opcoes.length}{" "}
                              {c.opcoes.length === 1 ? "opção" : "opções"}
                            </span>
                          )
                        ) : c.placeholder ? (
                          <span className="font-mono text-white/45">
                            “{c.placeholder}”
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.tiposEmUso.length === 0 ? (
                          <span className="text-white/40">Não vinculado</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.tiposEmUso.map((t, i) => (
                              <span
                                key={`${c.id}-${t}-${i}`}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/75"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.ativo ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                            Ativo
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/55">
                            Inativo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <CampoExtraRowActions
                          campo={{
                            id: c.id,
                            nome: c.nome,
                            tipo_campo: c.tipo_campo,
                            placeholder: c.placeholder,
                            ativo: c.ativo,
                            opcoes: c.opcoes,
                          }}
                          podeEditar={podeEditar}
                          podeExcluir={podeExcluir}
                          onSuccess={reload}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
