// Resolve env vars necessárias para integration tests.
// Quando ausentes, exporta `enabled = false` para que vitest skipe.

export interface IntegrationEnv {
  enabled: boolean;
  supabaseUrl: string;
  serviceRoleKey: string;
  tenantA: string;
  tenantB: string;
}

export function loadEnv(): IntegrationEnv {
  const supabaseUrl =
    process.env.SUPABASE_TEST_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceRoleKey =
    process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    '';
  const tenantA = process.env.AGEKEY_TEST_TENANT_A_ID ?? '';
  const tenantB = process.env.AGEKEY_TEST_TENANT_B_ID ?? '';

  const enabled = Boolean(supabaseUrl && serviceRoleKey && tenantA && tenantB);

  return {
    enabled,
    supabaseUrl,
    serviceRoleKey,
    tenantA,
    tenantB,
  };
}
