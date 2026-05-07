# Privacy Guard — AgeKey Safety Signals

## Três camadas de defesa

1. **Boundary check** (`rejectForbiddenIngestKeys`) — corre **antes do
   Zod**. Detecta:
   - Chaves de conteúdo bruto: `message`, `raw_text`, `text`, `body`,
     `content`, `image`, `image_data`, `video`, `video_data`, `audio`,
     `audio_data`, `attachment`, `attachment_data`, `transcript`,
     `caption`.
   - Chaves de PII: lista canônica do privacy guard +
     `latitude`, `longitude`, `gps`, `lat`, `lng`, `lon`.
   Retorna o reason code adequado (`SAFETY_RAW_CONTENT_REJECTED` ou
   `SAFETY_PII_DETECTED`) imediatamente.
2. **Schema strict** (`SafetyEventIngestRequestSchema`) —
   `.strict()` rejeita qualquer chave extra; `content_processed` e
   `content_stored` são `z.literal(false)` — qualquer outra coisa
   falha.
3. **CHECK SQL** (`safety_jsonb_has_no_forbidden_keys`) —
   `safety_events.metadata`, `rule_eval`, `safety_subjects.metadata`,
   `safety_alerts.metadata`, `safety_rules.condition_json`,
   `safety_rules.action_json`, `safety_model_runs.metadata` e
   `safety_interactions.metadata` rejeitam INSERT/UPDATE com chave
   proibida. CHECK adicional em `safety_events`:
   `content_processed = false AND content_stored = false`.

## Privacy guard canônico

Todas as saídas (response, webhook payload, audit diff, log structured)
passam por `assertPublicPayloadHasNoPii(payload)`. O guard usa a **mesma
lista canônica** do Core, garantindo que mesmo que um desenvolvedor
acidentalmente coloque um `email` no metadata, o egress é bloqueado.

## Lista canônica de chaves bloqueadas

Mesma de `packages/shared/src/privacy-guard.ts`:

```
birthdate, date_of_birth, dob, idade, age, exact_age, birth_date,
birthday, data_nascimento, nascimento,
document, cpf, cnh, rg, passport, passport_number, id_number,
civil_id, social_security, ssn,
name, full_name, nome, nome_completo, first_name, last_name,
email, phone, mobile, telefone,
address, endereco, street, postcode, zipcode,
selfie, face, face_image, biometric, biometrics, raw_id
```

Safety acrescenta na borda de ingest:

```
message, raw_text, text, body, content,
image, image_data, video, video_data, audio, audio_data,
attachment, attachment_data, transcript, caption,
latitude, longitude, gps, lat, lng, lon
```

## payload_hash

Hash SHA-256 hex do envelope canônico (chaves ordenadas
recursivamente). Usado:
- como `payload_hash` no webhook (anchor anti-tampering),
- em `audit_events.diff_json.payload_hash`,
- em logs estruturados.
