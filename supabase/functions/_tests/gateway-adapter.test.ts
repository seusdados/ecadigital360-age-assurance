// Deno tests — Gateway adapter (generic JWS attestation flow).
//
// **STATUS:** skipped via `Deno.test.ignore` — same DI limitation as
// zkp-adapter.test.ts. The adapter loads `db()` from `_shared/db.ts`
// at module evaluation time and ESM namespaces don't let us substitute
// it from outside. Refactor planned for Fase 3 slice that drives
// adapter integration tests against Supabase local.

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import {
  generateEs256KeyPair,
  signResultToken,
} from '../../../packages/shared/src/jws.ts';
import type { SessionContext } from '../../../packages/adapter-contracts/src/index.ts';
import type { PolicySnapshot } from '../../../packages/shared/src/types.ts';
import { gatewayAdapter } from '../_shared/adapters/gateway.ts';
import * as dbModule from '../_shared/db.ts';

// ============================================================
// Replace the supabase-js client returned by db() with a tiny shim
// that returns our in-memory issuer rows. Avoids hitting Postgres.
// ============================================================

interface MockProvider {
  id: string;
  issuer_did: string;
  trust_status: 'trusted' | 'suspended' | 'untrusted';
  public_keys_json: { keys: JsonWebKey[] };
  metadata_json: {
    adapter_variant?: string;
    provider?: string;
    age_claim_name?: string;
    nonce_claim_name?: string;
    assurance_level?: 'low' | 'substantial' | 'high';
  };
  tenant_id: string | null;
}

const providers: MockProvider[] = [];

const stubClient = {
  from(table: string) {
    if (table !== 'issuers') {
      throw new Error(`stubClient: unexpected table ${table}`);
    }
    const builder = {
      _filters: { trust_status: '', deleted_at_null: false, or: '' },
      select(_cols: string) {
        return builder;
      },
      eq(col: string, val: string) {
        if (col === 'trust_status') builder._filters.trust_status = val;
        return builder;
      },
      is(col: string, _val: null) {
        if (col === 'deleted_at') builder._filters.deleted_at_null = true;
        return builder;
      },
      or(filter: string) {
        builder._filters.or = filter;
        return builder;
      },
      then(resolve: (r: { data: MockProvider[]; error: null }) => unknown) {
        const filtered = providers.filter((p) => {
          if (builder._filters.trust_status && p.trust_status !== builder._filters.trust_status) {
            return false;
          }
          return true;
        });
        return resolve({ data: filtered, error: null });
      },
    };
    return builder;
  },
};

(dbModule as unknown as { db: () => unknown }).db = () => stubClient;

// ============================================================
// Helpers
// ============================================================

function makeCtx(overrides: Partial<SessionContext> = {}): SessionContext {
  const policy: PolicySnapshot = {
    id: 'policy-gw',
    tenant_id: 'tenant-gw',
    name: 'BR 18+',
    slug: 'br-18',
    age_threshold: 18,
    age_band_min: null,
    age_band_max: null,
    jurisdiction_code: 'BR',
    method_priority: ['gateway'],
    required_assurance_level: 'substantial',
    token_ttl_seconds: 86400,
    current_version: 1,
  };
  return {
    tenantId: 'tenant-gw',
    applicationId: 'app-gw',
    sessionId: 'session-gw',
    policy,
    nonce: 'gw-nonce-123',
    nonceExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    capabilities: {},
    clientIp: '203.0.113.20',
    userAgent: 'AgeKey-SDK/1.0',
    locale: 'pt-BR',
    ...overrides,
  };
}

async function buildAttestation(opts: {
  issuerDid: string;
  privateJwk: JsonWebKey;
  nonce: string;
  ageAtLeast: number;
  ageClaimName?: string;
  nonceClaimName?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    iss: opts.issuerDid,
    iat: now,
    nbf: now,
    exp: now + 600,
  };
  claims[opts.nonceClaimName ?? 'nonce'] = opts.nonce;
  claims[opts.ageClaimName ?? 'age_at_least'] = opts.ageAtLeast;
  // deno-lint-ignore no-explicit-any
  return await signResultToken(claims as any, {
    kid: 'gw-test-kid',
    privateJwk: opts.privateJwk,
  });
}

