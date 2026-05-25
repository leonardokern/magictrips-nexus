/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ESLint não bloqueia o build — erros de lint não devem travar produção.
  // TypeScript continua rodando e catching erros de tipo reais.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // @react-pdf/renderer usa módulos Node.js (canvas, etc.) —
  // precisa ficar fora do bundle do servidor para não quebrar.
  // Next 14: vai dentro de `experimental.serverComponentsExternalPackages`.
  // (Em Next 15 vira `serverExternalPackages` no topo — migrar quando subir versão.)
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
}

export default nextConfig
