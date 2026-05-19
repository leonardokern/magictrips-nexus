import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar",
}

type Props = {
  searchParams: Promise<{ erro?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { erro } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold">Compass</CardTitle>
          <CardDescription>
            Plataforma interna da MagicTrips e Del Mondo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm avisoInativo={erro === "inativo"} />
        </CardContent>
      </Card>
    </div>
  )
}
