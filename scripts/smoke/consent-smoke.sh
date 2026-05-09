#!/usr/bin/env bash
# ============================================================================
# AgeKey Parental Consent — HML smoke test
# ----------------------------------------------------------------------------
# Cobre os 7 endpoints atuais do módulo Consent na ordem do fluxo real.
#
# Contratos auditados (conforme código em supabase/functions/parental-consent-*):
#
#   1. POST /parental-consent-session
#        Auth:  X-AgeKey-API-Key
#        Body:  { application_slug, policy_slug, resource, purpose_codes,
#                 data_categories, locale, child_ref_hmac }
#        Resp:  consent_request_id, guardian_panel_token, consent_text.id, ...
#
#   2. GET  /parental-consent-session-get/<UUID>?token=<panel_token>
#        Auth:  X-AgeKey-API-Key OU panel_token (este script usa panel_token)
#        Resp:  status, consent_text{}, decision_envelope, ...
#
#   3. GET  /parental-consent-text-get/<UUID>?token=<panel_token>
#        Auth:  panel_token (não aceita api_key)
#        Resp:  text_body, text_hash, locale, ...
#
#   4. POST /parental-consent-guardian-start/<UUID>
#        Auth:  guardian_panel_token NO BODY
#        Body:  { guardian_panel_token, contact_channel, contact_value }
#        Resp:  guardian_verification_id, contact_masked, dev_otp, ...
#
#   5. POST /parental-consent-confirm/<UUID>
#        Auth:  guardian_panel_token NO BODY
#        Body:  { guardian_panel_token, otp, decision: "approve"|"deny",
#                 consent_text_version_id }
#        Resp:  parental_consent_id, token.jwt, decision_envelope, ...
#
#   6. POST /parental-consent-token-verify
#        Body:  { token: "<jwt>", expected_audience? }   <-- chave é "token"
#        Resp:  valid, revoked, claims, ...
#
#   7. POST /parental-consent-revoke/<parental_consent_id-UUID>
#        Auth:  X-AgeKey-API-Key (este script) OU panel_token
#        Body:  { reason }
#        Resp:  parental_consent_id, revoked_at, ...
#
# Asserções de privacidade (manuais):
#   - Nenhuma resposta contém PII em texto claro (email/telefone/CPF/RG).
#   - `contact_masked` é mascarado.
#   - `dev_otp` só aparece em HML; em PROD deve ser sempre null.
#   - JWT decodificado NÃO contém birthdate/email/child_ref em claro.
#
# Pré-requisitos (env vars):
#   BASE_URL              ex.: https://wljedzqgprkpqhuazdzv.functions.supabase.co
#   TENANT_API_KEY        chave de tenant de TESTE em HML — NUNCA commit
#   APPLICATION_SLUG      default: dev-app (slug em HML)
#   POLICY_SLUG           default: dev-13-plus (slug em HML)
#   CHILD_REF_HMAC        HMAC opaco da criança (>=8 chars; NUNCA PII)
#   DEV_CONTACT_VALUE     contato fictício (smoke@example.com / +55119...)
#   CONTACT_CHANNEL       email | sms | whatsapp (default: email)
#
# Dependência: jq (parser JSON robusto). Sem jq, o script aborta.
# ============================================================================
set -euo pipefail

: "${BASE_URL:?BASE_URL is required}"
: "${TENANT_API_KEY:?TENANT_API_KEY is required}"
: "${CHILD_REF_HMAC:?CHILD_REF_HMAC is required (HMAC opaco, nunca PII)}"
APPLICATION_SLUG="${APPLICATION_SLUG:-dev-app}"
POLICY_SLUG="${POLICY_SLUG:-dev-13-plus}"
DEV_CONTACT_VALUE="${DEV_CONTACT_VALUE:-smoke+test@example.com}"
CONTACT_CHANNEL="${CONTACT_CHANNEL:-email}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required (https://jqlang.github.io/jq/)" >&2
  exit 2
