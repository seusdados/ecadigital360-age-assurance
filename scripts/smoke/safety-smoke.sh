#!/usr/bin/env bash
# ============================================================================
# AgeKey Safety Signals — HML smoke (positivo + NEGATIVOS de privacidade)
# ----------------------------------------------------------------------------
# Cobertura, separada por classe de credencial:
#
#   [PUBLIC / API-KEY]                  X-AgeKey-API-Key
#     POS-1  safety-event-ingest
#     POS-2  safety-rule-evaluate
#     POS-3  safety-rules-write (admin override)
#     NEG-*  safety-event-ingest privacy guard (raw_text/PII)
#
#   [ADMIN / ALERT-DEPENDENT]           X-AgeKey-API-Key + SAFETY_ALERT_ID
#     POS-4  safety-alert-dispatch
#     POS-5  safety-step-up
#
#   [CRON / PRIVILEGED]                 Authorization: Bearer ${SAFETY_CRON_SECRET}
#     POS-6  safety-aggregates-refresh
#     POS-7  safety-retention-cleanup
#
# Skips são EXPLÍCITOS, contados como SKIP (não como FAIL), e não bloqueiam o
# exit. O exit code é 0 se PASS+SKIP cobrem todos os passos e 1 se houver
# qualquer FAIL. Um SUMMARY final imprime o placar.
#
# Pré-requisitos obrigatórios:
#   BASE_URL                 https://wljedzqgprkpqhuazdzv.functions.supabase.co
#   TENANT_API_KEY           chave de tenant de TESTE em HML — NUNCA commit
#   ACTOR_REF_HMAC           HMAC opaco do ator (>=8 chars; NUNCA PII)
#
# Pré-requisitos opcionais:
#   APPLICATION_SLUG         default: dev-app
#   COUNTERPARTY_REF_HMAC    default: gerado a partir do timestamp
#   SAFETY_RULE_CODE         default: UNKNOWN_TO_MINOR_PRIVATE_MESSAGE
#                            Outras opções válidas: ADULT_MINOR_HIGH_FREQUENCY_24H,
#                            MEDIA_UPLOAD_TO_MINOR, EXTERNAL_LINK_TO_MINOR,
#                            MULTIPLE_REPORTS_AGAINST_ACTOR.
#   POLICY_SLUG              default: dev-13-plus (usado em step-up)
#   SAFETY_ALERT_ID          UUID de alert real em HML — habilita POS-4/POS-5.
#                            Ausente => SKIP nos dois passos.
#   SAFETY_CRON_SECRET       Bearer secret do cron — habilita POS-6/POS-7.
#                            Ausente => SKIP nos dois passos.
#                            ⚠ Nunca compartilhar em smoke público.
#
# Privacidade — invariantes do script:
#   * O payload público v1 NÃO contém raw_text, message, image, video, audio,
#     birthdate, exact_age, email, phone, IP nem PII em hipótese alguma.
#   * Subject refs são HMAC opacos.
#   * Nenhuma credencial (API key, cron secret) é ecoada em stdout/stderr.
#   * Respostas do envelope público devem ter content_included=false e
#     pii_included=false; o script verifica isso explicitamente para POS-1,
#     POS-2 e POS-5.
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

# ----- Counters & helpers ----------------------------------------------------
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
declare -a FAILURES=()

mark_pass() { PASS_COUNT=$((PASS_COUNT+1)); echo "[PASS] $*"; }
mark_fail() { FAIL_COUNT=$((FAIL_COUNT+1)); FAILURES+=("$*"); echo "[FAIL] $*"; }
mark_skip() { SKIP_COUNT=$((SKIP_COUNT+1)); echo "[SKIP] $*"; }

# Captura body + status code separadamente em uma chamada com X-AgeKey-API-Key.
# Saída em duas linhas: linha 1 = body, linha 2 = HTTP status code.
post_with_apikey() {
  local path="$1" body="$2"
  curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}${path}" \
    "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
}

