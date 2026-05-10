# Smoke Test Pack — PROD Consent MVP (sem DEV_RETURN_OTP)

> ⛔ **NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL.**
> Este pack contém comandos preparados para smoke pós-ativação em PROD; **não** executá-los até a janela autorizada conforme `docs/release/prod-consent-mvp-execution-runbook.md` Fase 4.

---

## Diferenças críticas PROD vs HML

| Aspecto | HML | PROD |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | `true` | **NÃO setada** (proibido) |
| `dev_otp` na resposta de `guardian-start` | string com OTP cleartext | **`null`** |
| Provider OTP | `noop` (nenhuma entrega real) | **provider real** (Twilio/Mailgun/SES) |
| OTP entregue ao operador | n/a (vem na resposta) | **email/SMS real** ao `DEV_CONTACT_VALUE` |
| `DEV_CONTACT_VALUE` | fictício (`smoke@example.com`) | **contato real do operador** (ele precisa receber e ler o OTP) |

---

## 1. Smoke mínimo (sem DEV_RETURN_OTP)

### 1.1. Pré-requisitos

| Item | Valor |
|---|---|
| `BASE_URL` | `https://tpdiccnmsnjtjwhardij.functions.supabase.co` |
| `TENANT_API_KEY` | chave piloto PROD (raw, custodiada apenas pelo operador) |
| `APPLICATION_SLUG` | slug do tenant alvo (ex.: `dev-app` se tenant interno; outro se piloto externo) |
| `POLICY_SLUG` | policy compatível em PROD (ex.: `dev-13-plus` se tenant interno; outro slug para piloto externo) |
| `CHILD_REF_HMAC` | hash opaco; **nunca** PII |
| `DEV_CONTACT_VALUE` | contato real do operador (email ou telefone E.164) |
| `CONTACT_CHANNEL` | `email` ou `sms` conforme provider configurado |