fi

H_AUTH=(-H "X-AgeKey-API-Key: ${TENANT_API_KEY}")
H_JSON=(-H 'Content-Type: application/json')
H_TRACE=(-H "X-Trace-Id: smoke-consent-$(date +%s)")

curl_post() {
  local path="$1" body="$2"
  curl -sS -X POST "${BASE_URL}${path}" \
    "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
}

curl_get() {
  local path="$1"
  curl -sS -X GET "${BASE_URL}${path}" \
    "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}"
}

curl_post_no_auth() {
  local path="$1" body="$2"
  curl -sS -X POST "${BASE_URL}${path}" \
    "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
}

curl_get_no_auth() {
  local path="$1"
  curl -sS -X GET "${BASE_URL}${path}" \
    "${H_JSON[@]}" "${H_TRACE[@]}"
}

print_resp() {
  local label="$1" resp="$2"
  echo "----- ${label} -----"
  printf '%s' "${resp}" | jq . 2>/dev/null || printf '%s\n' "${resp}"
}

echo "==> [1] POST /parental-consent-session :: cria solicitação"
SESSION_RESP=$(curl_post "/parental-consent-session" "$(cat <<EOF
{
  "application_slug": "${APPLICATION_SLUG}",
  "policy_slug": "${POLICY_SLUG}",
  "resource": "feature/social-feed",
  "purpose_codes": ["account_creation"],
  "data_categories": ["nickname"],
  "locale": "pt-BR",
  "child_ref_hmac": "${CHILD_REF_HMAC}"
}
EOF
)")
print_resp "session create" "${SESSION_RESP}"

CONSENT_REQUEST_ID=$(printf '%s' "${SESSION_RESP}" | jq -r '.consent_request_id // empty')
GUARDIAN_TOKEN=$(printf '%s' "${SESSION_RESP}" | jq -r '.guardian_panel_token // empty')
TEXT_VERSION_ID=$(printf '%s' "${SESSION_RESP}" | jq -r '.consent_text.id // empty')

if [[ -z "${CONSENT_REQUEST_ID}" || -z "${GUARDIAN_TOKEN}" || -z "${TEXT_VERSION_ID}" ]]; then
  echo "FAIL: response did not include consent_request_id/guardian_panel_token/consent_text.id" >&2
  exit 1
fi
echo "consent_request_id=${CONSENT_REQUEST_ID}"
echo "guardian_panel_token (length only)=${#GUARDIAN_TOKEN}"
echo "consent_text.id=${TEXT_VERSION_ID}"

echo
echo "==> [2] GET /parental-consent-session-get/<id>?token=... :: visão pública"
SESSION_GET_RESP=$(curl_get_no_auth \
  "/parental-consent-session-get/${CONSENT_REQUEST_ID}?token=${GUARDIAN_TOKEN}")
print_resp "session get (panel_token)" "${SESSION_GET_RESP}"

echo
echo "==> [3] GET /parental-consent-text-get/<id>?token=... :: texto integral"
TEXT_GET_RESP=$(curl_get_no_auth \
  "/parental-consent-text-get/${CONSENT_REQUEST_ID}?token=${GUARDIAN_TOKEN}")
print_resp "text get" "${TEXT_GET_RESP}"

