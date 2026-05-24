/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @react-pdf/renderer usa módulos Node.js (canvas, etc.) —
  // precisa ficar fora do bundle do servidor para não quebrar.
  serverExternalPackages: ["@react-pdf/renderer"],
}

export default nextConfig
