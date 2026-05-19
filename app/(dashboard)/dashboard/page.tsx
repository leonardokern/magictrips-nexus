import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"

export const metadata: Metadata = {
  title: "Início",
}

export default async function DashboardPage() {
  const user = await requireCurrentUser()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Olá, {user.nome.split(" ")[0]} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          Bem-vindo ao Compass. Os módulos serão liberados conforme cada feature for entregue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{user.perfil.nome}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {user.empresa?.nome ?? "Todas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">Ativo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximos passos (V1.0)</CardTitle>
          <CardDescription>
            Roadmap dos módulos a serem entregues nesta fase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• CRUD de clientes (regular + faturado)</li>
            <li>• CRUD de fornecedores</li>
            <li>• Tipos de produto + campos dinâmicos</li>
            <li>• Relatório de Venda (cabeçalho + N produtos + cobrança)</li>
            <li>• Workflow de aprovação Agente → Gerente</li>
            <li>• Exportação CSV/Excel para Otoos</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
