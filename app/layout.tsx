import type { Metadata } from "next"
import NextTopLoader from "nextjs-toploader"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Nexus",
    template: "Nexus",
  },
  description: "Plataforma interna da Magic Trips Brasil",
  openGraph: {
    title: "Nexus",
    description: "Plataforma interna da Magic Trips Brasil",
    url: "https://nexus.magictrips.com.br",
    siteName: "Nexus",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Nexus — Magic Trips",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
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
