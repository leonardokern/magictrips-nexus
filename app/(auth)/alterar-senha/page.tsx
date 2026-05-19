import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Alterar senha",
}

export default function AlterarSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold">Alterar senha</CardTitle>
          <CardDescription>
            Você precisa criar uma nova senha antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Formulário será implementado em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
