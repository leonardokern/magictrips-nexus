"use client"

import { useRef, useState } from "react"
import {
  FileUp,
  Link2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  Sparkles,
  ArrowRight,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoaderButton } from "@/components/ui/loader-button"
import {
  uploadCotacaoPDF,
  extrairDadosCotacao,
  fetchUrlCotacao,
  type CotacaoExtraida,
  type ProdutoExtraido,
} from "@/app/(dashboard)/propostas/cotacoes-actions"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type State =
  | { mode: "idle" }
  | { mode: "uploading" }
  | { mode: "fetching" }
  | { mode: "uploaded"; cotacaoId: string; nomeArquivo: string }
  | { mode: "analyzing" }
  | { mode: "spa"; mensagem: string }
  | { mode: "preview"; dados: CotacaoExtraida; cotacaoId: string }
  | { mode: "error"; mensagem: string }

type Aba = "pdf" | "url"

type Props = {
  /** Chamado quando o agente clica em "Aplicar dados à proposta". */
  onAplicar: (dados: CotacaoExtraida) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function resumoProdutos(produtos: ProdutoExtraido[]): string {
  const grupos: Record<string, number> = {}
  for (const p of produtos) {
    grupos[p.tipoProdutoNome] = (grupos[p.tipoProdutoNome] ?? 0) + 1
  }
  return Object.entries(grupos)
    .map(([tipo, qtd]) => `${qtd}× ${tipo}`)
    .join(" · ")
}

function totalProdutos(produtos: ProdutoExtraido[]): string {
  const total = produtos.reduce((sum, p) => {
    if (!p.valorVendaStr) return sum
    const n = parseFloat(
      p.valorVendaStr.replace(/\./g, "").replace(",", "."),
    )
    return sum + (isNaN(n) ? 0 : n)
  }, 0)
  if (total === 0) return ""
  return total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  })
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CotacaoUploader({ onAplicar }: Props) {
  const [aberta, setAberta] = useState(false)
  const [aba, setAba] = useState<Aba>("pdf")
  const [state, setState] = useState<State>({ mode: "idle" })
  const [urlInput, setUrlInput] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── PDF handlers ────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos.")
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo maior que 20 MB.")
      return
    }

    setState({ mode: "uploading" })

    const fd = new FormData()
    fd.append("file", file)
    const result = await uploadCotacaoPDF(fd)

    if (!result.ok) {
      setState({ mode: "error", mensagem: result.error })
      return
    }

    setState({
      mode: "uploaded",
      cotacaoId: result.data.cotacaoId,
      nomeArquivo: file.name,
    })
  }

  async function handleAnalisar() {
    if (state.mode !== "uploaded") return
    const { cotacaoId } = state
    setState({ mode: "analyzing" })
    const resultado = await extrairDadosCotacao(cotacaoId)

    if (resultado.tipo === "concluido") {
      setState({ mode: "preview", dados: resultado.dados, cotacaoId })
    } else {
      setState({ mode: "error", mensagem: resultado.mensagem })
    }
  }

  // ── URL handlers ────────────────────────────────────────────────────────

  async function handleFetchUrl() {
    const url = urlInput.trim()
    if (!url) return

    setState({ mode: "fetching" })
    const resultado = await fetchUrlCotacao(url)

    if (resultado.tipo === "concluido") {
      setState({ mode: "preview", dados: resultado.dados, cotacaoId: resultado.cotacaoId })
    } else if (resultado.tipo === "spa") {
      setState({ mode: "spa", mensagem: resultado.mensagem })
    } else {
      setState({ mode: "error", mensagem: resultado.mensagem })
    }
  }

  // ── Aplicar dados ───────────────────────────────────────────────────────

  function handleAplicar() {
    if (state.mode !== "preview") return
    onAplicar(state.dados)
    toast.success("Dados da cotação aplicados à proposta.")
    resetarTudo()
  }

  function resetarTudo() {
    setState({ mode: "idle" })
    setUrlInput("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    setAberta(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const isLoading =
    state.mode === "uploading" ||
    state.mode === "fetching" ||
    state.mode === "analyzing"

  return (
    <div className="rounded-xl border border-nexus-bright/20 bg-nexus-bright/[0.03]">
      {/* Cabeçalho colapsável */}
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-nexus-bright/[0.04]"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-nexus-bright" />
          <span className="text-sm font-medium text-white">
            Importar cotação de fornecedor com IA
          </span>
          <span className="rounded-full bg-nexus-bright/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nexus-bright">
            Novo
          </span>
        </div>
        <span className={cn("text-white/40 transition-transform", aberta ? "rotate-180" : "")}>
          ▾
        </span>
      </button>

      {aberta && (
        <div className="border-t border-nexus-bright/10 px-4 pb-4 pt-3">
          {/* Abas */}
          <div className="mb-4 flex gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
            {(["pdf", "url"] as Aba[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => { setAba(a); setState({ mode: "idle" }) }}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                  aba === a
                    ? "bg-nexus-bright text-white"
                    : "text-white/50 hover:text-white/80",
                )}
              >
                {a === "pdf" ? <FileUp className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                {a === "pdf" ? "Upload de PDF" : "Cole a URL"}
              </button>
            ))}
          </div>

          {/* Conteúdo da aba */}
          {aba === "pdf" && (
            <PdfPane
              state={state}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              onAnalisar={handleAnalisar}
              onAplicar={handleAplicar}
              onDescartar={resetarTudo}
            />
          )}
          {aba === "url" && (
            <UrlPane
              state={state}
              urlInput={urlInput}
              setUrlInput={setUrlInput}
              onFetch={handleFetchUrl}
              onAplicar={handleAplicar}
              onDescartar={resetarTudo}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Aba PDF ──────────────────────────────────────────────────────────────────

function PdfPane({
  state,
  fileInputRef,
  onFileChange,
  onAnalisar,
  onAplicar,
  onDescartar,
}: {
  state: State
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAnalisar: () => void
  onAplicar: () => void
  onDescartar: () => void
}) {
  function openFile() {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Drop zone / status */}
      {(state.mode === "idle" || state.mode === "uploading") && (
        <button
          type="button"
          onClick={openFile}
          disabled={state.mode === "uploading"}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed py-8 text-center transition-colors",
            "border-white/10 bg-white/[0.02] text-white/40",
            state.mode !== "uploading" && "hover:border-nexus-bright/40 hover:bg-nexus-bright/[0.04] hover:text-white/70",
            state.mode === "uploading" && "cursor-not-allowed opacity-60",
          )}
        >
          {state.mode === "uploading" ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-nexus-bright" />
              <span className="text-sm">Enviando…</span>
            </>
          ) : (
            <>
              <FileUp className="h-7 w-7" />
              <span className="text-sm">
                Arraste um PDF ou <span className="text-nexus-bright">clique para selecionar</span>
              </span>
              <span className="text-xs text-white/30">Máximo 20 MB · Apenas PDF</span>
            </>
          )}
        </button>
      )}

      {/* Arquivo enviado — aguardando análise */}
      {state.mode === "uploaded" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <FileText className="h-5 w-5 shrink-0 text-nexus-bright" />
            <span className="flex-1 truncate text-sm text-white">{state.nomeArquivo}</span>
            <button type="button" onClick={onDescartar} className="text-white/35 hover:text-white/70">
              <X className="h-4 w-4" />
            </button>
          </div>
          <LoaderButton loading={false} onClick={onAnalisar} className="w-full bg-nexus-bright hover:bg-nexus-bright/90">
            <Sparkles className="mr-1.5 h-4 w-4" />
            Analisar com IA
          </LoaderButton>
        </div>
      )}

      {/* Analisando */}
      {state.mode === "analyzing" && <AnalizandoCard />}

      {/* Preview */}
      {state.mode === "preview" && (
        <PreviewCard dados={state.dados} onAplicar={onAplicar} onDescartar={onDescartar} />
      )}

      {/* Erro */}
      {state.mode === "error" && (
        <ErrorCard mensagem={state.mensagem} onDescartar={onDescartar} />
      )}
    </div>
  )
}