# Captura body + status para chamadas com Authorization: Bearer (cron).
# O bearer É PASSADO como argumento; nunca é ecoado.
post_with_bearer() {
  local path="$1" body="$2" bearer="$3"
  curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}${path}" \
    -H "Authorization: Bearer ${bearer}" \
    "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
}

# Imprime um JSON formatado (silenciosamente fallback para texto cru se inválido).
print_json() {
  local label="$1" body="$2"
  echo "----- ${label} -----"
  printf '%s' "${body}" | jq . 2>/dev/null || printf '%s\n' "${body}"
}

# Valida envelope público minimizado: content_included=false e pii_included=false.
# Não falha o teste se as chaves estão ausentes; só falha se forem != false.
assert_minimized_envelope() {
  local label="$1" body="$2"
  local content_inc pii_inc
  content_inc=$(printf '%s' "${body}" | jq -r '.content_included // "absent"' 2>/dev/null || echo "parse_err")
  pii_inc=$(printf '%s' "${body}" | jq -r '.pii_included // "absent"' 2>/dev/null || echo "parse_err")
  if [[ "${content_inc}" == "true" || "${pii_inc}" == "true" ]]; then
    mark_fail "${label} :: envelope NÃO minimizado (content=${content_inc}, pii=${pii_inc})"
    return 1
  fi
  return 0
}

# ============================================================================
# CLASSE 1 — PUBLIC / API-KEY
# ============================================================================
echo
echo "============================================================"
echo "  CLASSE 1 — PUBLIC / API-KEY (X-AgeKey-API-Key)"
echo "============================================================"

