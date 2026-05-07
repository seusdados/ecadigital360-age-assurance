# AgeKey — Policy Engine (canônico)

> Status: contrato canônico da Rodada 1.
> Implementação: `packages/shared/src/policy/`.

## 1. Finalidade

Política única, com **extensões por domínio**. Core, Consent e Safety Signals usam o mesmo tipo `AgeKeyPolicy`; cada módulo só lê o bloco que lhe interessa (`policy.age`, `policy.consent`, `policy.safety`).

## 2. Tipos canônicos

```ts
export type AgeKeyPolicyDomain =
  | 'age_verify'
  | 'parental_consent'
  | 'safety_signal'
  | 'credential'
  | 'gateway';

export type AgeKeyRiskTier = 'low' | 'medium' | 'high' | 'critical';

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

  age?: {
    policy_age_threshold?: '13+' | '16+' | '18+' | '21+';
    allowed_age_predicates?: Array<'over_13'|'over_16'|'over_18'|'over_21'>;
    blocked_if_minor?: boolean;
    accepted_methods?: Array<'zkp'|'vc'|'gateway'|'fallback'>;
    minimum_assurance_level?: 'low' | 'substantial' | 'high';
  };

  consent?: {
    requires_parental_consent?: boolean;
    requires_guardian_verification?: boolean;
    minimum_consent_assurance?: 'AAL-C0'|'AAL-C1'|'AAL-C2'|'AAL-C3'|'AAL-C4';
    credential_validity_days?: number;
    renewal_required?: boolean;
    revocation_allowed?: boolean;
    ui_text_version_required?: boolean;
    purpose_codes?: string[];
    data_categories?: string[];
  };

  safety?: {
    enabled?: boolean;
    interaction_ruleset_id?: string;
    require_step_up_on_unknown_age?: boolean;
    require_parental_consent_check?: boolean;
    allowed_event_types?: string[];
    default_retention_class?: string;
    human_review_required_for_high_impact?: boolean;
  };
}
```

## 3. Regras canônicas

1. **Consentimento genérico não libera recurso específico.** Cada `parental_consent` é amarrado a `policy_id` + `policy_version` + `purpose_codes` declarados.
2. **Mudança material de finalidade exige novo consentimento.** Quando `consent.purpose_codes` ou `consent.data_categories` mudam, é obrigatório criar nova `policy_version`.
3. **Consentimento expirado não pode ser aceito por fallback silencioso.** O verificador deve responder `decision="expired"` com `reason_code="CONSENT_EXPIRED"`.
4. **Safety rule não pode acessar conteúdo bruto no MVP.** Garantido pelo perfil `safety_event_v1` do Privacy Guard.
5. **Safety rule só pode gerar `risk_category`, `severity` e `actions`** controlados. Nunca conclusão jurídica.
6. **Policy block não pode ser sobreposto por consentimento.** Quando `blocked_if_minor=true` ou `status="retired"`, o recurso fica bloqueado mesmo com consentimento parental aceito.

## 4. Helpers canônicos

```ts
policySupportsDomain(policy, 'parental_consent'): boolean
isResourceHardBlocked(policy): boolean
consentCannotOverridePolicyBlock(policy): boolean
policyAgeThresholdAsNumber(policy): 13 | 16 | 18 | 21 | null
describeCanonicalPolicyRules(): string[]
```

## 5. Não-objetivos

- Não substituir o engine das Edge Functions (`supabase/functions/_shared/policy-engine.ts`). O canônico provê **tipos** e **regras formais** que aquele engine deve respeitar.
- Não validar I/O. O canônico é puro.
- Não persistir nada. Persistência fica em `policies` e `policy_versions`.
