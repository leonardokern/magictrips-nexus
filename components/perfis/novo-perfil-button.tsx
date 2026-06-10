"use client"

import { useState } from "react"
import { Copy, FilePlus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PerfilFormModal } from "./perfil-form-modal"
import type { PermissoesValue } from "@/lib/schemas/perfil"

type Empresa = { id: string; nome: string; slug: string }
type PerfilOpcao = { id: string; nome: string; permissoes: PermissoesValue }

export function NovoPerfilButton({
  empresas,
  perfis,
  agendaEnabled,
  propostasEnabled,
}: {
  empresas: Empresa[]
  perfis?: PerfilOpcao[]
  agendaEnabled?: boolean
  propostasEnabled?: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [origem, setOrigem] = useState<"zero" | "copia">("zero")
  const [origemPerfilId, setOrigemPerfilId] = useState<string>("")
  const [initialPermissoes, setInitialPermissoes] = useState<PermissoesValue | undefined>()

  function abrirPicker() {
    setOrigem("zero")
    setOrigemPerfilId("")
    setPickerOpen(true)
  }

  function continuar() {
    if (origem === "copia") {
      const perfil = perfis?.find((p) => p.id === origemPerfilId)
      setInitialPermissoes(perfil?.permissoes)
    } else {
      setInitialPermissoes(undefined)
    }
    setPickerOpen(false)
    setFormOpen(true)
  }

  const podeContinar =
    origem === "zero" || (origem === "copia" && origemPerfilId !== "")

  return (
    <>
      <Button
        onClick={abrirPicker}
        className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
      >
        <Plus className="mr-2 h-4 w-4" />
        Novo perfil
      </Button>

      {/* Picker: do zero ou copiar */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="w-[95vw] max-w-sm gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-white/[0.06] px-5 py-4">
            <DialogTitle className="text-base">Novo perfil de acesso</DialogTitle>
          </DialogHeader>

          <div className="space-y-2.5 px-5 py-5">
            <OpçãoCard
              ativo={origem === "zero"}
              onClick={() => setOrigem("zero")}
              icon={<FilePlus className="h-4 w-4" />}
              titulo="Do zero"
              descricao="Começa com todas as permissões desmarcadas."
            />
            <OpçãoCard
              ativo={origem === "copia"}
              onClick={() => { setOrigem("copia"); if (!origemPerfilId && perfis?.[0]) setOrigemPerfilId(perfis[0].id) }}
              icon={<Copy className="h-4 w-4" />}
              titulo="A partir de um perfil existente"
              descricao="Copia as permissões de outro perfil como ponto de partida."
            />

            {origem === "copia" && perfis && perfis.length > 0 && (
              <div className="pt-1">
                <Select value={origemPerfilId} onValueChange={setOrigemPerfilId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o perfil de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {perfis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 border-t border-white/[0.06] bg-card/95 px-5 py-3 backdrop-blur">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPickerOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!podeContinar}
              onClick={continuar}
              className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PerfilFormModal
        mode="create"
        initialPermissoes={initialPermissoes}
        open={formOpen}
        onOpenChange={setFormOpen}
        empresas={empresas}
        agendaEnabled={agendaEnabled}
        propostasEnabled={propostasEnabled}
      />
    </>
  )
}

function OpçãoCard({
  ativo,
  onClick,
  icon,
  titulo,
  descricao,
}: {
  ativo: boolean
  onClick: () => void
  icon: React.ReactNode
  titulo: string
  descricao: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={
        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all " +
        (ativo
          ? "border-nexus-bright/40 bg-nexus-bright/10 ring-1 ring-nexus-bright/30"
          : "border-white/10 bg-white/[0.02] hover:border-white/20")
      }
    >
      <span
        className={
          "mt-0.5 shrink-0 rounded-md p-1.5 " +
          (ativo
            ? "bg-nexus-bright/20 text-nexus-bright"
            : "bg-white/[0.05] text-white/55")
        }
      >
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{titulo}</p>
        <p className="mt-0.5 text-xs text-white/55">{descricao}</p>
      </div>
    </button>
  )
}
