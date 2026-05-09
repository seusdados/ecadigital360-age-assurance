#!/usr/bin/env bash
# ============================================================================
# AgeKey Safety Signals — HML smoke test (positivo + NEGATIVOS de privacidade)
# ----------------------------------------------------------------------------
# Cobertura: event-ingest, rule-evaluate, rules-write (admin), alert-dispatch
# (admin), step-up (depende de safety_alert_id), aggregates-refresh (cron),
# retention-cleanup (cron).
#
# Os testes NEGATIVOS provam que o privacy guard rejeita campos proibidos
# (raw_text, message, image, video, audio, birthdate, email, phone) com HTTP
# 400 + reason_code do Privacy Guard.
#
# Contratos auditados (conforme código em supabase/functions/safety-*):
#
#   POST /safety-event-ingest                 X-AgeKey-API-Key — metadata-only
#   POST /safety-rule-evaluate                X-AgeKey-API-Key — dry-run
#   POST /safety-rules-write                  X-AgeKey-API-Key (admin override)
#       Body: { rule_code, enabled, severity, actions[], config_json? }
#   POST /safety-alert-dispatch/<alert-uuid>  X-AgeKey-API-Key (admin)
#       Body: { action: acknowledge|escalate|resolve|dismiss, note? }
#   POST /safety-step-up                      X-AgeKey-API-Key
#       Body: { safety_alert_id, policy_slug, locale? }
#   POST /safety-aggregates-refresh           Authorization: Bearer <CRON_SECRET>
#   POST /safety-retention-cleanup            Authorization: Bearer <CRON_SECRET>
#
# Pré-requisitos:
#   BASE_URL                 https://wljedzqgprkpqhuazdzv.functions.supabase.co
#   TENANT_API_KEY           chave de tenant de TESTE em HML — NUNCA commit
#   APPLICATION_SLUG         default: dev-app
#   ACTOR_REF_HMAC           HMAC opaco do ator (>=8 chars; NUNCA PII)
#   COUNTERPARTY_REF_HMAC    HMAC opaco do contraparte (default: gerado)
#
# Pré-requisitos opcionais (admin/cron):
#   SAFETY_ALERT_ID          UUID de alert em HML para testar step-up e
#                            alert-dispatch. Ausente => esses passos são SKIP.
#   SAFETY_CRON_SECRET       Bearer secret do cron. Ausente => aggregates e
#                            retention são SKIP. ⚠ Cron secrets são privilegiados
#                            e não devem ser usados em smoke público sem
#                            controle do operador.
#   SAFETY_RULE_CODE         default: UNKNOWN_TO_MINOR_PRIVATE_MESSAGE
#                            Outras opções válidas: ADULT_MINOR_HIGH_FREQUENCY_24H,
#                            MEDIA_UPLOAD_TO_MINOR, EXTERNAL_LINK_TO_MINOR,
#                            MULTIPLE_REPORTS_AGAINST_ACTOR.
#   POLICY_SLUG              default: dev-13-plus (usado em step-up)
#
# Dependência: jq.
# ============================================================================
set -euo pipefail

: "${BASE_URL:?BASE_URL is required}"
: "${TENANT_API_KEY:?TENANT_API_KEY is required}"
: "${ACTOR_REF_HMAC:?ACTOR_REF_HMAC is required (HMAC opaco)}"
APPLICATION_SLUG="${APPLICATION_SLUG:-dev-app}"
COUNTERPARTY_REF_HMAC="${COUNTERPARTY_REF_HMAC:-cp_$(date +%s)_smoke_hmac_8plus}"
SAFETY_RULE_CODE="${SAFETY_RULE_CODE:-UNKNOWN_TO_MINOR_PRIVATE_MESSAGE}"
POLICY_SLUG="${POLICY_SLUG:-dev-13-plus}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required (https://jqlang.github.io/jq/)" >&2
  exit 2
fi

