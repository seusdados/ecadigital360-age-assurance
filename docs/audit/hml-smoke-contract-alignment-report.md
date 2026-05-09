# HML — Smoke contract alignment report

> **Status**: ✅ Scripts atualizados em branch `claude/fix-hml-smoke-contracts`. Sem deploy. Sem alteração em PROD/HML/schema/migrations/RLS/dados/flags. Sem segredos expostos.
>
> Branch: `claude/fix-hml-smoke-contracts`.
> Arquivos: `scripts/smoke/consent-smoke.sh`, `scripts/smoke/safety-smoke.sh`, este relatório.

## 1. Contexto

Após o merge do PR #66 (`fix(shared): accept timezone offsets in DecisionEnvelope expires_at`) e do redeploy via workflow GHA, o operador re-rodou os smokes em HML com a `TENANT_API_KEY` rotacionada (PR #65).

### 1.1. Bug `DecisionEnvelope` — RESOLVIDO ✅

`parental-consent-session` agora retorna **HTTP 200**:
- Gera `consent_request_id`.
- Gera `guardian_panel_token`.
- Retorna `policy{}`, `consent_text{}`.
- Retorna `decision_envelope` com `expires_at` em formato `+00:00` aceito.

Esta é a evidência end-to-end que valida a Opção A (schema-level fix em `packages/shared/src/decision/decision-envelope.ts` linha 127).

### 1.2. Falhas remanescentes — todas por **divergência de contrato** entre os scripts e os endpoints. Não são bugs runtime.

## 2. Contratos reais auditados (por leitura de código)

### 2.1. Consent (7 endpoints)

| # | Endpoint | Método | URL real | Auth | Body |
|---|---|---|---|---|---|
| 1 | `parental-consent-session` | POST | `/parental-consent-session` | `X-AgeKey-API-Key` | `{application_slug, policy_slug, resource, purpose_codes, data_categories, locale, child_ref_hmac}` |
| 2 | `parental-consent-session-get` | GET | `/parental-consent-session-get/<UUID>?token=<panel_token>` | api_key OR panel_token (**path-based UUID**) | (none) |
| 3 | `parental-consent-text-get` | GET | `/parental-consent-text-get/<UUID>?token=<panel_token>` | **panel_token apenas** | (none) |
| 4 | `parental-consent-guardian-start` | POST | `/parental-consent-guardian-start/<UUID>` | guardian_panel_token **no body** | `{guardian_panel_token, contact_channel, contact_value}` |
| 5 | `parental-consent-confirm` | POST | `/parental-consent-confirm/<UUID>` | guardian_panel_token **no body** | `{guardian_panel_token, otp, decision: "approve"\|"deny", consent_text_version_id}` |
| 6 | `parental-consent-token-verify` | POST | `/parental-consent-token-verify` | nenhum | `{token, expected_audience?}` ← campo é **`token`**, não `jwt` |
| 7 | `parental-consent-revoke` | POST | `/parental-consent-revoke/<parental_consent_id-UUID>` | api_key OR `?token=<panel_token>` | `{reason}` |

**Roteamento dos endpoints 2-5 e 7**: o UUID vem **no path** (extraído via regex `/^[0-9a-f-]{36}$/` do último segmento), não como query/body — código em `extractRequestId(url)` em cada função.

### 2.2. Safety (7 endpoints)

| # | Endpoint | Auth | Body |
|---|---|---|---|
| 1 | `safety-event-ingest` (POST) | `X-AgeKey-API-Key` | metadata-only (privacy guard ativo) |
| 2 | `safety-rule-evaluate` (POST) | `X-AgeKey-API-Key` | dry-run |
| 3 | `safety-rules-write` (POST) | `X-AgeKey-API-Key` (admin) | **`{rule_code, enabled, severity, actions[], config_json?}`** — não `rule_slug/config` |
| 4 | `safety-alert-dispatch/<alert-uuid>` (POST) | `X-AgeKey-API-Key` (admin) | **`{action: acknowledge\|escalate\|resolve\|dismiss, note?}`** — UUID no path |
| 5 | `safety-step-up` (POST) | `X-AgeKey-API-Key` | **`{safety_alert_id, policy_slug, locale?}`** |
| 6 | `safety-aggregates-refresh` (POST) | **`Authorization: Bearer <CRON_SECRET>`** | `{}` |
| 7 | `safety-retention-cleanup` (POST) | **`Authorization: Bearer <CRON_SECRET>`** | `{}` |

`SafetyRuleCode` (enum válido para `safety-rules-write`):
- `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` (default no script)
- `ADULT_MINOR_HIGH_FREQUENCY_24H`
- `MEDIA_UPLOAD_TO_MINOR`
- `EXTERNAL_LINK_TO_MINOR`
- `MULTIPLE_REPORTS_AGAINST_ACTOR`

