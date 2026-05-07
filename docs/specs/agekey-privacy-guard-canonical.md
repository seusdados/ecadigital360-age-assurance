# AgeKey — Privacy Guard (canônico)

> Status: contrato canônico da Rodada 1.
> Implementação: `packages/shared/src/privacy/`.
> Substitui (mantendo compatibilidade) `packages/shared/src/privacy-guard.ts` legado.

## 1. Finalidade

O Privacy Guard é o último ponto de bloqueio entre uma estrutura de dados interna e qualquer saída pública do AgeKey: token assinado, webhook entregue, resposta de SDK, resposta de widget, resposta de API pública e visões minimizadas do painel admin.

Ele atravessa o payload em profundidade (objetos e arrays), normaliza chaves (case-insensitive, underscore/hífen) e bloqueia chaves proibidas conforme o **perfil de saída** escolhido pelo caller.

## 2. Listas canônicas

### 2.1 Núcleo proibido (`CORE_FORBIDDEN_KEYS`)

Identidade civil, idade real, biometria, endereço, contato e geolocalização precisa:

```
name, full_name, first_name, last_name, civil_name, username_civil,
cpf, rg, passport, document, document_number, id_number, civil_id,
raw_id, raw_document, identity_scan,

birthdate, date_of_birth, dob, idade, age, exact_age,

selfie, face, faceprint, biometric, biometric_template,

address, address_full,

email, phone, guardian_email, guardian_phone, guardian_name,

ip, raw_ip, gps, latitude, longitude, location_precise
```

### 2.2 Conteúdo bruto e mídia (`CONTENT_FORBIDDEN_KEYS`)

Sempre proibidos em payload público; também proibidos em ingestão Safety v1:

```
raw_text, message, message_body, image, image_data,
video, video_data, audio, audio_data
```

### 2.3 Exceções controladas (`ALLOWED_AGE_POLICY_KEYS`)

Estas representam **regras da política** ou **estados de elegibilidade**, nunca a idade real do usuário:

```
minimum_age, age_threshold, policy_age_threshold,
age_over_13, age_over_16, age_over_18, age_over_21,
age_band_policy, actor_age_band, counterparty_age_band,
subject_age_state, age_band_min, age_band_max
```

> Atenção: `age` e `exact_age` continuam proibidos. Apenas as chaves listadas acima são permitidas, e somente quando descreverem a regra (não a pessoa).

## 3. Perfis (`PrivacyGuardProfile`)

| Perfil | Uso | Bloqueia conteúdo bruto | Bloqueia contato do responsável |
|---|---|---|---|
| `public_token` | Claims do `result_token`/`parental_consent_token` antes de assinar | sim | sim |
| `webhook` | Payload `AgeKeyWebhookPayload` antes da assinatura HMAC | sim | sim |
| `sdk_response` | Resposta entregue ao SDK JS | sim | sim |
| `widget_response` | postMessage do widget para a página hospedeira | sim | sim |
| `public_api_response` | Resposta de qualquer endpoint público | sim | sim |
| `admin_minimized_view` | Lista/listagem no painel admin (visão por linha) | sim | sim |
| `audit_internal` | `audit_events` com hashes/HMACs/payload_hash | sim | sim (contato do responsável também é PII em audit) |
| `safety_event_v1` | Ingestão de evento Safety MVP (metadata-only) | sim | sim |
| `guardian_contact_internal` | Tabelas `guardian_contacts` (server-side) | sim | **não** (único perfil que tolera `guardian_email`/`guardian_phone`/`guardian_name`) |

## 4. Erro padrão

Toda violação levanta:

```ts
throw new PrivacyGuardForbiddenClaimError(profile, violations);
// .reasonCode === "AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM"
```

Edge Functions traduzem esse erro em HTTP 500 com `reason_code = "PRIVACY_FORBIDDEN_CLAIM"` e `trace_id`. **Nunca expor a estrutura completa do payload** ao cliente externo — apenas indicar que houve bloqueio.

## 5. Uso esperado

```ts
import {
  assertPayloadSafe,
  isPayloadSafe,
  findPrivacyViolations,
} from '@agekey/shared';

assertPayloadSafe(tokenClaims, 'public_token');
assertPayloadSafe(webhookPayload, 'webhook');
assertPayloadSafe(safetyEvent, 'safety_event_v1');

if (!isPayloadSafe(adminRow, 'admin_minimized_view')) {
  // Caminho defensivo de logging.
}
```

## 6. Compatibilidade com o guard legado

`packages/shared/src/privacy-guard.ts` permanece exportado (`assertPublicPayloadHasNoPii`, `findForbiddenPublicPayloadKeys`, `redactTokenForDisplay`) para não quebrar Edge Functions e admin que já o usam. O guard legado é uma versão mais restrita do perfil `public_api_response` canônico.

A migração recomendada é:

```ts
// antes
assertPublicPayloadHasNoPii(claims);

// depois
assertPayloadSafe(claims, 'public_token');
```

## 7. Testes

Testes mínimos da Rodada 1 cobrem:

- Bloqueio de cada chave de `CORE_FORBIDDEN_KEYS` em profundidade.
- Bloqueio de cada chave de `CONTENT_FORBIDDEN_KEYS` em perfis públicos e em `safety_event_v1`.
- Aceitação de `policy_age_threshold`, `age_threshold` e `age_over_18` em payload público.
- Tolerância exclusiva de `guardian_email` no perfil `guardian_contact_internal`.
- Erro padrão `AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM` com `violations` populadas.

Suíte: `packages/shared/__tests__/privacy-guard.test.ts`.
