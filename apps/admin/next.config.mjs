// AgeKey admin Next.js config.
//
// API gateway (AK-P0-03): quando hospedado em `api.agekey.com.br`, o
// admin reescreve `/v1/:path*` (contrato público novo) E
// `/functions/v1/:path*` (path legado usado pelos SDKs mobile já em
// produção — sdk-mobile/ios/AgeKeySwift/Sources/AgeKeySwift/AgeKeyClient.swift
// e sdk-mobile/android/agekey-android/agekey/src/main/java/.../AgeKeyClient.kt)
// para `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/:path*`.
//
// SUPABASE_PROJECT_REF é uma env var server-only (NÃO `NEXT_PUBLIC_*`)
// definida no scope Production do Vercel. Sem ela, o build falha
// imediatamente — preferimos quebrar barulhento a deploy silenciosamente
// um proxy não-roteável.
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const ENABLE_API_GATEWAY = process.env.ENABLE_API_GATEWAY === 'true';

if (ENABLE_API_GATEWAY && !SUPABASE_PROJECT_REF) {
  throw new Error(
    'ENABLE_API_GATEWAY=true mas SUPABASE_PROJECT_REF está vazio. ' +
      'Defina SUPABASE_PROJECT_REF no scope Production do Vercel (server-only) ' +
      'antes de habilitar o gateway api.agekey.com.br.',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Allow importing TypeScript from workspace packages without pre-build.
    externalDir: true,
  },
  // Workspace transpilation: @agekey/shared ships .ts directly.
  transpilePackages: ['@agekey/shared'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async rewrites() {
    if (!ENABLE_API_GATEWAY) {
      return [];
    }
    const upstream = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1`;
    return [
      // Contrato público canônico (AK-P0-03): /v1/* — usar nos novos SDKs.
      {
        source: '/v1/:path*',
        destination: `${upstream}/:path*`,
        has: [{ type: 'host', value: 'api.agekey.com.br' }],
      },
      // Compat com SDKs já distribuídos (iOS/Android v0.x): /functions/v1/*.
      // Manter por ≥ 12 meses ou até versão major do SDK que migre para /v1/.
      {
        source: '/functions/v1/:path*',
        destination: `${upstream}/:path*`,
        has: [{ type: 'host', value: 'api.agekey.com.br' }],
      },
    ];
  },
};

export default nextConfig;
