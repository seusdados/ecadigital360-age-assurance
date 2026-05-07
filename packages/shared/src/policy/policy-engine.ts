// Policy Engine canônico — helpers puros.
//
// Estes helpers não substituem o engine das Edge Functions; eles
// alimentam-no com decisões consistentes e reutilizáveis. São puros,
// não fazem I/O, não conhecem banco de dados.
//
// Documentação: docs/specs/agekey-policy-engine-canonical.md

import type { AgeKeyPolicy, AgeKeyPolicyDomain } from './policy-types.ts';

/**
 * Indica se a política aceita o domínio informado. Política deve estar
 * ativa.
 */
export function policySupportsDomain(
  policy: AgeKeyPolicy,
  domain: AgeKeyPolicyDomain,
): boolean {
  if (policy.status !== 'active') return false;
  return policy.domains.includes(domain);
}

/**
 * Indica se a política bloqueia o recurso (`blocked_if_minor` por idade
 * abaixo do limiar OU status `retired`).
 *
 * Retorna `false` por omissão — caller deve checar status ativo
 * separadamente quando necessário.
 */
export function isResourceHardBlocked(policy: AgeKeyPolicy): boolean {
  if (policy.status === 'retired') return true;
  if (policy.age?.blocked_if_minor === true) return true;
  return false;
}

/**
 * Conflito canônico: se a política bloqueia o recurso por regra (ex.:
 * `blocked_if_minor`), o consentimento parental NÃO libera esse recurso.
 * Esse helper formaliza essa regra.
 */
export function consentCannotOverridePolicyBlock(
  policy: AgeKeyPolicy,
): boolean {
  return isResourceHardBlocked(policy);
}

/**
 * Regras formais expressas pelo policy engine canônico:
 *
 * 1. Consentimento genérico não libera recurso específico.
 *    Cada `parental_consent` é amarrado a `policy_id` + `policy_version`
 *    + `purpose_codes` declarados explicitamente.
 *
 * 2. Mudança material de finalidade exige novo consentimento.
 *    Detecta-se mudança material quando `policy.consent.purpose_codes`
 *    OU `policy.consent.data_categories` mudam — ou seja, exige-se
 *    `policy_version` novo.
 *
 * 3. Consentimento expirado não pode ser aceito por fallback silencioso.
 *    O verificador deve devolver `decision = "expired"` com
 *    `reason_code = "CONSENT_EXPIRED"`.
 *
 * 4. Safety rule não pode acessar conteúdo bruto no MVP.
 *    Garantia: `safety.enabled` só convive com `safety_event_v1` no
 *    privacy guard; conteúdo bruto é proibido.
 *
 * 5. Safety rule só pode gerar razão, severidade e ação proporcional.
 *    Garantia: o decision envelope só aceita `risk_category`, `severity`,
 *    `actions` controlados — nunca conclusão jurídica.
 *
 * 6. Policy engine deve impedir conflito entre `blocked_by_policy` e
 *    consentimento. Garantia: `consentCannotOverridePolicyBlock` acima.
 */
export function describeCanonicalPolicyRules(): string[] {
  return [
    'consent_generic_does_not_unlock_specific_resource',
    'material_purpose_change_requires_new_consent',
    'expired_consent_cannot_be_silent_fallback',
    'safety_rules_cannot_access_raw_content_in_mvp',
    'safety_rules_cannot_emit_legal_conclusions',
    'policy_block_cannot_be_overridden_by_consent',
  ];
}

/**
 * Ergonomia: extrai limiar etário da política em forma numérica
 * inteira. Apenas o limiar declarado — nunca a idade do usuário.
 *
 * Retorna `null` quando não há `policy_age_threshold` declarado.
 */
export function policyAgeThresholdAsNumber(
  policy: AgeKeyPolicy,
): 13 | 16 | 18 | 21 | null {
  const t = policy.age?.policy_age_threshold;
  switch (t) {
    case '13+':
      return 13;
    case '16+':
      return 16;
    case '18+':
      return 18;
    case '21+':
      return 21;
    default:
      return null;
  }
}
