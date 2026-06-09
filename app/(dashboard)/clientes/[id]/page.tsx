import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Mail, MapPin, Phone, User2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { formatCpf, formatDateBr, formatTelefone } from "@/lib/utils/formatters"
import {
  StatusClienteBadge,
  TipoClienteBadge,
} from "@/components/clientes/status-badge"
import type {
  ClienteFormValues,
  StatusCliente,
  TipoCliente,
} from "@/lib/schemas/cliente"
import { DeleteClienteButton } from "@/components/clientes/delete-cliente-button"
import { EditarClienteButton } from "@/components/clientes/editar-cliente-button"

export const metadata: Metadata = {
  title: "Cliente",
}

type Endereco = {
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireCurrentUser()
  const { id } = await params

  if (!can(user, "clientes", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver clientes.
      </div>
    )
  }

  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      "id, nome, email, telefone_ddi, telefone, cpf, data_nascimento, passaporte, endereco, origem, tipo, dia_faturamento, status, observacoes, created_at, updated_at, empresa_id, tipo_pessoa, cnpj, razao_social, nome_fantasia, responsavel",
    )
    .eq("id", id)
    .maybeSingle()

  if (!cliente) notFound()

  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome")
    .eq("id", cliente.empresa_id)
    .single()

  // Empresas disponíveis pro modal de edição (Admin Master vê todas; outros, suas)
  const empresasParaModal = user.acessaTodasEmpresas
    ? (
        await supabase
          .from("empresas")
          .select("id, nome")
          .eq("ativo", true)
          .order("nome")
      ).data ?? []
    : user.empresas.map((e) => ({ id: e.id, nome: e.nome }))
  const lockEmpresaModal =
    !user.acessaTodasEmpresas && user.empresas.length === 1

  const endereco = (cliente.endereco as Endereco | null) ?? {}
  const hasEndereco = Object.values(endereco).some((v) => v)

  // Contagem de vendas (V1.0 stub — vendas ainda não implementadas em UI)
  const { count: vendasCount } = await supabase
    .from("vendas")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/clientes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Clientes
        </Link>

        <div className="flex items-center gap-2">
          {can(user, "clientes", "editar") && (
            <EditarClienteButton
              id={cliente.id}
              initial={{
                empresa_id: cliente.empresa_id,
                tipo_pessoa: (cliente.tipo_pessoa === "juridica"
                  ? "juridica"
                  : "fisica") as "fisica" | "juridica",
                nome: cliente.nome,
                cpf: cliente.cpf ?? "",
                data_nascimento: cliente.data_nascimento ?? "",
                passaporte: cliente.passaporte ?? "",
                razao_social: cliente.razao_social ?? "",
                nome_fantasia: cliente.nome_fantasia ?? "",
                cnpj: cliente.cnpj ?? "",
                responsavel: cliente.responsavel ?? "",
                email: cliente.email,
                telefone_ddi: cliente.telefone_ddi ?? "+55",
                telefone: cliente.telefone,
                endereco: (cliente.endereco as ClienteFormValues["endereco"]) ?? {},
                origem: cliente.origem ?? "",
                tipo: cliente.tipo as TipoCliente,
                dia_faturamento: cliente.dia_faturamento ?? undefined,
                status: cliente.status as StatusCliente,
                observacoes: cliente.observacoes ?? "",
              }}
              empresas={empresasParaModal}
              defaultEmpresaId={cliente.empresa_id}
              lockEmpresa={lockEmpresaModal}
            />
          )}
          {can(user, "clientes", "excluir") && (
            <DeleteClienteButton clienteId={cliente.id} clienteNome={cliente.nome} />
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h2>
          <TipoClienteBadge tipo={cliente.tipo as TipoCliente} />
          <StatusClienteBadge status={cliente.status as StatusCliente} />
        </div>
        <p className="text-sm text-muted-foreground">
          {empresa?.nome} · CPF {formatCpf(cliente.cpf)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="E-mail">
              <a className="text-foreground hover:underline" href={`mailto:${cliente.email}`}>
                {cliente.email}
              </a>
            </Row>
            <Row icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="Telefone">
              {formatTelefone(cliente.telefone)}
            </Row>
            {cliente.data_nascimento && (
              <Row icon={<User2 className="h-4 w-4 text-muted-foreground" />} label="Nascimento">
                {formatDateBr(cliente.data_nascimento)}
              </Row>
            )}
            {cliente.passaporte && (
              <Row label="Passaporte">{cliente.passaporte}</Row>
            )}
            {cliente.origem && (
              <Row label="Origem">{cliente.origem}</Row>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Tipo">
              <TipoClienteBadge tipo={cliente.tipo as TipoCliente} />
            </Row>
            {cliente.tipo === "faturado" && cliente.dia_faturamento && (
              <Row label="Dia de faturamento">
                Dia {cliente.dia_faturamento} de cada mês
              </Row>
            )}
            <Row label="Status">
              <StatusClienteBadge status={cliente.status as StatusCliente} />
            </Row>
            <Row label="Cadastrado em">{formatDateBr(cliente.created_at)}</Row>
          </CardContent>
        </Card>

        {hasEndereco && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Endereço</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <Row icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="">
                <div className="space-y-0.5">
                  {(endereco.rua || endereco.numero) && (
                    <p>
                      {endereco.rua}
                      {endereco.numero && `, ${endereco.numero}`}
                      {endereco.complemento && ` — ${endereco.complemento}`}
                    </p>
                  )}
                  {endereco.bairro && <p className="text-muted-foreground">{endereco.bairro}</p>}
                  {(endereco.cidade || endereco.estado) && (
                    <p>
                      {endereco.cidade}
                      {endereco.estado && ` — ${endereco.estado}`}
                    </p>
                  )}
                  {endereco.cep && <p className="text-muted-foreground">CEP {endereco.cep}</p>}
                </div>
              </Row>
            </CardContent>
          </Card>
        )}

        {cliente.observacoes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{cliente.observacoes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {(vendasCount ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente ainda não tem vendas registradas.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {vendasCount}{" "}
              {vendasCount === 1 ? "venda registrada" : "vendas registradas"}.
              A listagem detalhada será exibida quando o módulo de Vendas for entregue.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="flex-1">
        {label && (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        )}
        <div>{children}</div>
      </div>
    </div>
  )
}