function registerProvider(opts: {
  provider: string;
  issuerDid: string;
  publicJwk: JsonWebKey;
  ageClaimName?: string;
  nonceClaimName?: string;
  assuranceLevel?: 'low' | 'substantial' | 'high';
}) {
  const md: MockProvider['metadata_json'] = {
    adapter_variant: 'gateway',
    provider: opts.provider,
  };
  if (opts.ageClaimName) md.age_claim_name = opts.ageClaimName;
  if (opts.nonceClaimName) md.nonce_claim_name = opts.nonceClaimName;
  if (opts.assuranceLevel) md.assurance_level = opts.assuranceLevel;
  providers.push({
    id: `provider-${opts.provider}`,
    issuer_did: opts.issuerDid,
    trust_status: 'trusted',
    public_keys_json: { keys: [{ ...opts.publicJwk, kid: 'gw-test-kid' }] },
    metadata_json: md,
    tenant_id: null,
  });
}

// ============================================================
// Tests
// ============================================================

Deno.test.ignore('gateway approves valid attestation with matching nonce + age', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:gw.demo.test';
  registerProvider({
    provider: 'demo_gw',
    issuerDid,
    publicJwk,
    assuranceLevel: 'substantial',
  });

  const ctx = makeCtx();
  const attestation = await buildAttestation({
    issuerDid,
    privateJwk,
    nonce: ctx.nonce,
    ageAtLeast: 21,
  });

  const result = await gatewayAdapter.completeSession(ctx, {
    method: 'gateway',
    attestation,
    provider: 'demo_gw',
  });

  assertEquals(result.decision, 'approved');
  assertEquals(result.threshold_satisfied, true);
  assertEquals(result.assurance_level, 'substantial');
  assertEquals(result.reason_code, 'THRESHOLD_SATISFIED');
  assertEquals(result.method, 'gateway');
});

Deno.test.ignore('gateway respects custom age_claim_name + nonce_claim_name', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:gw.custom.test';
  registerProvider({
    provider: 'unico_check',
    issuerDid,
    publicJwk,
    ageClaimName: 'idade_minima',
    nonceClaimName: 'cnonce',
    assuranceLevel: 'high',
  });

  const ctx = makeCtx();
  const attestation = await buildAttestation({
    issuerDid,
    privateJwk,
    nonce: ctx.nonce,
    ageAtLeast: 18,
    ageClaimName: 'idade_minima',
    nonceClaimName: 'cnonce',
  });

  const result = await gatewayAdapter.completeSession(ctx, {
    method: 'gateway',
    attestation,
    provider: 'unico_check',
  });

  assertEquals(result.decision, 'approved');
  assertEquals(result.assurance_level, 'high');
});

Deno.test.ignore('gateway denies on nonce mismatch', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:gw.nonce.test';
  registerProvider({ provider: 'nonce_test', issuerDid, publicJwk });

  const ctx = makeCtx();
  const attestation = await buildAttestation({
    issuerDid,
    privateJwk,
    nonce: 'wrong-nonce',
    ageAtLeast: 21,
  });

  const result = await gatewayAdapter.completeSession(ctx, {
    method: 'gateway',
    attestation,
    provider: 'nonce_test',
  });

  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'GATEWAY_ATTESTATION_INVALID');
});

Deno.test.ignore('gateway denies when age below policy threshold', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:gw.young.test';
  registerProvider({ provider: 'young_test', issuerDid, publicJwk });

  const ctx = makeCtx();
  const attestation = await buildAttestation({
    issuerDid,
    privateJwk,
    nonce: ctx.nonce,
    ageAtLeast: 13, // below policy=18
  });

  const result = await gatewayAdapter.completeSession(ctx, {
    method: 'gateway',
    attestation,
    provider: 'young_test',
  });

  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'POLICY_ASSURANCE_UNMET');
});

Deno.test.ignore('gateway denies when provider not registered', async () => {
  const ctx = makeCtx();
  const result = await gatewayAdapter.completeSession(ctx, {
    method: 'gateway',
    attestation: 'irrelevant',
    provider: 'unknown_provider',
  });

  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'GATEWAY_CONFIG_MISSING');
});

Deno.test.ignore('gateway prepareSession lists registered providers', async () => {
  // Register at least one provider for this assertion to be meaningful.
  const { publicJwk } = await generateEs256KeyPair();
  registerProvider({
    provider: 'list_test',
    issuerDid: 'did:web:gw.list.test',
    publicJwk,
    assuranceLevel: 'high',
  });

  const ctx = makeCtx();
  const payload = await gatewayAdapter.prepareSession(ctx);
  const cp = payload.client_payload as {
    challenge_nonce: string;
    provider_options: Array<{ provider: string; assurance_level: string }>;
  };
  assertEquals(cp.challenge_nonce, ctx.nonce);
  assert(cp.provider_options.length > 0);
  assert(cp.provider_options.some((p) => p.provider === 'list_test'));
});