// ─── Aba URL ──────────────────────────────────────────────────────────────────

function UrlPane({
  state,
  urlInput,
  setUrlInput,
  onFetch,
  onAplicar,
  onDescartar,
}: {
  state: State
  urlInput: string
  setUrlInput: (v: string) => void
  onFetch: () => void
  onAplicar: () => void
  onDescartar: () => void
}) {
  const isLoading = state.mode === "fetching" || state.mode === "analyzing"

  return (
    <div className="space-y-3">
      {/* Input + botão */}
      {(state.mode === "idle" || state.mode === "error" || state.mode === "spa") && (
        <>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://ag00080423-hoteldo.e-agencias.com/quotations/..."
              className="flex-1 font-mono text-xs"
              onKeyDown={(e) => e.key === "Enter" && onFetch()}
            />
            <Button
              type="button"
              onClick={onFetch}
              disabled={!urlInput.trim()}
              className="shrink-0 bg-nexus-bright hover:bg-nexus-bright/90"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Aviso padrão sobre SPAs */}
          <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
            <p className="text-xs text-amber-200/80">
              <strong className="text-amber-200">Atenção:</strong> Plataformas como HotelDO e Infotravel carregam os dados via JavaScript.
              Se a análise falhar, abra a cotação no navegador →{" "}
              <strong>Ctrl+P → Salvar como PDF</strong> → faça o upload na aba <strong>PDF</strong>.
            </p>
          </div>
        </>
      )}

      {/* Loading */}
      {state.mode === "fetching" && (
        <div className="flex items-center gap-2 py-4 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin text-nexus-bright" />
          Buscando conteúdo da URL…
        </div>
      )}
      {state.mode === "analyzing" && <AnalizandoCard />}

      {/* SPA detectado */}
      {state.mode === "spa" && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-medium text-amber-200">Página com carregamento dinâmico</span>
          </div>
          <p className="text-xs text-amber-200/70">{state.mensagem}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDescartar}
            className="mt-2 h-7 px-2 text-xs text-amber-200/60 hover:text-amber-200"
          >
            Tentar outra URL
          </Button>
        </div>
      )}

      {/* Preview */}
      {state.mode === "preview" && (
        <PreviewCard dados={state.dados} onAplicar={onAplicar} onDescartar={onDescartar} />
      )}

      {/* Erro */}
      {state.mode === "error" && !isLoading && (
        <ErrorCard mensagem={state.mensagem} onDescartar={onDescartar} />
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function AnalizandoCard() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-nexus-bright/20 bg-nexus-bright/[0.05] px-4 py-4">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-nexus-bright" />
      <div>
        <p className="text-sm font-medium text-white">Analisando com IA…</p>
        <p className="text-xs text-white/45">
          Claude está lendo o documento e extraindo os dados da cotação.
        </p>
      </div>
    </div>
  )
}

