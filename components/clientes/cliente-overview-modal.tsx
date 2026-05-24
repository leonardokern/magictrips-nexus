"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
  User,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModalLoader } from "@/components/ui/modal-loader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import {
  getClienteOverview,
  type ClienteOverview,
} from "@/app/(dashboard)/clientes/actions"
import { formatCnpj, formatCpf, formatTelefone } from "@/lib/utils/formatters"
import { formatBRL } from "@/lib/utils/sum-parser"
import { ESTADOS_BR } from "@/lib/data/estados"

const STATUS_VENDA_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pendente_validacao: "Aguardando",
  aprovada: "Aprovada",
  cancelada: "Cancelada",
  devolvida: "Devolvida",
}

const STATUS_CHIP: Record<string, string> = {
  rascunho: "border-white/15 bg-white/[0.04] text-white/65",
  pendente_validacao: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  aprovada: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cancelada: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  devolvida: "border-rose-500/30 bg-rose-500/10 text-rose-300",
}

const STATUS_CLIENTE_CHIP: Record<string, string> = {
  ativo: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  lead: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  inativo: "border-white/15 bg-white/[0.04] text-white/55",
}

type Props = {
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClienteOverviewModal({ id, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ClienteOverview | null>(null)

  useEffect(() => {
    if (!open) {
      setData(null)
      setLoading(true)
      return
    }
    let cancel = false
    setLoading(true)
    getClienteOverview(id).then((r) => {
      if (cancel) return
      if (!r.ok) {
        toast.error(r.error)
        onOpenChange(false)
        return
      }
      setData(r.data ?? null)
      setLoading(false)
    })
    return () => {
      cancel = true
    }
  }, [open, id, onOpenChange])

  const cliente = data?.cliente
  const isPJ = cliente?.tipo_pessoa === "juridica"
  const tituloPrincipal = isPJ
    ? cliente?.razao_social || cliente?.nome_fantasia
    : cliente?.nome
  const subtitulo = isPJ ? cliente?.nome_fantasia : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4 pr-14">
          <DialogTitle>Detalhes do cliente</DialogTitle>
          <DialogDescription>
            Visão geral dos dados cadastrais e histórico de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading || !data || !cliente ? (
            <ModalLoader label="Carregando cliente…" />
          ) : (
            <div className="space-y-6">
              {/* Card de identificação */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      {isPJ ? "Pessoa jurídica" : "Pessoa física"}
                    </p>
                    <h3 className="mt-0.5 text-lg font-semibold text-white">
                      {tituloPrincipal || "—"}
                    </h3>
                    {subtitulo && (
                      <p className="text-sm text-white/55">{subtitulo}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                      STATUS_CLIENTE_CHIP[cliente.status] ??
                      STATUS_CLIENTE_CHIP.inativo
                    }`}
                  >
                    {cliente.status}
                  </span>
                </div>

                <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {isPJ ? (
                    <>
                      <Info
                        icon={Building2}
                        label="CNPJ"
                        value={formatCnpj(cliente.cnpj)}
                      />
                      <Info
                        icon={User}
                        label="Responsável"
                        value={cliente.responsavel}
                      />
                    </>
                  ) : (
                    <Info
                      icon={User}
                      label="CPF"
                      value={formatCpf(cliente.cpf)}
                    />
                  )}
                  <Info
                    icon={Mail}
                    label="E-mail"
                    value={cliente.email}
                  />
                  <Info
                    icon={Phone}
                    label="Telefone"
                    value={formatTelefone(cliente.telefone)}
                  />
                  {cliente.empresa_nome && (
                    <Info
                      icon={Building2}
                      label="Empresa"
                      value={cliente.empresa_nome}
                    />
                  )}
                  <Info
                    icon={MapPin}
                    label="Endereço"
                    value={formatEndereco(cliente.endereco)}
                    multiline
                  />
                </div>

                {cliente.observacoes && (
                  <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                      Observações
                    </p>
                    <p className="mt-1 text-sm text-white/75">
                      {cliente.observacoes}
                    </p>
                  </div>
                )}
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Vendas */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShoppingCart className="h-4 w-4 text-white/55" />
                    Vendas ({data.vendas.length})
                  </h4>
                  {data.vendas.length > 0 && (
                    <span className="text-[11px] text-white/55">
                      Total:{" "}
                      <span className="font-medium text-white">
                        {formatBRL(
                          data.vendas
                            .filter((v) => v.status === "aprovada")
                            .reduce((a, v) => a + v.receita, 0),
                        )}
                      </span>{" "}
                      em aprovadas
                    </span>
                  )}
                </div>

                {data.vendas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/[0.08] py-8 text-center text-sm text-white/40">
                    Esse cliente ainda não tem vendas registradas.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.06] hover:bg-transparent">
                          <TableHead className="text-white/55">Data</TableHead>
                          <TableHead className="text-white/55">PAX</TableHead>
                          <TableHead className="text-right text-white/55">
                            Receita
                          </TableHead>
                          <TableHead className="text-white/55">
                            Status
                          </TableHead>
                          <TableHead className="text-right text-white/55"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.vendas.map((v) => (
                          <TableRow
                            key={v.id}
                            className="border-white/[0.06] hover:bg-white/[0.025]"
                          >
                            <TableCell className="text-sm text-white/85">
                              {formatData(v.data_venda)}
                            </TableCell>
                            <TableCell className="text-sm text-white/65">
                              {v.pax}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-white/85">
                              {formatBRL(v.receita)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                                  STATUS_CHIP[v.status] ?? STATUS_CHIP.rascunho
                                }`}
                              >
                                {STATUS_VENDA_LABEL[v.status] ?? v.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/vendas/${v.id}`}
                                className="inline-flex items-center gap-1 text-xs text-nexus-bright hover:text-nexus-bright-soft"
                                onClick={() => onOpenChange(false)}
                              >
                                Abrir
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Info({
  icon: Icon,
  label,
  value,
  multiline,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
  multiline?: boolean
}) {
  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p
        className={`mt-1 ${multiline ? "text-sm" : "text-sm"} text-white/85 ${
          !value ? "text-white/35" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  )
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatEndereco(endereco: Record<string, unknown> | null): string {
  if (!endereco) return ""
  const e = endereco as {
    rua?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    estado?: string
    cep?: string
  }
  const linha1 = [
    e.rua,
    e.numero && `, ${e.numero}`,
    e.complemento && ` - ${e.complemento}`,
  ]
    .filter(Boolean)
    .join("")
  const estadoNome = ESTADOS_BR.find((s) => s.uf === e.estado)?.nome ?? e.estado
  const linha2 = [e.bairro, e.cidade && `${e.cidade}${estadoNome ? ` / ${estadoNome}` : ""}`]
    .filter(Boolean)
    .join(" · ")
  const cep = e.cep ? `CEP ${e.cep}` : ""
  return [linha1, linha2, cep].filter(Boolean).join("\n")
}
