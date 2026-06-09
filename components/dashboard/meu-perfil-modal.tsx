"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  TriangleAlert,
  User2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoaderButton } from "@/components/ui/loader-button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { atualizarFotoUsuario } from "@/app/(dashboard)/usuarios/actions"
import { atualizarMeuNome, alterarSenhaEDeslogar } from "@/app/(dashboard)/actions"
import { cn } from "@/lib/utils"
import { derivarIniciais } from "@/lib/utils/password"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  nome: string
  iniciais: string | null
  foto_url: string | null
}

type PasswordReq = { label: string; ok: boolean }

export function MeuPerfilModal({ open, onOpenChange, userId, nome, iniciais, foto_url }: Props) {
  const router = useRouter()

  // ── Dados ─────────────────────────────────────────────────────────────────
  const [nomeV, setNomeV] = useState(nome)
  const [nomeError, setNomeError] = useState("")
  const [isPendingDados, startDados] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoExistente, setFotoExistente] = useState<string | null>(foto_url)
  const [fotoRemovida, setFotoRemovida] = useState(false)

  const fotoAtual = fotoPreview ?? (fotoRemovida ? null : fotoExistente)
  const previewIniciais = derivarIniciais(nomeV) || iniciais || nome.charAt(0).toUpperCase()

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    }
  }, [fotoPreview])

  // ── Senha ─────────────────────────────────────────────────────────────────
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [senhaErrors, setSenhaErrors] = useState<Record<string, string>>({})
  const [isPendingSenha, startSenha] = useTransition()
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)

  const reqs: PasswordReq[] = [
    { label: "Mínimo 6 caracteres", ok: novaSenha.length >= 6 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(novaSenha) },
    { label: "Letra minúscula", ok: /[a-z]/.test(novaSenha) },
    { label: "Número", ok: /[0-9]/.test(novaSenha) },
    { label: "Caractere especial", ok: /[^A-Za-z0-9]/.test(novaSenha) },
  ]

  // ── Reset ao abrir ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setNomeV(nome)
    setNomeError("")
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview(null)
    setFotoExistente(foto_url)
    setFotoRemovida(false)
    setSenhaAtual("")
    setNovaSenha("")
    setConfirmarSenha("")
    setSenhaErrors({})
    setShowSenhaAtual(false)
    setShowNovaSenha(false)
    setShowConfirmar(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Foto ──────────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2 MB.")
      return
    }
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    setFotoRemovida(false)
    e.target.value = ""
  }

  function removerFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview(null)
    setFotoRemovida(true)
  }

  // ── Salvar dados ──────────────────────────────────────────────────────────
  function handleSalvarDados(e: React.FormEvent) {
    e.preventDefault()
    setNomeError("")

    startDados(async () => {
      if (fotoFile || fotoRemovida) {
        const fd = new FormData()
        if (fotoRemovida) fd.set("remover", "true")
        else if (fotoFile) fd.set("foto", fotoFile)

        const r = await atualizarFotoUsuario(userId, fd)
        if (!r.ok) { toast.error(r.error); return }
        const novaUrl = r.data?.foto_url ?? null
        setFotoExistente(novaUrl)
        if (fotoPreview) URL.revokeObjectURL(fotoPreview)
        setFotoFile(null)
        setFotoPreview(null)
        setFotoRemovida(false)
      }

      const nomeTrimmed = nomeV.trim()
      if (nomeTrimmed !== nome) {
        const r = await atualizarMeuNome(nomeTrimmed)
        if (!r.ok) { setNomeError(r.error); return }
      }

      toast.success("Dados atualizados com sucesso!")
      router.refresh()
    })
  }

  // ── Alterar senha ─────────────────────────────────────────────────────────
  function handleAlterarSenha() {
    setSenhaErrors({})

    startSenha(async () => {
      const r = await alterarSenhaEDeslogar({
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
        confirmar_senha: confirmarSenha,
      })

      if (!r.ok) {
        setSenhaErrors(r.fieldErrors ?? {})
        toast.error(r.error)
        return
      }

      toast.success("Senha alterada. Faça login novamente.")
      router.push("/login")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <User2 className="h-4 w-4 text-nexus-bright" />
            Meu Perfil
          </DialogTitle>
          <DialogDescription>
            Atualize seu nome e foto de perfil. Para alterar a senha, preencha a seção abaixo.
          </DialogDescription>
        </DialogHeader>

        {/* ── Formulário de dados ───────────────────────────────────────── */}
        <form onSubmit={handleSalvarDados} className="space-y-5">
          {/* Avatar + nome — mesmo card do modal de usuário */}
          <div className="flex items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={fotoAtual ? "Clique para trocar a foto" : "Clique para adicionar foto"}
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold",
                  fotoAtual
                    ? "border-white/15 bg-white/[0.04] text-white"
                    : "border-nexus-bright/30 bg-nexus-bright/15 text-nexus-bright",
                )}
              >
                {fotoAtual ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoAtual}
                    alt={nomeV || "Avatar"}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  previewIniciais
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </button>

              {fotoAtual && (
                <button
                  type="button"
                  onClick={removerFoto}
                  title="Remover foto"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-card text-white/60 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex-1 space-y-1">
              <Input
                value={nomeV}
                onChange={(e) => { setNomeV(e.target.value); if (nomeError) setNomeError("") }}
                placeholder="Nome completo"
                className="border-white/10 bg-white/[0.04] placeholder:text-white/30"
                required
              />
              <p className="text-[11px] text-white/35">
                {fotoAtual
                  ? "JPG, PNG ou WebP · máx. 2 MB"
                  : "Clique na foto para adicionar · JPG, PNG ou WebP · máx. 2 MB"}
              </p>
              {nomeError && <p className="text-[11px] text-destructive">{nomeError}</p>}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" type="button" disabled={isPendingDados}>
                Fechar
              </Button>
            </DialogClose>
            <LoaderButton
              type="submit"
              loading={isPendingDados}
              className="bg-nexus-bright text-white hover:bg-nexus-bright/90"
            >
              Salvar
            </LoaderButton>
          </DialogFooter>
        </form>

        {/* ── Separador Segurança ───────────────────────────────────────── */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/[0.06]" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
            <span className="bg-background px-3 text-white/30">Segurança</span>
          </div>
        </div>

        {/* ── Seção de senha ────────────────────────────────────────────── */}
        <div className="space-y-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-snug text-amber-300/90">
              Ao alterar a senha você será desconectado e precisará fazer login novamente.
            </p>
          </div>

          {/* Senha atual */}
          <PasswordField
            label="Senha atual"
            id="senha-atual"
            value={senhaAtual}
            onChange={(v) => { setSenhaAtual(v); if (senhaErrors.senha_atual) setSenhaErrors((s) => ({ ...s, senha_atual: "" })) }}
            show={showSenhaAtual}
            onToggleShow={() => setShowSenhaAtual((s) => !s)}
            error={senhaErrors.senha_atual}
          />

          {/* Nova senha */}
          <div>
            <PasswordField
              label="Nova senha"
              id="nova-senha"
              value={novaSenha}
              onChange={(v) => { setNovaSenha(v); if (senhaErrors.nova_senha) setSenhaErrors((s) => ({ ...s, nova_senha: "" })) }}
              show={showNovaSenha}
              onToggleShow={() => setShowNovaSenha((s) => !s)}
              error={senhaErrors.nova_senha}
            />
            {novaSenha.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {reqs.map((r) => (
                  <span
                    key={r.label}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] transition-colors",
                      r.ok ? "text-emerald-400" : "text-white/35",
                    )}
                  >
                    <span className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                      r.ok ? "border-emerald-500/50 bg-emerald-500/15" : "border-white/15 bg-white/[0.03]",
                    )}>
                      {r.ok && <Check className="h-2 w-2 text-emerald-400" strokeWidth={3} />}
                    </span>
                    {r.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Confirmar senha */}
          <PasswordField
            label="Confirmar nova senha"
            id="confirmar-senha"
            value={confirmarSenha}
            onChange={(v) => { setConfirmarSenha(v); if (senhaErrors.confirmar_senha) setSenhaErrors((s) => ({ ...s, confirmar_senha: "" })) }}
            show={showConfirmar}
            onToggleShow={() => setShowConfirmar((s) => !s)}
            error={senhaErrors.confirmar_senha}
          />

          <LoaderButton
            loading={isPendingSenha}
            onClick={handleAlterarSenha}
            disabled={!senhaAtual || !novaSenha || !confirmarSenha}
            className="w-full border border-amber-500/20 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/35 hover:bg-amber-500/15 hover:text-amber-200"
            variant="ghost"
          >
            Alterar Senha e Sair
          </LoaderButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PasswordField({
  label,
  id,
  value,
  onChange,
  show,
  onToggleShow,
  error,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  error?: string
}) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55"
      >
        <KeyRound className="h-3 w-3" />
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="pr-10"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/45 hover:bg-white/[0.06] hover:text-white"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
