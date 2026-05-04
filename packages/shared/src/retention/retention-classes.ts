// Classes canônicas de retenção do AgeKey.
//
// Padroniza nomes que aparecem em policies, retention-job, audit_events,
// data_retention_policy e admin labels. Usadas por Core, Consent e
// Safety Signals para determinar TTL e regras de cleanup.
//
// Documentação: docs/specs/agekey-retention-classes.md

export type AgeKeyRetentionClass =
  | 'no_store'
  | 'session_24h'
  | 'session_7d'
  | 'otp_24h'
  | 'otp_30d'
  | 'event_30d'
  | 'event_90d'
  | 'event_180d'
  | 'aggregate_12m'
  | 'verification_result_policy_ttl'
  | 'result_token_policy_ttl'
  | 'consent_active_until_expiration'
  | 'consent_expired_audit_window'
  | 'alert_12m'
  | 'case_24m'
  | 'legal_hold';

export interface RetentionClassDefinition {
  readonly id: AgeKeyRetentionClass;
  readonly description: string;
  /**
   * TTL em segundos. `null` quando o TTL é dinâmico (decorre da policy
   * ou da expiração do consentimento) ou quando não há expiração
   * automática (`legal_hold`, `no_store`).
   */
  readonly default_ttl_seconds: number | null;
  /**
   * Indica se o cleanup automático é permitido. `false` em `legal_hold`.
   */
  readonly auto_cleanup_allowed: boolean;
  /**
   * Indica se essa classe pode aparecer em ingestão Safety v1.
   * `false` em classes que carregariam conteúdo ou identidade civil.
   */
  readonly safety_v1_compatible: boolean;
}

const DAY = 24 * 60 * 60;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export const RETENTION_CLASSES: Readonly<
  Record<AgeKeyRetentionClass, RetentionClassDefinition>
> = {
  no_store: {
    id: 'no_store',
    description:
      'Nenhuma persistência fora de processamento em memória. Não armazena.',
    default_ttl_seconds: 0,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  session_24h: {
    id: 'session_24h',
    description: 'Sessão temporária (24h).',
    default_ttl_seconds: DAY,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  session_7d: {
    id: 'session_7d',
    description: 'Sessão estendida (7 dias).',
    default_ttl_seconds: 7 * DAY,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  otp_24h: {
    id: 'otp_24h',
    description: 'OTP/link curto de verificação (24h).',
    default_ttl_seconds: DAY,
    auto_cleanup_allowed: true,
    safety_v1_compatible: false,
  },
  otp_30d: {
    id: 'otp_30d',
    description: 'OTP com janela ampliada para auditoria (30d).',
    default_ttl_seconds: 30 * DAY,
    auto_cleanup_allowed: true,
    safety_v1_compatible: false,
  },
  event_30d: {
    id: 'event_30d',
    description: 'Evento Safety/audit minimizado (30d).',
    default_ttl_seconds: 30 * DAY,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  event_90d: {
    id: 'event_90d',
    description: 'Evento Safety/audit minimizado (90d).',
    default_ttl_seconds: 90 * DAY,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  event_180d: {
    id: 'event_180d',
    description: 'Evento Safety/audit minimizado (180d).',
    default_ttl_seconds: 180 * DAY,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  aggregate_12m: {
    id: 'aggregate_12m',
    description:
      'Contadores agregados (12 meses). Sobrevivem aos eventos individuais.',
    default_ttl_seconds: 12 * MONTH,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  verification_result_policy_ttl: {
    id: 'verification_result_policy_ttl',
    description:
      'TTL definido pela `policy_versions.token_ttl_seconds` da política aplicada.',
    default_ttl_seconds: null,
    auto_cleanup_allowed: true,
    safety_v1_compatible: false,
  },
  result_token_policy_ttl: {
    id: 'result_token_policy_ttl',
    description:
      'TTL do `result_token` igual à TTL declarada pela política aplicada.',
    default_ttl_seconds: null,
    auto_cleanup_allowed: true,
    safety_v1_compatible: false,
  },
  consent_active_until_expiration: {
    id: 'consent_active_until_expiration',
    description:
      'Consentimento ativo: vive até `expires_at`. Apagado/arquivado ao expirar (sob `consent_expired_audit_window`).',
    default_ttl_seconds: null,
    auto_cleanup_allowed: true,
    safety_v1_compatible: false,
  },
  consent_expired_audit_window: {
    id: 'consent_expired_audit_window',
    description:
      'Após expirar, registro de consentimento permanece em janela de auditoria (default 365d) e depois é apagado.',
    default_ttl_seconds: YEAR,
    auto_cleanup_allowed: true,
    safety_v1_compatible: false,
  },
  alert_12m: {
    id: 'alert_12m',
    description: 'Alerta Safety com retenção de 12 meses.',
    default_ttl_seconds: 12 * MONTH,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  case_24m: {
    id: 'case_24m',
    description: 'Caso/escalonamento Safety com retenção de 24 meses.',
    default_ttl_seconds: 24 * MONTH,
    auto_cleanup_allowed: true,
    safety_v1_compatible: true,
  },
  legal_hold: {
    id: 'legal_hold',
    description:
      'Legal hold: nunca é apagado automaticamente. Cleanup bloqueado por audit_event RETENTION_LEGAL_HOLD_ACTIVE.',
    default_ttl_seconds: null,
    auto_cleanup_allowed: false,
    safety_v1_compatible: true,
  },
};

export function getRetentionClass(
  id: AgeKeyRetentionClass,
): RetentionClassDefinition {
  return RETENTION_CLASSES[id];
}

export function isAutoCleanupAllowed(id: AgeKeyRetentionClass): boolean {
  return RETENTION_CLASSES[id].auto_cleanup_allowed;
}

export function isSafetyV1Compatible(id: AgeKeyRetentionClass): boolean {
  return RETENTION_CLASSES[id].safety_v1_compatible;
}
