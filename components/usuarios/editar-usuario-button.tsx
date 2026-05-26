"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UsuarioFormModal } from "./usuario-form-modal"

type Perfil = { id: string; nome: string; empresa_id: string | null }
type Empresa = { id: string; nome: string; slug: string }

type Props = {
  id: string
  initial: {
    nome: string
    email: string
    perfil_id: string
    empresa_ids: string[]
    foto_url?: string | null
  }
  perfis: Perfil[]
  empresas: Empresa[]
}

export function EditarUsuarioButton({ id, initial, perfis, empresas }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
      >
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Button>
      <UsuarioFormModal
        mode="edit"
        id={id}
        initial={initial}
        open={open}
        onOpenChange={setOpen}
        perfis={perfis}
        empresas={empresas}
      />
    </>
  )
}
