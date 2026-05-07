// Parental Consent — barrel export.
//
// Public surface used by edge functions, the Admin app, the SDK and tests.
// Internal helpers are NOT re-exported on purpose — call sites should depend
// on the canonical primitives (privacy guard, decision envelope) directly.
//
// Reference: docs/modules/parental-consent/architecture.md

export * from './consent-types.ts';
export * from './consent-envelope.ts';
export * from './consent-token.ts';
export * from './consent-engine.ts';
export * from './consent-api.ts';
export * from './consent-projections.ts';
export * from './consent-feature-flags.ts';