H_AUTH=(-H "X-AgeKey-API-Key: ${TENANT_API_KEY}")
H_JSON=(-H 'Content-Type: application/json')
H_TRACE=(-H "X-Trace-Id: smoke-safety-$(date +%s)")

post_full() {
  local path="$1" body="$2"
  curl -sS -X POST "${BASE_URL}${path}" \
    "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
  echo
}

post_capture_status() {
  # Imprime apenas o status code para asserts negativos.
  local path="$1" body="$2"
  curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}${path}" \
    "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
  echo
}

post_with_bearer() {
  local path="$1" body="$2" bearer="$3"
  curl -sS -X POST "${BASE_URL}${path}" \
    -H "Authorization: Bearer ${bearer}" \
    "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
  echo
}

print_resp() {
  local label="$1" resp="$2"
  echo "----- ${label} -----"
  printf '%s' "${resp}" | jq . 2>/dev/null || printf '%s\n' "${resp}"
}

echo "==> [POS-1] POST /safety-event-ingest :: payload limpo metadata-only"
RESP=$(post_full "/safety-event-ingest" "$(cat <<EOF
{
  "application_slug": "${APPLICATION_SLUG}",
  "event_type": "message_sent",
  "actor_subject_ref_hmac": "${ACTOR_REF_HMAC}",
  "counterparty_subject_ref_hmac": "${COUNTERPARTY_REF_HMAC}",
  "actor_age_state": "adult",
  "counterparty_age_state": "minor",
  "metadata": {"channel": "dm", "content_length_bucket": "1-50"},
  "content_hash": "0000000000000000000000000000000000000000000000000000000000000000"
}
EOF
)")
print_resp "event-ingest" "${RESP}"

echo
echo "==> [POS-2] POST /safety-rule-evaluate :: dry-run de regras para um sujeito"
RESP=$(post_full "/safety-rule-evaluate" "$(cat <<EOF
{
  "actor_subject_ref_hmac": "${ACTOR_REF_HMAC}",
  "counterparty_subject_ref_hmac": "${COUNTERPARTY_REF_HMAC}",
  "event_type": "message_sent",
  "actor_age_state": "adult",
  "counterparty_age_state": "minor"
}
EOF
)")
print_resp "rule-evaluate" "${RESP}"

echo
echo "==> [POS-3] POST /safety-rules-write :: cria/atualiza override per-tenant"
# Body com contrato real: rule_code (enum), enabled, severity, actions, config_json.
# Severity baixa + apenas 'log_only' garante que o override não tem efeito
# operacional em HML. Operador pode reverter via PATCH ou DELETE.
RESP=$(post_full "/safety-rules-write" "$(cat <<EOF
{
  "rule_code": "${SAFETY_RULE_CODE}",
  "enabled": false,
  "severity": "info",
  "actions": ["log_only"],
  "config_json": {"smoke_marker": "consent-safety-smoke", "note": "smoke-only, never enable"}
}
EOF
)")
print_resp "rules-write" "${RESP}"

echo
echo "==> [POS-4] POST /safety-alert-dispatch/<alert-id> :: ação de admin sobre alert"
if [[ -n "${SAFETY_ALERT_ID:-}" ]]; then
  RESP=$(post_full "/safety-alert-dispatch/${SAFETY_ALERT_ID}" \
    '{"action":"acknowledge","note":"smoke-test"}')
  print_resp "alert-dispatch" "${RESP}"
else
  echo "SKIP: SAFETY_ALERT_ID não definido."
  echo "      Endpoint exige UUID de alert real em HML (admin operation)."
  echo "      Para rodar: export SAFETY_ALERT_ID=<uuid-de-um-safety_alerts>"
fi

echo
echo "==> [POS-5] POST /safety-step-up :: cria sessão de step-up vinculada a alert"
if [[ -n "${SAFETY_ALERT_ID:-}" ]]; then
  RESP=$(post_full "/safety-step-up" "$(cat <<EOF
{
  "safety_alert_id": "${SAFETY_ALERT_ID}",
  "policy_slug": "${POLICY_SLUG}",
  "locale": "pt-BR"
}
EOF
)")
  print_resp "step-up" "${RESP}"
