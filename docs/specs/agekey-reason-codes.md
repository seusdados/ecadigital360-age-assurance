# AgeKey — Reason Codes (canônicos)

> Status: catálogo canônico da Rodada 1.
> Implementação: `packages/shared/src/taxonomy/reason-codes.ts`.
> Compatível com: `packages/shared/src/reason-codes.ts` (legado, mantido).

## 1. Convenções

- Formato: `UPPER_SNAKE_CASE`.
- Prefixo por grupo: `AGE_`, `CONSENT_`, `SAFETY_`, `POLICY_`, `GATEWAY_`, `CREDENTIAL_`, `ZKP_`, `PRIVACY_`, `TOKEN_`, `WEBHOOK_`, `RETENTION_`, `SYSTEM_`.
- Nunca acusar crime. Nunca declarar fato jurídico definitivo. Usar **sinais**, **políticas**, **elegibilidade** e **necessidade de revisão**.

## 2. Catálogo

### 2.1 Idade (`AGE_*`)

| Code | Significado |
|---|---|
| `AGE_POLICY_SATISFIED` | Predicado etário da política satisfeito. |
| `AGE_POLICY_NOT_SATISFIED` | Predicado etário não satisfeito. |
| `AGE_UNKNOWN_REQUIRES_STEP_UP` | Idade desconhecida; sessão pede step-up. |
| `AGE_METHOD_UNAVAILABLE` | Nenhum método aceito está disponível para o usuário. |
| `AGE_PREDICATE_INSUFFICIENT` | Predicado entregue não cobre o limiar exigido. |
| `AGE_BAND_OUT_OF_RANGE` | Faixa entregue fora do `[age_band_min, age_band_max]`. |

### 2.2 Consentimento parental (`CONSENT_*`)

| Code | Significado |
|---|---|
| `CONSENT_REQUIRED` | Recurso exige consentimento; nada coletado ainda. |
| `CONSENT_APPROVED` | Consentimento aceito pelo responsável. |
| `CONSENT_DENIED` | Consentimento negado pelo responsável. |
| `CONSENT_PENDING_GUARDIAN` | Aguardando ação do responsável. |
| `CONSENT_PENDING_VERIFICATION` | Aguardando verificação do responsável (OTP/link). |
| `CONSENT_EXPIRED` | Consentimento expirado por TTL ou renovação. |
| `CONSENT_REVOKED` | Revogado por responsável ou por compliance. |
| `CONSENT_TEXT_VERSION_REQUIRED` | Texto exibido sem versão referenciada. |
| `CONSENT_POLICY_BLOCKED` | Política bloqueia o recurso; consentimento não libera. |
| `CONSENT_GUARDIAN_NOT_VERIFIED` | Verificação do responsável incompleta. |
| `CONSENT_PURPOSE_MISMATCH` | Finalidade do consentimento não cobre o uso pretendido. |

### 2.3 Safety Signals (`SAFETY_*`)

| Code | Significado |
|---|---|
| `SAFETY_NO_RISK_SIGNAL` | Evento sem sinal de risco relevante. |
| `SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` | Mensagem privada de desconhecido para menor. |
| `SAFETY_ADULT_MINOR_HIGH_FREQUENCY_24H` | Alta frequência adulto–menor em 24h. |
| `SAFETY_MEDIA_UPLOAD_TO_MINOR` | Upload de mídia para menor. |
| `SAFETY_EXTERNAL_LINK_TO_MINOR` | Link externo enviado para menor. |
| `SAFETY_MULTIPLE_REPORTS_AGAINST_ACTOR` | Múltiplos reports contra o ator. |
| `SAFETY_POLICY_REQUIRES_HUMAN_REVIEW` | Política exige revisão humana. |
| `SAFETY_STEP_UP_REQUIRED` | Necessário step-up de age assurance. |
| `SAFETY_PARENTAL_CONSENT_CHECK_REQUIRED` | Necessário checar consentimento parental. |
| `SAFETY_ALERT_ACKNOWLEDGED` | Alerta confirmado por operador. |
| `SAFETY_ALERT_ESCALATED` | Alerta escalado para revisão humana superior. |

### 2.4 Política (`POLICY_*`)

| Code | Significado |
|---|---|
| `POLICY_NOT_FOUND` | Política referenciada não existe. |
| `POLICY_RETIRED` | Política aposentada; recurso bloqueado. |
| `POLICY_BLOCKED_RESOURCE` | Recurso bloqueado por regra (`blocked_if_minor`). |
| `POLICY_VERSION_MISMATCH` | Versão referenciada não bate com a ativa. |
| `POLICY_DOMAIN_NOT_SUPPORTED` | Política não cobre o domínio solicitado. |

