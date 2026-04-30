// Re-export of the canonical gateway provider framework from the
// adapter-contracts package, so Deno Edge Functions can import a single,
// stable surface without duplicating types/runtime classes.
//
// All concrete provider integrations (Yoti, Veriff, Onfido, Serpro, iDwall)
// MUST extend ContractOnlyGatewayProvider and override start /
// verifyCallback / normalizeDecision only after:
//   - real provider credentials are wired via secrets,
//   - signed test vectors are committed under
//     supabase/functions/_shared/adapters/test-vectors/<provider>/,
//   - normalizeDecision() returns a payload that passes
//     assertNoGatewayPii() in tests,
//   - threat-model / pentest scope is updated.
//
// Until then, the provider entry is registered as a safe stub that throws
// GatewayProviderNotConfiguredError on every entrypoint — it NEVER
// approves a verification by simulation.

export {
  GatewayProviderNotConfiguredError,
  GatewayProviderUnknownError,
  GatewayProviderRegistry,
  ContractOnlyGatewayProvider,
  buildGatewayProviderRegistry,
  gatewayProviderDisplayName,
  assertNoGatewayPii,
} from '../../../../packages/adapter-contracts/src/gateway-providers.ts';

export type {
  GatewayProviderAdapter,
  GatewayProviderId,
  GatewayProviderRuntimeConfig,
  GatewayStartInput,
  GatewayStartResult,
  GatewayCallbackInput,
  GatewayNormalizedDecision,
  GatewayDecisionCode,
} from '../../../../packages/adapter-contracts/src/gateway-providers.ts';
