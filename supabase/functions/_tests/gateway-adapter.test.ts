// Gateway adapter tests — INTENTIONALLY EMPTY (placeholder).
//
// Same DI limitation as zkp-adapter.test.ts: the adapter under test
// imports `_shared/db.ts` (which pulls supabase-js at module load),
// and ESM namespaces don't let us substitute the dependency from
// outside.
//
// **What's covered indirectly:** `jws-generic.test.ts` validates
// `verifyJws` (ES256/RS256, audience as array, wrong audience,
// unsupported alg) — the entire signature verification path the
// gateway adapter delegates to.
//
// **Re-enable plan (Fase 3):** refactor adapters to accept
// `findTrustedIssuer` and `db` via constructor injection, then
// exercise: nonce mismatch (GATEWAY_ATTESTATION_INVALID), missing
// age claim, custom `age_claim_name` / `nonce_claim_name`, provider
// not registered (GATEWAY_CONFIG_MISSING), provider listing.

Deno.test.ignore(
  'gateway adapter integration tests — see docs/data-model.md §6.2 (Fase 3 DI refactor)',
  () => {
    /* placeholder */
  },
);
