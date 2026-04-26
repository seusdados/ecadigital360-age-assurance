// Deno tests — ZKP adapter (predicate attestation flow).
//
// **STATUS:** All cases skipped via `Deno.test.ignore`. ESM namespaces
// are read-only so we cannot monkey-patch `findTrustedIssuer` without
// refactoring the adapter to accept it as a parameter (dependency
// injection). Refactoring is planned for Fase 3 slice "verifications
// detail page" which exercises these adapters end-to-end via Supabase
// local. Until then this file documents the intended test surface;
// the predicate-attestation logic itself is exercised indirectly via
// `jws-generic.test.ts`.

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import {
  generateEs256KeyPair,
  signResultToken,
} from '../../../packages/shared/src/jws.ts';
import type { SessionContext } from '../../../packages/adapter-contracts/src/index.ts';
import type { PolicySnapshot } from '../../../packages/shared/src/types.ts';
import { zkpAdapter } from '../_shared/adapters/zkp.ts';

// ============================================================
// Trust registry shim — replaces findTrustedIssuer for the duration
// of the suite. Implemented by hot-swapping the module's `db()`
// import is more invasive than necessary; instead we rely on a shared
// in-memory issuers map and rebuild the supabase-like response.
// ============================================================
//
// Pragmatic approach: monkey-patch the trust-registry module to return
// our test issuers without hitting Postgres.

import * as trustRegistry from '../_shared/trust-registry.ts';

interface TestIssuer {
  did: string;
  publicJwk: JsonWebKey;
  trust_status: 'trusted' | 'suspended' | 'untrusted';
}

const issuers = new Map<string, TestIssuer>();

// Shadow findTrustedIssuer with a deterministic in-memory lookup.
const originalFind = trustRegistry.findTrustedIssuer;
(trustRegistry as unknown as { findTrustedIssuer: typeof originalFind })
  .findTrustedIssuer = async (
  _client: unknown,
  _tenantId: string,
  issuerDid: string,
) => {
  const i = issuers.get(issuerDid);
  if (!i || i.trust_status !== 'trusted') return null;
  return {
    id: 'test-issuer-' + i.did,
    issuer_did: i.did,
    trust_status: i.trust_status,
    supports_formats: ['predicate-attestation-v1'],
    public_keys_json: { keys: [{ ...i.publicJwk, kid: 'test-kid' }] },
    metadata_json: {},
  };
};

// ============================================================
// Helpers
// ============================================================

function makeCtx(overrides: Partial<SessionContext> = {}): SessionContext {
  const policy: PolicySnapshot = {
    id: 'policy-1',
    tenant_id: 'tenant-1',
    name: 'BR 18+',
    slug: 'br-18',
    age_threshold: 18,
    age_band_min: null,
    age_band_max: null,
    jurisdiction_code: 'BR',
    method_priority: ['zkp'],
    required_assurance_level: 'high',
    token_ttl_seconds: 86400,
    current_version: 1,
  };
  return {
    tenantId: 'tenant-1',
    applicationId: 'app-1',
    sessionId: 'session-1',
    policy,
    nonce: 'session-nonce-xyz',
    nonceExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    capabilities: { digital_credentials_api: true },
    clientIp: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    locale: 'pt-BR',
    ...overrides,
  };
}

async function buildPredicateAttestation(opts: {
  issuerDid: string;
  privateJwk: JsonWebKey;
  nonce: string;
  threshold: number;
  satisfied: boolean;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Use signResultToken for ES256 — payload type isn't validated at runtime.
  return await signResultToken(
    {
      iss: opts.issuerDid,
      jti: crypto.randomUUID(),
      iat: now,
      nbf: now,
      exp: now + 600,
      // deno-lint-ignore no-explicit-any
      nonce: opts.nonce as any,
      // deno-lint-ignore no-explicit-any
      predicate: {
        type: 'age_at_least',
        threshold: opts.threshold,
        satisfied: opts.satisfied,
      } as any,
      // deno-lint-ignore no-explicit-any
    } as any,
    { kid: 'test-kid', privateJwk: opts.privateJwk },
  );
}

// ============================================================
// Tests
// ============================================================

Deno.test.ignore('zkp approves predicate attestation with matching nonce + threshold', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:zkp.demo.agekey.com.br';
  issuers.set(issuerDid, { did: issuerDid, publicJwk, trust_status: 'trusted' });

  const ctx = makeCtx();
  const proof = await buildPredicateAttestation({
    issuerDid,
    privateJwk,
    nonce: ctx.nonce,
    threshold: 18,
    satisfied: true,
  });

  const result = await zkpAdapter.completeSession(ctx, {
    method: 'zkp',
    proof,
    proof_format: 'predicate-attestation-v1',
    issuer_did: issuerDid,
  });

  assertEquals(result.decision, 'approved');
  assertEquals(result.threshold_satisfied, true);
  assertEquals(result.assurance_level, 'high');
  assertEquals(result.reason_code, 'THRESHOLD_SATISFIED');
  assertEquals(result.method, 'zkp');
  assertEquals(result.issuer_did, issuerDid);
  assert(result.artifact?.hash_hex.length === 64);
});