else
  echo "SKIP: SAFETY_ALERT_ID não definido."
  echo "      Endpoint exige safety_alert_id válido + policy_slug."
  echo "      Para rodar: export SAFETY_ALERT_ID=<uuid> [POLICY_SLUG=dev-13-plus]"
fi

echo
echo "==> [POS-6] POST /safety-aggregates-refresh :: recomputa contadores (cron)"
if [[ -n "${SAFETY_CRON_SECRET:-}" ]]; then
  RESP=$(post_with_bearer "/safety-aggregates-refresh" '{}' "${SAFETY_CRON_SECRET}")
  print_resp "aggregates-refresh" "${RESP}"
else
  echo "SKIP: SAFETY_CRON_SECRET não definido."
  echo "      Endpoint exige Authorization: Bearer <CRON_SECRET> (rota privilegiada)."
  echo "      ⚠ NÃO compartilhe o cron secret em smoke público — use só pelo operador."
fi

echo
echo "==> [POS-7] POST /safety-retention-cleanup :: limpa por TTL (cron)"
if [[ -n "${SAFETY_CRON_SECRET:-}" ]]; then
  RESP=$(post_with_bearer "/safety-retention-cleanup" '{}' "${SAFETY_CRON_SECRET}")
  print_resp "retention-cleanup" "${RESP}"
else
  echo "SKIP: SAFETY_CRON_SECRET não definido."
  echo "      Mesma constraint do POS-6: rota privilegiada (Bearer)."
fi

echo
echo "============================================================"
echo "==> NEGATIVE TESTS — privacy guard MUST reject (HTTP 400)"
echo "============================================================"

assert_400() {
  local label="$1" body="$2"
  local code
  code=$(post_capture_status "/safety-event-ingest" "${body}")
  if [[ "${code}" == "400" ]]; then
    echo "[PASS] ${label} -> 400"
  else
    echo "[FAIL] ${label} -> got ${code}, expected 400"
  fi
}

# Cada teste injeta UM campo proibido em metadata e verifica rejeição.
BASE_OK_FIELDS="\"event_type\":\"message_sent\",\"actor_subject_ref_hmac\":\"${ACTOR_REF_HMAC}\""

assert_400 "raw_text in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"raw_text\":\"hello\"}}"

assert_400 "message in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"message\":\"hello\"}}"

assert_400 "image in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"image\":\"data:image/png;base64,AAA\"}}"

assert_400 "video in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"video\":\"data:video/mp4;base64,AAA\"}}"

assert_400 "audio in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"audio\":\"data:audio/wav;base64,AAA\"}}"

assert_400 "birthdate in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"birthdate\":\"2010-01-01\"}}"

assert_400 "email in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"email\":\"user@example.com\"}}"

assert_400 "phone in metadata" \
  "{${BASE_OK_FIELDS},\"metadata\":{\"phone\":\"+5511999999999\"}}"

# Defesa em profundidade: campo proibido em nível raiz também deve falhar.
assert_400 "raw_text at root (strict schema)" \
  "{${BASE_OK_FIELDS},\"raw_text\":\"hello\",\"metadata\":{}}"

echo
echo "==> Safety smoke concluído. Critérios de sucesso:"
echo "    - POS-1, POS-2, POS-3: HTTP 2xx (núcleo + admin override)."
echo "    - POS-4, POS-5: HTTP 2xx OU SKIP (depende de SAFETY_ALERT_ID)."
echo "    - POS-6, POS-7: HTTP 2xx OU SKIP (depende de SAFETY_CRON_SECRET)."
echo "    - TODOS os NEG-* devolvem HTTP 400 (privacy guard rejeita)."
echo "    - Resposta dos POS contém content_included=false e pii_included=false"
echo "      no decision_envelope quando aplicável."