`SafetyAction` válidos: `log_only`, `request_step_up`, `request_parental_consent_check`, `soft_block`, `hard_block`, `notify_safety_team`, `escalate_to_human_review`, `rate_limit_actor`.

`SafetySeverity`: `info`, `low`, `medium`, `high`, `critical`.

## 3. Alterações no `consent-smoke.sh`

### 3.1. Defaults de slug atualizados para HML

```diff
- APPLICATION_SLUG="${APPLICATION_SLUG:-default}"
- POLICY_SLUG="${POLICY_SLUG:-age-13-br-parental}"
+ APPLICATION_SLUG="${APPLICATION_SLUG:-dev-app}"
+ POLICY_SLUG="${POLICY_SLUG:-dev-13-plus}"
```

### 3.2. Roteamento path-based para os 5 endpoints que precisavam

- `parental-consent-session-get/<UUID>?token=<token>`
- `parental-consent-text-get/<UUID>?token=<token>`
- `parental-consent-guardian-start/<UUID>`
- `parental-consent-confirm/<UUID>`
- `parental-consent-revoke/<parental_consent_id>`

### 3.3. `token-verify` — corrigido o nome do campo

```diff
- {"jwt":"${TOKEN_JWT}"}
+ {"token":"${TOKEN_JWT}"}
```

### 3.4. `revoke` — usa `parental_consent_id` no path, não `consent_request_id` no body

O endpoint extrai um UUID do path; o body só carrega `{reason}`. O ID correto é `parental_consent_id`, retornado por `parental-consent-confirm` (etapa 5).

### 3.5. Parsing JSON robusto via `jq`

Substituí `grep -oE` (que pegava o **primeiro** `"id":"<uuid>"` da resposta — o `consent_request_id` — quando devia pegar `consent_text.id`) por `jq -r '.consent_text.id'`. O bug afetava o `consent_text_version_id` enviado em `confirm`. Adicionei guard `command -v jq` no início.

### 3.6. SKIP graceful

Etapas downstream (`confirm`, `token-verify`, `revoke`, post-revoke verify) só rodam se etapas upstream produziram os IDs/tokens necessários. Não fazem mais `|| true` que mascarava erros.

## 4. Alterações no `safety-smoke.sh`

### 4.1. `safety-rules-write` com contrato correto

```diff
  {
-   "rule_slug": "smoke-noop",
+   "rule_code": "UNKNOWN_TO_MINOR_PRIVATE_MESSAGE",
    "enabled": false,
-   "config": {"note": "smoke-only, never enable"}
+   "severity": "info",
+   "actions": ["log_only"],
+   "config_json": {"smoke_marker": "consent-safety-smoke", "note": "smoke-only, never enable"}
  }
```

`severity: info` + `actions: [log_only]` + `enabled: false` garante override **inerte** em HML — operador pode reverter via PATCH/DELETE.

`SAFETY_RULE_CODE` exposto como env var (default `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE`).

### 4.2. `safety-step-up` e `safety-alert-dispatch` — SKIP condicional

Esses endpoints exigem um `safety_alert_id` válido. O smoke não cria alerts (Safety v1 só cria alerts de regra disparada por evento real). Sem alert, eles falhariam por `404 alert not found` ou `400 invalid alert id`.

```bash
if [[ -n "${SAFETY_ALERT_ID:-}" ]]; then
  ...
else
  echo "SKIP: SAFETY_ALERT_ID não definido. ..."
fi
```

Documentação inline: o operador exporta `SAFETY_ALERT_ID=<uuid>` para rodar.

### 4.3. `safety-aggregates-refresh` e `safety-retention-cleanup` — SKIP condicional

Cron endpoints exigem `Authorization: Bearer ${SAFETY_CRON_SECRET}`. Sem o secret, retornam 403 (visto nos logs HML do smoke anterior — comportamento correto). Agora o script faz SKIP explícito com aviso de privilégio:

```bash
if [[ -n "${SAFETY_CRON_SECRET:-}" ]]; then
  post_with_bearer "/safety-aggregates-refresh" '{}' "${SAFETY_CRON_SECRET}"
else
  echo "SKIP: SAFETY_CRON_SECRET não definido. ..."
  echo "      ⚠ NÃO compartilhe o cron secret em smoke público."
fi
```

### 4.4. Defaults atualizados para HML

```diff
- APPLICATION_SLUG="${APPLICATION_SLUG:-default}"
+ APPLICATION_SLUG="${APPLICATION_SLUG:-dev-app}"
+ POLICY_SLUG="${POLICY_SLUG:-dev-13-plus}"
+ SAFETY_RULE_CODE="${SAFETY_RULE_CODE:-UNKNOWN_TO_MINOR_PRIVATE_MESSAGE}"
```

### 4.5. Helpers de output via `jq`

`print_resp` formata respostas com `jq .` para leitura humana, sem alterar o body original quando jq falha.

## 5. Validação local

### 5.1. Comandos

