"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/(dashboard)/actions"

type Props = {
  nome: string
  iniciais: string | null
  email: string
  perfil: string
}

export function UserMenu({ nome, iniciais, email, perfil }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {iniciais ?? nome.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col text-sm">
          <span className="font-medium leading-tight">{nome}</span>
          <span className="text-xs leading-tight text-muted-foreground">
            {perfil} · {email}
          </span>
        </div>
      </div>

      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="icon" title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
