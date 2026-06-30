"use client"

import { useState } from "react"
import { toast } from "sonner"

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback
  const m = /filename="?([^"]+)"?/.exec(header)
  return m?.[1] ?? fallback
}

/**
 * Lógica compartilhada de exportação de relatórios.
 *  - `exportarExcel`: POST → baixa o .xlsx (com estado de loading).
 *  - `abrirPdf`: abre a rota GET do PDF em nova aba (visualização inline).
 */
export function useRelatorioExport() {
  const [baixandoExcel, setBaixandoExcel] = useState(false)

  async function exportarExcel(
    path: string,
    body: Record<string, unknown>,
    fallbackName: string,
  ) {
    setBaixandoExcel(true)
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(j?.error ?? "Não foi possível gerar a planilha.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const nome = filenameFromHeader(res.headers.get("Content-Disposition"), fallbackName)
      const a = document.createElement("a")
      a.href = url
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast.success("Planilha gerada com sucesso.")
    } catch {
      toast.error("Falha de rede ao gerar a planilha.")
    } finally {
      setBaixandoExcel(false)
    }
  }

  function abrirPdf(path: string, params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString()
    window.open(`${path}?${qs}`, "_blank", "noopener,noreferrer")
    toast.success("Abrindo PDF em nova aba…")
  }

  return { baixandoExcel, exportarExcel, abrirPdf }
}