echo
echo "==> [4] POST /parental-consent-guardian-start/<id> :: registra contato + OTP"
GUARDIAN_RESP=$(curl_post_no_auth \
  "/parental-consent-guardian-start/${CONSENT_REQUEST_ID}" \
  "$(cat <<EOF
{
  "guardian_panel_token": "${GUARDIAN_TOKEN}",
  "contact_channel": "${CONTACT_CHANNEL}",
  "contact_value": "${DEV_CONTACT_VALUE}"
}
EOF
)")
print_resp "guardian start" "${GUARDIAN_RESP}"
DEV_OTP=$(printf '%s' "${GUARDIAN_RESP}" | jq -r '.dev_otp // empty')
CONTACT_MASKED=$(printf '%s' "${GUARDIAN_RESP}" | jq -r '.contact_masked // empty')
echo "dev_otp captured? $([[ -n "${DEV_OTP}" ]] && echo "yes (length=${#DEV_OTP})" || echo "no/null")"
echo "contact_masked=${CONTACT_MASKED}"

echo
echo "==> [5] POST /parental-consent-confirm/<id> :: aprova decisão"
PARENTAL_CONSENT_ID=""
TOKEN_JWT=""
if [[ -n "${DEV_OTP}" && -n "${TEXT_VERSION_ID}" ]]; then
  CONFIRM_RESP=$(curl_post_no_auth \
    "/parental-consent-confirm/${CONSENT_REQUEST_ID}" \
    "$(cat <<EOF
{
  "guardian_panel_token": "${GUARDIAN_TOKEN}",
  "otp": "${DEV_OTP}",
  "decision": "approve",
  "consent_text_version_id": "${TEXT_VERSION_ID}"
}
EOF
)")
  print_resp "confirm" "${CONFIRM_RESP}"
  PARENTAL_CONSENT_ID=$(printf '%s' "${CONFIRM_RESP}" | jq -r '.parental_consent_id // empty')
  TOKEN_JWT=$(printf '%s' "${CONFIRM_RESP}" | jq -r '.token.jwt // empty')
  echo "parental_consent_id=${PARENTAL_CONSENT_ID}"
  echo "token.jwt (length only)=${#TOKEN_JWT}"
else
  echo "SKIP confirm (sem dev_otp ou consent_text.id — verifique HML flag DEV_RETURN_OTP)"
fi

echo
echo "==> [6] POST /parental-consent-token-verify :: verifica JWT contra JWKS"
if [[ -n "${TOKEN_JWT}" ]]; then
  VERIFY_RESP=$(curl_post_no_auth "/parental-consent-token-verify" \
    "$(jq -n --arg t "${TOKEN_JWT}" '{token:$t}')")
  print_resp "token-verify (positivo)" "${VERIFY_RESP}"
else
  echo "SKIP positivo. Probe contrato negativo:"
  NEG_RESP=$(curl_post_no_auth "/parental-consent-token-verify" \
    '{"token":"eyJhbGciOiJFUzI1NiJ9.invalid.smoke"}')
  print_resp "token-verify (token inválido)" "${NEG_RESP}"
fi

echo
echo "==> [7] POST /parental-consent-revoke/<parental_consent_id> :: revoga"
if [[ -n "${PARENTAL_CONSENT_ID}" ]]; then
  REVOKE_RESP=$(curl_post "/parental-consent-revoke/${PARENTAL_CONSENT_ID}" \
    '{"reason":"smoke-test"}')
  print_resp "revoke" "${REVOKE_RESP}"
else
  echo "SKIP revoke (sem parental_consent_id porque o confirm não rodou)"
fi

echo
echo "==> [8] POST /parental-consent-token-verify pós-revogação :: revoked=true"
if [[ -n "${TOKEN_JWT}" ]]; then
  VERIFY2_RESP=$(curl_post_no_auth "/parental-consent-token-verify" \
    "$(jq -n --arg t "${TOKEN_JWT}" '{token:$t}')")
  print_resp "token-verify (pós-revoke)" "${VERIFY2_RESP}"
fi

echo
echo "==> Consent smoke concluído. Verificações manuais obrigatórias:"
echo "    [a] Nenhuma resposta contém email/telefone/CPF em texto claro."
echo "    [b] contact_masked está aplicado em guardian-start."
echo "    [c] JWT decodificado (header.payload base64) NÃO contém birthdate,"
echo "        email, telefone, CPF ou child_ref em claro."
echo "    [d] token-verify após revoke retorna revoked=true."
echo "    [e] dev_otp só aparece em HML; em PROD deve ser sempre null."
