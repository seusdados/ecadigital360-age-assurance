// Policy Engine canônico — tipos compartilhados.
//
// Política única com extensões por domínio. Core, Consent e Safety
// Signals devem usar este contrato; cada domínio só aciona a extensão
// apropriada (`policy.age`, `policy.consent`, `policy.safety`).
//
// Documentação: docs/specs/agekey-policy-engine-canonical.md

import { z } from 'zod';

export type AgeKeyPolicyDomain =
  | 'age_verify'
  | 'parental_consent'
  | 'safety_signal'
  | 'credential'
  | 'gateway';

export type AgeKeyRiskTier = 'low' | 'medium' | 'high' | 'critical';

export type AgeKeyAgePredicate = 'over_13' | 'over_16' | 'over_18' | 'over_21';

export type AgeKeyConsentAssuranceLevel =
  | 'AAL-C0'
  | 'AAL-C1'
  | 'AAL-C2'
  | 'AAL-C3'
  | 'AAL-C4';

export type AgeKeyAssuranceLevelLegacy = 'low' | 'substantial' | 'high';

/**
 * Limiar etário público da política. Sempre uma regra do recurso, nunca
 * a idade real do usuário.
 */
export type PolicyAgeThreshold = '13+' | '16+' | '18+' | '21+';

export interface AgeKeyPolicyAgeBlock {
  policy_age_threshold?: PolicyAgeThreshold;
  allowed_age_predicates?: AgeKeyAgePredicate[];
  blocked_if_minor?: boolean;
  accepted_methods?: Array<'zkp' | 'vc' | 'gateway' | 'fallback'>;
  minimum_assurance_level?: AgeKeyAssuranceLevelLegacy;
}

export interface AgeKeyPolicyConsentBlock {
  requires_parental_consent?: boolean;
  requires_guardian_verification?: boolean;
  minimum_consent_assurance?: AgeKeyConsentAssuranceLevel;
  credential_validity_days?: number;
  renewal_required?: boolean;
  revocation_allowed?: boolean;
  ui_text_version_required?: boolean;
  purpose_codes?: string[];
  data_categories?: string[];
}

export interface AgeKeyPolicySafetyBlock {
  enabled?: boolean;
  interaction_ruleset_id?: string;
  require_step_up_on_unknown_age?: boolean;
  require_parental_consent_check?: boolean;
  allowed_event_types?: string[];
  default_retention_class?: string;
  human_review_required_for_high_impact?: boolean;
}

export interface AgeKeyPolicy {
  id: string;
  tenant_id: string;
  application_id?: string;
  name: string;
  version: string;
  jurisdiction: string;
  resource: string;
  domains: AgeKeyPolicyDomain[];
  status: 'draft' | 'active' | 'retired';
  risk_tier?: AgeKeyRiskTier;

  age?: AgeKeyPolicyAgeBlock;
  consent?: AgeKeyPolicyConsentBlock;
  safety?: AgeKeyPolicySafetyBlock;
}

// ====================== Zod schemas ======================

export const PolicyDomainSchema = z.enum([
  'age_verify',
  'parental_consent',
  'safety_signal',
  'credential',
  'gateway',
]);

export const RiskTierSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const PolicyAgeThresholdSchema = z.enum(['13+', '16+', '18+', '21+']);

export const AgePredicateSchema = z.enum([
  'over_13',
  'over_16',
  'over_18',
  'over_21',
]);

export const ConsentAssuranceLevelSchema = z.enum([
  'AAL-C0',
  'AAL-C1',
  'AAL-C2',
  'AAL-C3',
  'AAL-C4',
]);

export const PolicyAgeBlockSchema = z
  .object({
    policy_age_threshold: PolicyAgeThresholdSchema.optional(),
    allowed_age_predicates: z.array(AgePredicateSchema).max(8).optional(),
    blocked_if_minor: z.boolean().optional(),
    accepted_methods: z
      .array(z.enum(['zkp', 'vc', 'gateway', 'fallback']))
      .max(8)
      .optional(),
    minimum_assurance_level: z.enum(['low', 'substantial', 'high']).optional(),
  })
  .strict();

export const PolicyConsentBlockSchema = z
  .object({
    requires_parental_consent: z.boolean().optional(),
    requires_guardian_verification: z.boolean().optional(),
    minimum_consent_assurance: ConsentAssuranceLevelSchema.optional(),
    credential_validity_days: z.number().int().min(1).max(3650).optional(),
    renewal_required: z.boolean().optional(),
    revocation_allowed: z.boolean().optional(),
    ui_text_version_required: z.boolean().optional(),
    purpose_codes: z.array(z.string().min(1).max(64)).max(32).optional(),
    data_categories: z.array(z.string().min(1).max(64)).max(32).optional(),
  })
  .strict();

export const PolicySafetyBlockSchema = z
  .object({
    enabled: z.boolean().optional(),
    interaction_ruleset_id: z.string().min(1).max(128).optional(),
    require_step_up_on_unknown_age: z.boolean().optional(),
    require_parental_consent_check: z.boolean().optional(),
    allowed_event_types: z.array(z.string().min(1).max(64)).max(64).optional(),
    default_retention_class: z.string().min(1).max(64).optional(),
    human_review_required_for_high_impact: z.boolean().optional(),
  })
  .strict();

export const AgeKeyPolicySchema = z
  .object({
    id: z.string().min(1),
    tenant_id: z.string().min(1),
    application_id: z.string().min(1).optional(),
    name: z.string().min(1).max(255),
    version: z.string().min(1).max(32),
    jurisdiction: z.string().min(2).max(16),
    resource: z.string().min(1).max(255),
    domains: z.array(PolicyDomainSchema).min(1).max(5),
    status: z.enum(['draft', 'active', 'retired']),
    risk_tier: RiskTierSchema.optional(),
    age: PolicyAgeBlockSchema.optional(),
    consent: PolicyConsentBlockSchema.optional(),
    safety: PolicySafetyBlockSchema.optional(),
  })
  .strict();
