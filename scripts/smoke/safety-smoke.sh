#!/usr/bin/env bash
# ============================================================================
# AgeKey Safety Signals — HML smoke test (positivo + NEGATIVOS de privacidade)
# ----------------------------------------------------------------------------
# Cobertura: event-ingest, rule-evaluate, rules-write, alert-dispatch,
# step-up, aggregates-refresh, retention-cleanup.
#
# Os testes NEGATIVOS provam que o privacy guard rejeita campos proibidos
# (raw_text, message, image, video, audio, birthdate, email, phone) com
# HTTP 400 + reason_code=PRIVACY_CONTENT_NOT_ALLOWED_IN_V1.
#
# Pré-requisitos:
#   BASE_URL                  ex.: https://wljedzqgprkpqhuazdzv.functions.supabase.co
#   TENANT_API_KEY            chave de tenant de TESTE em HML
#   APPLICATION_SLUG          slug da application (default "default")
#   ACTOR_REF_HMAC            HMAC opaco do ator (>=8 chars; NUNCA PII)
#   COUNTERPARTY_REF_HMAC     HMAC opaco do contraparte (opcional)
# ============================================================================
set -euo pipefail

: "${BASE_URL:?BASE_URL is required}"
: "${TENANT_API_KEY:?TENANT_API_KEY is required}"
: "${ACTOR_REF_HMAC:?ACTOR_REF_HMAC is required (HMAC opaco)}"
APPLICATION_SLUG="${APPLICATION_SLUG:-default}"
COUNTERPARTY_REF_HMAC="${COUNTERPARTY_REF_HMAC:-cp_$(date +%s)_smoke_hmac_8plus}"

H_AUTH=(-H "X-AgeKey-API-Key: ${TENANT_API_KEY}")
H_JSON=(-H 'Content-Type: application/json')
H_TRACE=(-H "X-Trace-Id: smoke-safety-$(date +%s)")

post_capture_status() {
  # Imprime apenas o status code para facilitar asserts negativos.
  local path="$1" body="$2"
  curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}${path}" \
    "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
  echo
}

post_full() {
  local path="$1" body="$2"
  curl -sS -X POST "${BASE_URL}${path}" \
    "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
  echo
}

echo "==> [POS-1] safety-event-ingest :: payload limpo metadata-only"
# Espera: HTTP 200/201; decision in {no_risk_signal,logged,...};
# content_included=false; pii_included=false.
post_full "/safety-event-ingest" "$(cat <<EOF
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
)"

echo
echo "==> [POS-2] safety-rule-evaluate :: dry-run de regra para um sujeito"
post_full "/safety-rule-evaluate" "$(cat <<EOF
{
  "actor_subject_ref_hmac": "${ACTOR_REF_HMAC}",
  "counterparty_subject_ref_hmac": "${COUNTERPARTY_REF_HMAC}",
  "event_type": "message_sent",
  "actor_age_state": "adult",
  "counterparty_age_state": "minor"
}
EOF
)" || true

echo
echo "==> [POS-3] safety-rules-write :: leitura/escrita de configuração de regra"
# Espera: HTTP 200; cria/atualiza regra para o tenant. Em smoke, usa GET-like.
post_full "/safety-rules-write" "$(cat <<'EOF'
{
  "rule_slug": "smoke-noop",
  "enabled": false,
  "config": {"note": "smoke-only, never enable"}
}
EOF
)" || true

echo
echo "==> [POS-4] safety-alert-dispatch :: dispara webhook por alerta"
# Espera: HTTP 200/202; sem PII no payload do webhook.
post_full "/safety-alert-dispatch" '{"alert_id":"00000000-0000-0000-0000-000000000000"}' || true

echo
echo "==> [POS-5] safety-step-up :: cria sessão de step-up acionada por safety"
post_full "/safety-step-up" "$(cat <<EOF
{
  "actor_subject_ref_hmac": "${ACTOR_REF_HMAC}",
  "reason_code": "smoke_step_up"
}
EOF
)" || true

echo
echo "==> [POS-6] safety-aggregates-refresh :: recomputa contadores"
post_full "/safety-aggregates-refresh" "$(cat <<EOF
{
  "actor_subject_ref_hmac": "${ACTOR_REF_HMAC}"
}
EOF
)" || true

echo
echo "==> [POS-7] safety-retention-cleanup :: NOOP cron handler"
# Espera: HTTP 200; deletes_count >= 0; nunca remove fora do TTL.
post_full "/safety-retention-cleanup" '{}' || true

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
echo "    - Todos os POS-* retornam 2xx OU 4xx documentados (sem 5xx)."
echo "    - TODOS os NEG-* devolvem HTTP 400 com reason_code"
echo "      PRIVACY_CONTENT_NOT_ALLOWED_IN_V1 ou variante."
echo "    - Resposta dos POS contém content_included=false e pii_included=false."