| Comando | Resultado |
|---|---|
| `bash -n scripts/smoke/consent-smoke.sh` | sintaxe válida ✅ |
| `bash -n scripts/smoke/safety-smoke.sh` | sintaxe válida ✅ |
| `pnpm test` (raiz, recursivo) | 359/359 ✅ (sem regressões; scripts `.sh` não interferem) |
| `pnpm typecheck` (raiz, recursivo) | 6/6 ✅ |

### 5.2. Não roda

Os scripts em si **não foram executados** nesta sessão — eles dependem de:
- Conectividade com HML (`*.functions.supabase.co`).
- `TENANT_API_KEY` real (apenas o operador tem).
- Opcionalmente `SAFETY_ALERT_ID` e `SAFETY_CRON_SECRET`.

Validação end-to-end fica para o operador.

## 6. Pendências de smoke (operador)

Após merge desta PR, o operador roda em HML:

```bash
export BASE_URL=https://wljedzqgprkpqhuazdzv.functions.supabase.co
export TENANT_API_KEY=<sua chave HML — NUNCA committar>
export APPLICATION_SLUG=dev-app
export POLICY_SLUG=dev-13-plus
export CHILD_REF_HMAC=$(printf 'smoke-child-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export ACTOR_REF_HMAC=$(printf 'smoke-actor-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="smoke+test@example.com"

bash scripts/smoke/consent-smoke.sh
bash scripts/smoke/safety-smoke.sh
```

### 6.1. Esperados (Consent)

| # | Etapa | Esperado |
|---|---|---|
| 1 | `parental-consent-session` | HTTP 200, `consent_request_id`, `guardian_panel_token`, `consent_text.id`, `decision_envelope` ✅ (já validado) |
| 2 | `session-get/<id>?token=` | HTTP 200, `status=awaiting_guardian` |
| 3 | `text-get/<id>?token=` | HTTP 200, `text_body` + `text_hash` |
| 4 | `guardian-start/<id>` | HTTP 200, `dev_otp` (HML), `contact_masked` |
| 5 | `confirm/<id>` | HTTP 200, `parental_consent_id`, `token.jwt` |
| 6 | `token-verify` | HTTP 200, `valid=true`, `revoked=false` |
| 7 | `revoke/<parental_consent_id>` | HTTP 200, `revoked_at` |
| 8 | `token-verify` pós-revoke | HTTP 200, `valid=false`, `revoked=true`, `reason_code=TOKEN_REVOKED` |

### 6.2. Esperados (Safety)

| # | Etapa | Esperado |
|---|---|---|
| POS-1 | `event-ingest` | HTTP 200, `decision_envelope.content_included=false`, `pii_included=false` |
| POS-2 | `rule-evaluate` | HTTP 200 |
| POS-3 | `rules-write` | HTTP 200, `status: created\|updated` (para `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` desabilitado) |
| POS-4 | `alert-dispatch/<alert-id>` | HTTP 200 com `SAFETY_ALERT_ID` definido; SKIP caso contrário |
| POS-5 | `step-up` | HTTP 200 com `SAFETY_ALERT_ID` definido; SKIP caso contrário |
| POS-6 | `aggregates-refresh` | HTTP 200 com `SAFETY_CRON_SECRET`; SKIP caso contrário |
| POS-7 | `retention-cleanup` | HTTP 200 com `SAFETY_CRON_SECRET`; SKIP caso contrário |
| NEG-* | event-ingest com PII / raw content | HTTP 400 (privacy guard rejeita) |

## 7. Constraints respeitadas

- ❌ Não toquei em PROD (`tpdiccnmsnjtjwhardij`).
- ❌ Não rodei `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Não alterei schema, migrations, RLS, dados ou feature flags em HML/PROD.
- ❌ Não fiz redeploy de Edge Functions nesta PR.
- ❌ Não disparei o workflow `Deploy HML Edge Functions`.
- ❌ Não usei nem incorporei `TENANT_API_KEY` (raw key fica só com operador).
- ❌ Não usei a chave antiga (rotacionada em PR #65).
- ✅ Apenas: 2 scripts shell + este relatório de auditoria.

## 8. Próximos passos (após merge)

1. **Operador**: re-roda `bash scripts/smoke/consent-smoke.sh` em HML.
2. **Operador**: re-roda `bash scripts/smoke/safety-smoke.sh` em HML; opcionalmente exporta `SAFETY_ALERT_ID` e `SAFETY_CRON_SECRET` para cobrir admin/cron.
3. **Operador**: reporta resultados (status, content_included/pii_included, eventuais 5xx).
4. **Claude**: se algum 5xx aparecer, investigo via logs MCP e proponho fix em PR separado.
5. **Cleanup opcional**: a linha órfã `parental_consent_requests.019e0cd2-a400-797e-bfe7-5776775ce2bf` (criada no smoke pré-fix) expira sozinha em 24h — sem ação imediata.