### 1.2. Comandos (preparados)

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL — janela autorizada
export BASE_URL=https://tpdiccnmsnjtjwhardij.functions.supabase.co
export TENANT_API_KEY=<chave piloto PROD>
export APPLICATION_SLUG=<definido pelo operador>
export POLICY_SLUG=<definido pelo operador>
export CHILD_REF_HMAC=$(printf 'smoke-prod-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE=<contato real do operador>
export CONTACT_CHANNEL=email   # ou sms

bash scripts/smoke/consent-smoke.sh
```

### 1.3. Cuidados de segurança operacional

- Use `read -r -s TENANT_API_KEY` para ler a chave sem eco no terminal.
- `unset TENANT_API_KEY` ao final.
- Apague linhas do shell `history` que contenham a raw key.
- Nunca cole a raw key em chat, log, PR, comentário.
- Se a raw vazar, rotacionar imediatamente (mesmo procedimento dos PRs #65, #68, #74, #75 em HML).

---

## 2. Como testar sem expor PII

### 2.1. Placeholders seguros para `CHILD_REF_HMAC`

✅ **Use**: hashes opacos derivados de strings sintéticas:

```bash
CHILD_REF_HMAC=$(printf 'smoke-prod-child-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
# Resultado: 64 chars hex; opaco; nunca PII real
```

❌ **NUNCA**:
- hash de email real
- hash de CPF real
- hash de qualquer documento ou identidade real
- valor curto adivinhável

### 2.2. Placeholders seguros para `DEV_CONTACT_VALUE`

✅ **Use**: contato **real** do operador (necessário para receber OTP em PROD):
- `ops@<empresa>.com.br` (caixa monitorada pelo operador)
- `+55 11 9XXXX-XXXX` (número do operador)

❌ **NUNCA**:
- contato de cliente real
- contato de menor (proibido em qualquer caso)
- contato de pessoa não autorizada

### 2.3. Placeholders seguros para `APPLICATION_SLUG` / `POLICY_SLUG`

✅ Slugs canônicos (não-PII).

❌ Não use slugs que de alguma forma referenciem identidade real (ex.: `cliente-xyz-123-cpf-...`).

---

## 3. Como validar ausência de PII

### 3.1. Em respostas JSON

Para cada resposta capturada (especialmente `parental-consent-session`, `parental-consent-session-get`, `parental-consent-confirm`, `parental-consent-token-verify`):

```bash
# Salvar resposta sem expor a TENANT_API_KEY
RESP=$(curl -sS ... | jq .)

# Inspeção manual: nenhum dos seguintes campos deve conter texto claro real
echo "$RESP" | jq 'paths(scalars) as $p |
  {path: ($p | join(".")), value: getpath($p)}' \
  | grep -iE "@|\\+55|[0-9]{11}|[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}|[0-9]{4}-[0-9]{2}-[0-9]{2}" \
  || echo "OK: nenhum padrão PII detectado superficialmente"
```

Padrões verificados:
- `@` — email
- `+55` — telefone BR formato internacional
- `[0-9]{11}` — CPF/celular sem formatação
- `[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}` — CPF formatado
- `[0-9]{4}-[0-9]{2}-[0-9]{2}` — data (possível birthdate)

⚠ Esta é uma checagem **complementar**, não substitui o Privacy Guard server-side (que já bloqueia chaves canônicas em `forbidden-claims.ts`).

### 3.2. Verificação de `decision_envelope`

```bash
echo "$RESP" | jq '.decision_envelope | {content_included, pii_included}'
# Esperado: { "content_included": false, "pii_included": false }
```

### 3.3. `contact_masked` em `guardian-start`

```bash
echo "$RESP" | jq '.contact_masked'
# Esperado: string mascarada (ex.: "o***@empresa.com.br" ou "+55 (11) 9****-XXXX")
```

❌ Se vier o contato em claro: bug crítico, abort.

---

## 4. Como validar token (JWT)

### 4.1. Decodificar JWT (sem verificar assinatura)

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
TOKEN_JWT="<jwt obtido em parental-consent-confirm>"

# Header
printf '%s' "$TOKEN_JWT" | cut -d. -f1 | base64 -d 2>/dev/null | jq .

# Payload
printf '%s' "$TOKEN_JWT" | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```

### 4.2. Validações esperadas no payload

```jsonc
{
  "iss": "<issuer AgeKey configurado em PROD>",
  "sub": "<parental_consent_id ou identificador opaco>",
  "iat": 1234567890,
  "exp": 1234571490,
  "jti": "<uuid>",
  "agekey": {
    "decision_domain": "parental_consent",
    "decision": "approved",
    "decision_id": "<parental_consent_id>",
    "policy": { "id": "...", "slug": "...", "version": 1 },
    "consent_text_version_id": "<uuid>",
    "consent_assurance_level": "AAL-C1",
    // ...
  }
}
```

**NÃO deve conter**:
- ❌ `email`, `phone`, `cpf`, `name`, `birthdate` em texto claro
- ❌ `child_ref` em texto claro (apenas hash opaco se referenciado)
- ❌ `guardian_email`, `guardian_phone`, `guardian_name`

### 4.3. Verificar assinatura via endpoint

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
curl -sS -X POST "$BASE_URL/parental-consent-token-verify" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$TOKEN_JWT" '{token:$t}')" | jq .
# Esperado: { "valid": true, "revoked": false, "reason_code": "CONSENT_APPROVED", ... }
```

---

## 5. Como validar revoke

### 5.1. Procedimento (parte do smoke step 7)

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
PARENTAL_CONSENT_ID="<obtido em parental-consent-confirm>"
curl -sS -X POST "$BASE_URL/parental-consent-revoke/$PARENTAL_CONSENT_ID" \
  -H "X-AgeKey-API-Key: $TENANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason":"smoke-test-cleanup"}' | jq .
# Esperado: { "parental_consent_id":"...", "revoked_at":"<UTC>", "reason_code":"CONSENT_REVOKED", ... }
```

### 5.2. Validar revoke via token-verify (step 8)

```bash
curl -sS -X POST "$BASE_URL/parental-consent-token-verify" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$TOKEN_JWT" '{token:$t}')" | jq .
# Esperado: { "valid": false, "revoked": true, "reason_code": "TOKEN_REVOKED", ... }
```

---

## 6. Como validar audit

### 6.1. Read-only via MCP (não expor TENANT_API_KEY)

```python
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
mcp__execute_sql(project_id="tpdiccnmsnjtjwhardij", query="""
SELECT event_type, count(*)
FROM audit_events_2026_05  -- ajustar para partição corrente
WHERE created_at >= now() - interval '1 hour'
  AND event_type LIKE 'parental_consent%'
GROUP BY event_type
ORDER BY event_type;
""")
```

### 6.2. Eventos esperados após smoke completo

| event_type | Mínimo |
|---|---|
| `parental_consent_session_created` | ≥ 1 |
| `parental_consent_guardian_started` | ≥ 1 |
| `parental_consent_confirmed` | ≥ 1 |
| `parental_consent_token_verified` | ≥ 1 |
| `parental_consent_revoked` | ≥ 1 |
| `parental_consent_token_rejected` | ≥ 1 (após revoke) |

### 6.3. Sem PII nos audit events

`audit_events.payload` deve conter `payload_hash` e referências opacas; nunca contato/JWT em claro.

---

## 7. Como validar logs

### 7.1. Edge Functions logs (Dashboard ou MCP)

```python
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
mcp__get_logs(project_id="tpdiccnmsnjtjwhardij", service="edge-function")
```

### 7.2. Filtros úteis

- Por slug: `parental-consent-*`.
- Por status: `400`, `403`, `500`.
- Por trace_id (se operador anotou): correlacionar requests.

### 7.3. Alertas vermelhos

- ⛔ HTTP 500 em qualquer função Consent → investigar imediatamente.
- ⚠ HTTP 401 unexpected → conferir TENANT_API_KEY.
- ⚠ Latência > 5s → investigar pgsodium/vault performance.

---

## 8. Quais testes NÃO devem ser feitos em PROD

### 8.1. Privacy Guard negative tests

❌ **Não** rodar os 9 testes negativos do `safety-smoke.sh` em PROD.

Razão:
- Esses testes injetam PII falsa (`email`, `phone`, `birthdate`, `image base64`, etc.) em metadata para verificar que o Privacy Guard rejeita com HTTP 400.
- Em PROD, mesmo PII falsa pode acionar audit/alerta de tentativa indevida.
- Eles rodam contra Safety, **fora desta janela**.

✅ **Em PROD**: confiar que o Privacy Guard está validado em HML (referência: `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`).

### 8.2. Stress test / load test

❌ **Não** rodar load test em PROD na janela inicial. Pode causar:
- Rate limit estourado.
- Custos de provider OTP (cada OTP custa).
- Polução de audit events.

✅ Stress test em janela própria, em ambiente dedicado, **após** estabilização.

### 8.3. Smoke com múltiplos consents

❌ **Não** criar 100 consents de teste. **1 single end-to-end** é suficiente para validar.

### 8.4. Testes de upgrade simultâneo

❌ **Não** combinar release Consent com outras alterações na mesma janela. Manter escopo único.

### 8.5. Testes que envolvam contato de menor

⛔ **NUNCA** usar contato (email/telefone) de menor real no smoke. `DEV_CONTACT_VALUE` é do **operador adulto**.

### 8.6. Re-uso de tokens para múltiplas verificações

❌ Não testar comportamento de "re-uso" do mesmo `consent_request_id` ou `guardian_panel_token` — a especificação é one-shot por design.

---

## 9. Placeholders seguros — referência rápida

| Variável | Placeholder seguro |
|---|---|
| `CHILD_REF_HMAC` | `$(printf 'smoke-prod-child-%s' "$(date +%s)" \| openssl dgst -sha256 -hex \| awk '{print $2}')` |
| `RESOURCE` | `smoke-resource-001` ou `feature/social-feed` |
| `PURPOSE_CODES` | `["account_creation"]` |
| `DATA_CATEGORIES` | `["nickname"]` |
| `LOCALE` | `pt-BR` |
| `DEV_CONTACT_VALUE` | contato real do operador adulto |
| `CONTACT_CHANNEL` | `email` ou `sms` |

---

## 10. Checklist de smoke pós-ativação (8 passos)

| # | Endpoint | Esperado | Validação manual |
|---|---|---|---|
| 1 | POST `/parental-consent-session` | HTTP 200 | `decision_envelope.{content_included, pii_included} = false`; sem PII |
| 2 | GET `/parental-consent-session-get/<id>?token=…` | HTTP 200 | status=`awaiting_guardian` |
| 3 | GET `/parental-consent-text-get/<id>?token=…` | HTTP 200 | `text_body` + `text_hash` |
| 4 | POST `/parental-consent-guardian-start/<id>` | HTTP 200 | `dev_otp = null` (PROD); `contact_masked` aplicado |
| 5 | (manual) Operador recebe OTP em email/SMS | OTP válido | tempo < 60s típico |
| 6 | POST `/parental-consent-confirm/<id>` (com OTP real) | HTTP 200 | `parental_consent_id`, `token.jwt`, `decision=approved` |
| 7 | POST `/parental-consent-token-verify` (positivo) | HTTP 200 | `valid=true`, `revoked=false` |
| 8 | POST `/parental-consent-revoke/<parental_consent_id>` | HTTP 200 | `revoked_at` |
| 9 | POST `/parental-consent-token-verify` (pós-revoke) | HTTP 200 | `valid=false`, `revoked=true`, `reason_code=TOKEN_REVOKED` |

---

## 11. Critério agregado de smoke OK

- ✅ 8/8 steps passaram (HTTP 200, comportamentos esperados).
- ✅ Privacidade preservada (zero PII em respostas).
- ✅ JWT minimizado (sem birthdate/email/child_ref em claro).
- ✅ Audit events crescem.
- ✅ Logs sem stack trace.
- ✅ Token revogado detectado online.

Se algum critério falhar → acionar `docs/release/prod-consent-mvp-rollback-runbook.md`.

---

## Confirmações de não-ação (este pack como documento)

- ❌ Nada executado em PROD.
- ❌ Nenhuma chave/JWT/token real exibido.
- ❌ Nenhum contato real exibido.
- ✅ Apenas instruções e placeholders seguros.
