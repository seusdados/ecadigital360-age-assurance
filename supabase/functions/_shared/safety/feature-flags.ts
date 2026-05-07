// Feature flags do AgeKey Safety Signals.
import { readFeatureFlags } from '../../../../packages/shared/src/feature-flags/index.ts';

export interface SafetyRuntimeFlags {
  enabled: boolean;
  parentalConsentEnabled: boolean;
  defaultEventRetentionClass: string;
  retentionCleanupBatchSize: number;
}

export function readSafetyFlags(): SafetyRuntimeFlags {
  const flags = readFeatureFlags((name) => Deno.env.get(name));
  const retClass =
    Deno.env.get('AGEKEY_SAFETY_DEFAULT_EVENT_RETENTION_CLASS') ?? 'event_90d';
  const batch = Number(
    Deno.env.get('AGEKEY_SAFETY_RETENTION_CLEANUP_BATCH_SIZE') ?? '500',
  );
  return {
    enabled: flags.AGEKEY_SAFETY_SIGNALS_ENABLED,
    parentalConsentEnabled: flags.AGEKEY_PARENTAL_CONSENT_ENABLED,
    defaultEventRetentionClass: retClass,
    retentionCleanupBatchSize:
      Number.isFinite(batch) && batch > 0 ? batch : 500,
  };
}
