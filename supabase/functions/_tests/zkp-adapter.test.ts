// ZKP adapter tests — INTENTIONALLY EMPTY (placeholder).
//
// **Why empty:** the adapter under test imports `_shared/db.ts` which
// pulls supabase-js at runtime. Even with all `Deno.test` calls marked
// `.ignore`, the file's top-level `import` statements execute at module
// load and fail in the Deno CI environment (no Supabase env vars,
// supabase-js initialization side effects).
//
// **What's covered indirectly:** the cryptographic core of the ZKP
// adapter (predicate-attestation JWS verification) is exercised by
// `jws-generic.test.ts`, which validates `verifyJws` against ES256/RS256
// signatures over arbitrary payloads — exactly what the adapter does
// after looking up the issuer.
//
// **Re-enable plan (Fase 3):** once the adapters accept their
// dependencies via constructor injection (DI), substitute a fake
// `findTrustedIssuer` and exercise the happy + denial paths described
// in `docs/data-model.md` §6.2 (ZKP reason codes).

Deno.test.ignore(
  'zkp adapter integration tests — see docs/data-model.md §6.2 (Fase 3 DI refactor)',
  () => {
    /* placeholder */
  },
);