### 2.5 Gateway (`GATEWAY_*`)

| Code | Significado |
|---|---|
| `GATEWAY_PROVIDER_NOT_CONFIGURED` | Provider sem configuração; **falha explícita, nunca aprova**. |
| `GATEWAY_PROVIDER_UNSUPPORTED` | Provider declarado mas sem adapter real. |
| `GATEWAY_ATTESTATION_INVALID` | Assinatura da attestation falhou. |

### 2.6 Credential (`CREDENTIAL_*`)

| Code | Significado |
|---|---|
| `CREDENTIAL_FEATURE_DISABLED` | Modo credential atrás de feature flag desligada. |
| `CREDENTIAL_TEST_VECTORS_REQUIRED` | Faltam test vectors para validar implementação. |
| `CREDENTIAL_ISSUER_UNTRUSTED` | Issuer não está em `issuers.trust_status = trusted`. |
| `CREDENTIAL_FORMAT_UNSUPPORTED` | Formato (W3C VC, SD-JWT VC) não suportado. |

### 2.7 ZKP (`ZKP_*`)

| Code | Significado |
|---|---|
| `ZKP_FEATURE_DISABLED` | Modo ZKP atrás de feature flag desligada. |
| `ZKP_LIBRARY_NOT_AVAILABLE` | Biblioteca BBS+/BLS12-381 ausente. |

> Reason codes legados de execução ZKP (`ZKP_PROOF_INVALID`, `ZKP_NONCE_MISMATCH`, `ZKP_PREDICATE_FAILED`, `ZKP_CURVE_UNSUPPORTED`) permanecem disponíveis em `packages/shared/src/reason-codes.ts`.

### 2.8 Privacidade (`PRIVACY_*`)

| Code | Significado |
|---|---|
| `PRIVACY_FORBIDDEN_CLAIM` | Privacy Guard rejeitou claim proibida. |
| `PRIVACY_CONTENT_NOT_ALLOWED_IN_V1` | Conteúdo bruto não permitido no MVP (Safety v1). |
| `PRIVACY_PII_BLOCKED` | PII bloqueada antes da serialização pública. |

### 2.9 Token (`TOKEN_*`)

| Code | Significado |
|---|---|
| `TOKEN_INVALID` | Assinatura/estrutura inválida. |
| `TOKEN_EXPIRED` | `exp` no passado. |
| `TOKEN_REVOKED` | `jti` revogado. |
| `TOKEN_AUDIENCE_MISMATCH` | `aud` não bate. |
| `TOKEN_RESOURCE_MISMATCH` | Token não cobre o recurso solicitado. |

### 2.10 Webhook (`WEBHOOK_*`)

| Code | Significado |
|---|---|
| `WEBHOOK_SIGNATURE_INVALID` | HMAC inválida. |
| `WEBHOOK_REPLAY_DETECTED` | Nonce repetido dentro da janela. |
| `WEBHOOK_TIMESTAMP_OUT_OF_WINDOW` | Timestamp fora da janela aceita. |
| `WEBHOOK_DELIVERY_FAILED` | Entrega falhou após tentativas. |

### 2.11 Retenção (`RETENTION_*`)

| Code | Significado |
|---|---|
| `RETENTION_CLASS_UNKNOWN` | Classe de retenção desconhecida. |
| `RETENTION_LEGAL_HOLD_ACTIVE` | Legal hold ativo; cleanup bloqueado. |
| `RETENTION_CLEANUP_FAILED` | Job de cleanup falhou; gera audit_event. |

### 2.12 Sistema (`SYSTEM_*`)

| Code | Significado |
|---|---|
| `SYSTEM_INTERNAL_ERROR` | Erro genérico; log com `trace_id`. |
| `SYSTEM_RATE_LIMITED` | Bucket esgotado. |
| `SYSTEM_INVALID_REQUEST` | Payload rejeitado por schema. |

## 3. Termos proibidos

A camada canônica varre, em testes, a presença dos seguintes termos em qualquer reason code descrito (case-insensitive):

```
crime, criminoso, criminal, predador, pedofilo, pedophile,
abuso_comprovado, proven_abuse, identidade_real, real_identity,
civil_id_proven, kyc_completed, face_match_confirmed
```

Nenhum reason code do AgeKey pode utilizar essas palavras como rótulo ou descrição programática.
