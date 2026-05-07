-- Migration: 027_safety_signals_seed_rules
--
-- Seed das 5 regras sistêmicas globais (tenant_id = NULL).
-- Tenants podem criar override per-tenant via Edge Function rule.write
-- (a implementar em rodada própria; MVP só lê config).

INSERT INTO safety_rules (tenant_id, rule_code, enabled, severity, actions, config_json)
VALUES
  (
    NULL,
    'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    true,
    'high',
    ARRAY['request_step_up','soft_block','notify_safety_team']::text[],
    jsonb_build_object(
      'description', 'Mensagem privada de adulto desconhecido para menor — exige step-up de age assurance do menor antes de permitir continuação.',
      'min_messages', 1
    )
  ),
  (
    NULL,
    'ADULT_MINOR_HIGH_FREQUENCY_24H',
    true,
    'high',
    ARRAY['notify_safety_team','escalate_to_human_review','rate_limit_actor']::text[],
    jsonb_build_object(
      'description', 'Adulto interagindo com menor em alta frequência em 24h — escalado para revisão humana.',
      'window_hours', 24,
      'threshold_messages', 20
    )
  ),
  (
    NULL,
    'MEDIA_UPLOAD_TO_MINOR',
    true,
    'medium',
    ARRAY['log_only','request_parental_consent_check']::text[],
    jsonb_build_object(
      'description', 'Upload de mídia direcionado para menor — exige checagem de consentimento parental do destinatário.',
      'allowed_with_consent', true
    )
  ),
  (
    NULL,
    'EXTERNAL_LINK_TO_MINOR',
    true,
    'medium',
    ARRAY['log_only','soft_block']::text[],
    jsonb_build_object(
      'description', 'Link externo enviado para menor — bloqueio suave (filtro de domínio confiável aplicado em camada de aplicação).',
      'soft_block_default', true
    )
  ),
  (
    NULL,
    'MULTIPLE_REPORTS_AGAINST_ACTOR',
    true,
    'critical',
    ARRAY['notify_safety_team','escalate_to_human_review','rate_limit_actor']::text[],
    jsonb_build_object(
      'description', 'Múltiplos reports contra o mesmo ator em 7 dias — escalado para revisão humana.',
      'window_days', 7,
      'threshold_reports', 3
    )
  )
ON CONFLICT (tenant_id, rule_code) DO NOTHING;