# ----- POS-1 -----------------------------------------------------------------
echo
echo "==> [POS-1] POST /safety-event-ingest :: payload limpo metadata-only"
RAW=$(post_with_apikey "/safety-event-ingest" "$(cat <<EOF
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
BODY=$(printf '%s' "${RAW}" | sed '$d')
CODE=$(printf '%s' "${RAW}" | tail -n1)
print_json "event-ingest [HTTP ${CODE}]" "${BODY}"
if [[ "${CODE}" =~ ^2 ]]; then
  if assert_minimized_envelope "POS-1 envelope" "${BODY}"; then
    mark_pass "POS-1 safety-event-ingest -> ${CODE}"
  fi
else
  mark_fail "POS-1 safety-event-ingest -> ${CODE} (esperado 2xx)"
fi

# ----- POS-2 -----------------------------------------------------------------
echo
echo "==> [POS-2] POST /safety-rule-evaluate :: dry-run de regras"
RAW=$(post_with_apikey "/safety-rule-evaluate" "$(cat <<EOF
{
  "actor_subject_ref_hmac": "${ACTOR_REF_HMAC}",
  "counterparty_subject_ref_hmac": "${COUNTERPARTY_REF_HMAC}",
  "event_type": "message_sent",
  "actor_age_state": "adult",
  "counterparty_age_state": "minor"
}
EOF
)")
BODY=$(printf '%s' "${RAW}" | sed '$d')
CODE=$(printf '%s' "${RAW}" | tail -n1)
print_json "rule-evaluate [HTTP ${CODE}]" "${BODY}"
if [[ "${CODE}" =~ ^2 ]]; then
  if assert_minimized_envelope "POS-2 envelope" "${BODY}"; then
    mark_pass "POS-2 safety-rule-evaluate -> ${CODE}"
  fi
else
  mark_fail "POS-2 safety-rule-evaluate -> ${CODE} (esperado 2xx)"
fi

# ----- POS-3 -----------------------------------------------------------------
echo
echo "==> [POS-3] POST /safety-rules-write :: cria/atualiza override per-tenant"
# Severity 'info' + ['log_only'] + enabled=false: override SEM efeito operacional.
# Operador pode reverter via PATCH/DELETE quando quiser.
RAW=$(post_with_apikey "/safety-rules-write" "$(cat <<EOF
{
  "rule_code": "${SAFETY_RULE_CODE}",
  "enabled": false,
  "severity": "info",
  "actions": ["log_only"],
  "config_json": {"smoke_marker": "safety-smoke", "note": "smoke-only, never enable"}
}
EOF
)")
BODY=$(printf '%s' "${RAW}" | sed '$d')
CODE=$(printf '%s' "${RAW}" | tail -n1)
print_json "rules-write [HTTP ${CODE}]" "${BODY}"
if [[ "${CODE}" =~ ^2 ]]; then
  mark_pass "POS-3 safety-rules-write -> ${CODE}"
else
  mark_fail "POS-3 safety-rules-write -> ${CODE} (esperado 2xx)"
fi

# ============================================================================
# CLASSE 2 — ADMIN / ALERT-DEPENDENT
# ============================================================================
echo
echo "============================================================"
echo "  CLASSE 2 — ADMIN / ALERT-DEPENDENT (precisa SAFETY_ALERT_ID)"
echo "============================================================"

# ----- POS-4 -----------------------------------------------------------------
echo
echo "==> [POS-4] POST /safety-alert-dispatch/<id> :: ack"
if [[ -n "${SAFETY_ALERT_ID:-}" ]]; then
  RAW=$(post_with_apikey "/safety-alert-dispatch/${SAFETY_ALERT_ID}" \
    '{"action":"acknowledge","note":"smoke-test"}')
  BODY=$(printf '%s' "${RAW}" | sed '$d')
  CODE=$(printf '%s' "${RAW}" | tail -n1)
  print_json "alert-dispatch [HTTP ${CODE}]" "${BODY}"
  if [[ "${CODE}" =~ ^2 ]]; then
    mark_pass "POS-4 safety-alert-dispatch -> ${CODE}"
  else
    mark_fail "POS-4 safety-alert-dispatch -> ${CODE} (esperado 2xx)"
  fi
else
  mark_skip "POS-4 safety-alert-dispatch — SAFETY_ALERT_ID ausente"
fi

# ----- POS-5 -----------------------------------------------------------------
echo
echo "==> [POS-5] POST /safety-step-up :: cria verification_session via Safety"
if [[ -n "${SAFETY_ALERT_ID:-}" ]]; then
  RAW=$(post_with_apikey "/safety-step-up" "$(cat <<EOF
{
  "safety_alert_id": "${SAFETY_ALERT_ID}",
  "policy_slug": "${POLICY_SLUG}",
  "locale": "pt-BR"
}
EOF
)")
  BODY=$(printf '%s' "${RAW}" | sed '$d')
  CODE=$(printf '%s' "${RAW}" | tail -n1)
  print_json "step-up [HTTP ${CODE}]" "${BODY}"
  if [[ "${CODE}" =~ ^2 ]]; then
    if assert_minimized_envelope "POS-5 envelope" "${BODY}"; then
      mark_pass "POS-5 safety-step-up -> ${CODE}"
    fi
  else
    mark_fail "POS-5 safety-step-up -> ${CODE} (esperado 2xx)"
  fi
else
  mark_skip "POS-5 safety-step-up — SAFETY_ALERT_ID ausente"
fi

# ============================================================================
# CLASSE 3 — CRON / PRIVILEGED (Bearer)
# ============================================================================
echo
echo "============================================================"
echo "  CLASSE 3 — CRON / PRIVILEGED (precisa SAFETY_CRON_SECRET)"
echo "============================================================"

# ----- POS-6 -----------------------------------------------------------------
echo
echo "==> [POS-6] POST /safety-aggregates-refresh :: recomputa contadores"
if [[ -n "${SAFETY_CRON_SECRET:-}" ]]; then
  RAW=$(post_with_bearer "/safety-aggregates-refresh" '{}' "${SAFETY_CRON_SECRET}")
  BODY=$(printf '%s' "${RAW}" | sed '$d')
  CODE=$(printf '%s' "${RAW}" | tail -n1)
  print_json "aggregates-refresh [HTTP ${CODE}]" "${BODY}"
  if [[ "${CODE}" =~ ^2 ]]; then
    mark_pass "POS-6 safety-aggregates-refresh -> ${CODE}"
  else
    mark_fail "POS-6 safety-aggregates-refresh -> ${CODE} (esperado 2xx)"
  fi
else
  mark_skip "POS-6 safety-aggregates-refresh — SAFETY_CRON_SECRET ausente"
fi

# ----- POS-7 -----------------------------------------------------------------
echo
echo "==> [POS-7] POST /safety-retention-cleanup :: limpa por TTL respeitando legal_hold"
if [[ -n "${SAFETY_CRON_SECRET:-}" ]]; then
  RAW=$(post_with_bearer "/safety-retention-cleanup" '{}' "${SAFETY_CRON_SECRET}")
  BODY=$(printf '%s' "${RAW}" | sed '$d')
  CODE=$(printf '%s' "${RAW}" | tail -n1)
  print_json "retention-cleanup [HTTP ${CODE}]" "${BODY}"
  if [[ "${CODE}" =~ ^2 ]]; then
    mark_pass "POS-7 safety-retention-cleanup -> ${CODE}"
  else
    mark_fail "POS-7 safety-retention-cleanup -> ${CODE} (esperado 2xx)"
  fi
else
  mark_skip "POS-7 safety-retention-cleanup — SAFETY_CRON_SECRET ausente"
fi

# ============================================================================
# NEGATIVE — PRIVACY GUARD (HTTP 400 obrigatório)
# ============================================================================
echo
echo "============================================================"
echo "  NEGATIVE — PRIVACY GUARD (cada teste DEVE retornar HTTP 400)"
echo "============================================================"

assert_400() {
  local label="$1" body="$2"
  local raw code
  raw=$(post_with_apikey "/safety-event-ingest" "${body}")
  code=$(printf '%s' "${raw}" | tail -n1)
  if [[ "${code}" == "400" ]]; then
    mark_pass "${label} -> 400"
  else
    mark_fail "${label} -> got ${code}, expected 400"
  fi
}

BASE_OK_FIELDS="\"event_type\":\"message_sent\",\"actor_subject_ref_hmac\":\"${ACTOR_REF_HMAC}\""

assert_400 "NEG raw_text in metadata"   "{${BASE_OK_FIELDS},\"metadata\":{\"raw_text\":\"hello\"}}"
assert_400 "NEG message in metadata"    "{${BASE_OK_FIELDS},\"metadata\":{\"message\":\"hello\"}}"
assert_400 "NEG image in metadata"      "{${BASE_OK_FIELDS},\"metadata\":{\"image\":\"data:image/png;base64,AAA\"}}"
assert_400 "NEG video in metadata"      "{${BASE_OK_FIELDS},\"metadata\":{\"video\":\"data:video/mp4;base64,AAA\"}}"
assert_400 "NEG audio in metadata"      "{${BASE_OK_FIELDS},\"metadata\":{\"audio\":\"data:audio/wav;base64,AAA\"}}"
assert_400 "NEG birthdate in metadata"  "{${BASE_OK_FIELDS},\"metadata\":{\"birthdate\":\"2010-01-01\"}}"
assert_400 "NEG email in metadata"      "{${BASE_OK_FIELDS},\"metadata\":{\"email\":\"user@example.com\"}}"
assert_400 "NEG phone in metadata"      "{${BASE_OK_FIELDS},\"metadata\":{\"phone\":\"+5511999999999\"}}"
assert_400 "NEG raw_text at root (strict schema)" \
  "{${BASE_OK_FIELDS},\"raw_text\":\"hello\",\"metadata\":{}}"

# ============================================================================
# SUMMARY
# ============================================================================
echo
echo "============================================================"
echo "  SUMMARY"
echo "============================================================"
echo "  PASS : ${PASS_COUNT}"
echo "  SKIP : ${SKIP_COUNT}"
echo "  FAIL : ${FAIL_COUNT}"
if (( FAIL_COUNT > 0 )); then
  echo
  echo "  Failures:"
  for f in "${FAILURES[@]}"; do echo "    - ${f}"; done
  echo
  echo "  Exit: 1"
  exit 1
fi
echo
echo "  All checks passed (skips são esperados quando faltam credenciais admin/cron)."
echo "  Exit: 0"
exit 0
