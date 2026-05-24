import type { Metadata } from "next"
import NextTopLoader from "nextjs-toploader"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Nexus — Magic Trips",
    template: "%s · Nexus",
  },
  description: "Plataforma interna de gestão da Magic Trips e Del Mondo.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Top progress bar — dispara imediato a cada navegação, dá feedback
            entre o clique e o conteúdo aparecer. Cor na paleta Nexus. */}
        <NextTopLoader
          color="#1498D5"
          height={3}
          showSpinner={false}
          shadow="0 0 10px #1498D5, 0 0 5px #1498D5"
        />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