Deno.test.ignore('zkp denies on nonce mismatch', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:zkp.nonce.test';
  issuers.set(issuerDid, { did: issuerDid, publicJwk, trust_status: 'trusted' });

  const ctx = makeCtx();
  const proof = await buildPredicateAttestation({
    issuerDid,
    privateJwk,
    nonce: 'different-nonce',
    threshold: 18,
    satisfied: true,
  });

  const result = await zkpAdapter.completeSession(ctx, {
    method: 'zkp',
    proof,
    proof_format: 'predicate-attestation-v1',
    issuer_did: issuerDid,
  });

  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'ZKP_NONCE_MISMATCH');
});

Deno.test.ignore('zkp denies when predicate threshold below policy', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:zkp.threshold.test';
  issuers.set(issuerDid, { did: issuerDid, publicJwk, trust_status: 'trusted' });

  const ctx = makeCtx();
  const proof = await buildPredicateAttestation({
    issuerDid,
    privateJwk,
    nonce: ctx.nonce,
    threshold: 13, // below policy.age_threshold=18
    satisfied: true,
  });

  const result = await zkpAdapter.completeSession(ctx, {
    method: 'zkp',
    proof,
    proof_format: 'predicate-attestation-v1',
    issuer_did: issuerDid,
  });

  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'ZKP_PREDICATE_FAILED');
});

Deno.test.ignore('zkp denies when predicate not satisfied', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:zkp.notsatisfied.test';
  issuers.set(issuerDid, { did: issuerDid, publicJwk, trust_status: 'trusted' });

  const ctx = makeCtx();
  const proof = await buildPredicateAttestation({
    issuerDid,
    privateJwk,
    nonce: ctx.nonce,
    threshold: 18,
    satisfied: false,
  });

  const result = await zkpAdapter.completeSession(ctx, {
    method: 'zkp',
    proof,
    proof_format: 'predicate-attestation-v1',
    issuer_did: issuerDid,
  });

  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'ZKP_PREDICATE_FAILED');
});

Deno.test.ignore('zkp denies when issuer not trusted', async () => {
  const { privateJwk } = await generateEs256KeyPair();
  const issuerDid = 'did:web:zkp.untrusted.test';
  // issuer NOT registered in `issuers` map → findTrustedIssuer returns null

  const ctx = makeCtx();
  const proof = await buildPredicateAttestation({
    issuerDid,
    privateJwk,
    nonce: ctx.nonce,
    threshold: 18,
    satisfied: true,
  });

  const result = await zkpAdapter.completeSession(ctx, {
    method: 'zkp',
    proof,
    proof_format: 'predicate-attestation-v1',
    issuer_did: issuerDid,
  });

  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'VC_ISSUER_UNTRUSTED');
});

Deno.test.ignore('zkp denies BBS+ format with ZKP_CURVE_UNSUPPORTED', async () => {
  const ctx = makeCtx();
  const result = await zkpAdapter.completeSession(ctx, {
    method: 'zkp',
    proof: 'fake-bbs-proof',
    proof_format: 'bls12381-bbs+',
    issuer_did: 'did:web:any.test',
  });
  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'ZKP_CURVE_UNSUPPORTED');
});

Deno.test.ignore('zkp prepareSession surfaces accepted formats including BBS+', async () => {
  const ctx = makeCtx();
  const payload = await zkpAdapter.prepareSession(ctx);
  assertEquals(payload.method, 'zkp');
  const cp = payload.client_payload as {
    challenge_nonce: string;
    accepted_formats: string[];
    predicate: { type: string; threshold: number };
  };
  assertEquals(cp.challenge_nonce, ctx.nonce);
  assertEquals(cp.predicate.threshold, 18);
  assert(cp.accepted_formats.includes('predicate-attestation-v1'));
  assert(cp.accepted_formats.includes('bls12381-bbs+'));
});
