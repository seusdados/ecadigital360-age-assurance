// Shared environment variable accessor with validation.
// All Edge Functions read config through here — never directly via Deno.env.

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type RequiredEnv = (typeof required)[number];

const cache = new Map<string, string>();

function readEnv(name: string): string | undefined {
  if (cache.has(name)) return cache.get(name);
  const v = Deno.env.get(name);
  if (v !== undefined) cache.set(name, v);
  return v;
}

export function requireEnv(name: RequiredEnv | string): string {
  const v = readEnv(name);
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function optionalEnv(name: string, fallback: string): string {
  return readEnv(name) ?? fallback;
}

// AgeKey-specific config exposed as a frozen object.
export const config = Object.freeze({
  supabaseUrl: () => requireEnv('SUPABASE_URL'),
  supabaseAnonKey: () => requireEnv('SUPABASE_ANON_KEY'),
  serviceRoleKey: () => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  issuer: () =>
    optionalEnv('AGEKEY_ISSUER', 'https://staging.agekey.com.br'),
  allowedOrigins: () =>
    optionalEnv('AGEKEY_ALLOWED_ORIGINS', '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  cronSecret: () => requireEnv('CRON_SECRET'),
  environment: () => optionalEnv('AGEKEY_ENV', 'development'),
});

// Validate at boot — fail fast if production env is misconfigured.
export function validateBootEnv(): void {
  const env = config.environment();
  if (env === 'production') {
    for (const name of required) requireEnv(name);
    requireEnv('CRON_SECRET');
    const origins = config.allowedOrigins();
    if (origins.length === 0 || origins.includes('*')) {
      throw new Error(
        'AGEKEY_ALLOWED_ORIGINS must be a comma-separated list in production (no wildcard).',
      );
    }
  }
}