function PreviewCard({
  dados,
  onAplicar,
  onDescartar,
}: {
  dados: CotacaoExtraida
  onAplicar: () => void
  onDescartar: () => void
}) {
  const total = totalProdutos(dados.produtos)
  const resumo = resumoProdutos(dados.produtos)

  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-200">
          Cotação analisada
          {dados.fornecedorDetectado && (
            <span className="ml-1.5 text-white/50">· {dados.fornecedorDetectado}</span>
          )}
        </span>
      </div>

      <div className="space-y-1 text-xs text-white/70">
        {dados.clienteNome && (
          <p>
            <span className="text-white/40">Cliente:</span>{" "}
            <span className="text-white">{dados.clienteNome}</span>
          </p>
        )}
        {(dados.origem || dados.destino) && (
          <p>
            <span className="text-white/40">Roteiro:</span>{" "}
            <span className="text-white">
              {[dados.origem, dados.destino].filter(Boolean).join(" → ")}
            </span>
          </p>
        )}
        {dados.validadeStr && (
          <p>
            <span className="text-white/40">Validade:</span>{" "}
            <span className="text-white">{dados.validadeStr}</span>
          </p>
        )}
        {resumo && (
          <p>
            <span className="text-white/40">Produtos:</span>{" "}
            <span className="text-white">{resumo}</span>
          </p>
        )}
        {total && (
          <p>
            <span className="text-white/40">Total estimado:</span>{" "}
            <span className="font-semibold text-white">{total}</span>
          </p>
        )}
      </div>

      <p className="mt-2 text-[11px] text-white/35">
        Revise os dados no formulário após aplicar — valores são estimativas baseadas no documento.
      </p>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onAplicar}
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          Aplicar dados à proposta
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDescartar}
          className="text-white/40 hover:text-white/70"
        >
          Descartar
        </Button>
      </div>
    </div>
  )
}

function ErrorCard({
  mensagem,
  onDescartar,
}: {
  mensagem: string
  onDescartar: () => void
}) {
  return (
    <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-400" />
        <span className="text-sm font-medium text-rose-300">Falha na análise</span>
      </div>
      <p className="text-xs text-rose-300/70">{mensagem}</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDescartar}
        className="mt-2 h-7 px-2 text-xs text-rose-300/60 hover:text-rose-300"
      >
        Tentar novamente
      </Button>
    </div>
  )
}
