import 'server-only';

function require_(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const agekeyEnv = {
  apiBase: () => require_('NEXT_PUBLIC_AGEKEY_API_BASE'),
  issuer: () =>
    process.env.NEXT_PUBLIC_AGEKEY_ISSUER ?? 'https://staging.agekey.com.br',
  // Server-only: injected via Server Actions / Route Handlers.
  // Never read in Client Components.
  adminApiKey: () => require_('AGEKEY_ADMIN_API_KEY'),
};
