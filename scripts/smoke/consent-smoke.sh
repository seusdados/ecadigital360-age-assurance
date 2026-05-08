#!/usr/bin/env bash
# ============================================================================
# AgeKey Parental Consent — HML smoke test
# ----------------------------------------------------------------------------
# Cobertura: parental-consent-session, guardian-start, confirm, session-get,
# text-get, token-verify, revoke.
#
# Asserções de privacidade (manuais — confirmar via inspeção da resposta):
#   1. Nenhuma resposta contém PII em texto claro (email/telefone/CPF/RG).
#   2. `contact_masked` deve estar mascarado (ex.: "r***@example.com").
#   3. Token JWT deve ter claims minimizadas (sem birthdate, sem email, sem
#      child_ref em texto claro — apenas hashes opacos).
#   4. Após `revoke`, `token-verify` deve responder revoked=true.
#   5. `dev_otp` somente é retornado quando flag dev está ON (HML pode
#      retornar; PROD nunca deve).
#
# Pré-requisitos:
#   BASE_URL              ex.: https://wljedzqgprkpqhuazdzv.functions.supabase.co
#   TENANT_API_KEY        chave de tenant de TESTE em HML
#   APPLICATION_SLUG      slug da application (default "default")
#   POLICY_SLUG           policy slug (default "age-13-br-parental")
#   CHILD_REF_HMAC        HMAC opaco da criança (>=8 chars, NUNCA dados reais)
#   DEV_CONTACT_VALUE     contato fictício para teste (ex.: smoke@example.com
#                         ou +5511999999999) — NUNCA usar contato real.
# ============================================================================
set -euo pipefail

: "${BASE_URL:?BASE_URL is required}"
: "${TENANT_API_KEY:?TENANT_API_KEY is required}"
: "${CHILD_REF_HMAC:?CHILD_REF_HMAC is required (use HMAC opaco, nunca PII)}"
APPLICATION_SLUG="${APPLICATION_SLUG:-default}"
POLICY_SLUG="${POLICY_SLUG:-age-13-br-parental}"
DEV_CONTACT_VALUE="${DEV_CONTACT_VALUE:-smoke+test@example.com}"
CONTACT_CHANNEL="${CONTACT_CHANNEL:-email}"

H_AUTH=(-H "X-AgeKey-API-Key: ${TENANT_API_KEY}")
H_JSON=(-H 'Content-Type: application/json')
H_TRACE=(-H "X-Trace-Id: smoke-consent-$(date +%s)")

curl_json() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "${body}" ]]; then
    curl -sS -X "${method}" "${BASE_URL}${path}" \
      "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" --data "${body}"
  else
    curl -sS -X "${method}" "${BASE_URL}${path}" \
      "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}"
  fi
  echo
}

echo "==> [1] parental-consent-session :: cria solicitação"
# Espera: HTTP 201; resposta contém consent_request_id, guardian_panel_url,
# guardian_panel_token (>=16 chars), policy{}, consent_text{}.
# NÃO deve conter: email, telefone, child_ref em texto claro.
SESSION_RESP=$(curl_json POST "/parental-consent-session" "$(cat <<EOF
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
echo "${SESSION_RESP}"
CONSENT_REQUEST_ID=$(printf '%s' "${SESSION_RESP}" | grep -oE '"consent_request_id":"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")
GUARDIAN_TOKEN=$(printf '%s' "${SESSION_RESP}" | grep -oE '"guardian_panel_token":"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")
TEXT_VERSION_ID=$(printf '%s' "${SESSION_RESP}" | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | cut -d'"' -f4 || echo "")

echo "consent_request_id=${CONSENT_REQUEST_ID}"
echo "guardian_panel_token (length only)=${#GUARDIAN_TOKEN}"

echo
echo "==> [2] parental-consent-session-get :: visão pública (sem PII)"
# Espera: HTTP 200; status=pending; sem campos de contato em texto claro.
curl_json GET "/parental-consent-session-get?consent_request_id=${CONSENT_REQUEST_ID:-missing}" || true

echo
echo "==> [3] parental-consent-text-get :: retorna texto versionado por hash"
# Espera: HTTP 200; corpo {id, locale, text_hash, body}; text_hash hex 64.
curl_json GET "/parental-consent-text-get?policy_slug=${POLICY_SLUG}&locale=pt-BR" || true

echo
echo "==> [4] parental-consent-guardian-start :: registra contato + envia OTP"
# Espera: HTTP 200; contact_masked (mascarado, ex.: "s***@example.com");
# dev_otp != null SOMENTE em HML (com flag DEV_RETURN_OTP=true).
GUARDIAN_RESP=$(curl_json POST "/parental-consent-guardian-start" "$(cat <<EOF
{
  "guardian_panel_token": "${GUARDIAN_TOKEN}",
  "contact_channel": "${CONTACT_CHANNEL}",
  "contact_value": "${DEV_CONTACT_VALUE}"
}
EOF
)")
echo "${GUARDIAN_RESP}"
DEV_OTP=$(printf '%s' "${GUARDIAN_RESP}" | grep -oE '"dev_otp":"[0-9]+"' | head -1 | cut -d'"' -f4 || echo "")
echo "dev_otp captured? $([[ -n "${DEV_OTP}" ]] && echo yes || echo no/null)"

echo
echo "==> [4b] OTP fallback NOOP :: re-start não reenvia OTP novo (rate limited)"
# Espera: HTTP 429 ou 400 — confirmar que rate-limit/idempotency está ativo.
curl_json POST "/parental-consent-guardian-start" "$(cat <<EOF
{
  "guardian_panel_token": "${GUARDIAN_TOKEN}",
  "contact_channel": "${CONTACT_CHANNEL}",
  "contact_value": "${DEV_CONTACT_VALUE}"
}
EOF
)" || true

echo
echo "==> [5] parental-consent-confirm :: aprova decisão (requer dev_otp)"
# Espera: HTTP 200; decision=approved; token.jwt presente.
# Token DEVE: usar ES256, ter jti, expires_at; NÃO conter email/CPF/birthdate.
TOKEN_JWT=""
if [[ -n "${DEV_OTP}" && -n "${TEXT_VERSION_ID}" ]]; then
  CONFIRM_RESP=$(curl_json POST "/parental-consent-confirm" "$(cat <<EOF
{
  "guardian_panel_token": "${GUARDIAN_TOKEN}",
  "otp": "${DEV_OTP}",
  "decision": "approve",
  "consent_text_version_id": "${TEXT_VERSION_ID}"
}
EOF
)")
  echo "${CONFIRM_RESP}"
  TOKEN_JWT=$(printf '%s' "${CONFIRM_RESP}" | grep -oE '"jwt":"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")
else
  echo "SKIP confirm (sem dev_otp ou text_version_id)"
fi

echo
echo "==> [6] parental-consent-token-verify :: verifica JWT contra JWKS"
# Espera: HTTP 200; valid=true; revoked=false; claims minimizadas.
if [[ -n "${TOKEN_JWT}" ]]; then
  curl_json POST "/parental-consent-token-verify" \
    "{\"jwt\":\"${TOKEN_JWT}\"}" || true
else
  echo "SKIP token-verify positivo (sem JWT). Testando contrato com JWT inválido:"
  curl_json POST "/parental-consent-token-verify" \
    '{"jwt":"eyJhbGciOiJFUzI1NiJ9.invalid.smoke"}' || true
fi

echo
echo "==> [7] parental-consent-revoke :: revoga consentimento"
# Espera: HTTP 200; status=revoked.
if [[ -n "${CONSENT_REQUEST_ID}" ]]; then
  curl_json POST "/parental-consent-revoke" "$(cat <<EOF
{
  "consent_request_id": "${CONSENT_REQUEST_ID}",
  "reason": "smoke-test"
}
EOF
)" || true
fi

echo
echo "==> [8] token-verify pós-revogação :: deve indicar revoked=true"
if [[ -n "${TOKEN_JWT}" ]]; then
  curl_json POST "/parental-consent-token-verify" \
    "{\"jwt\":\"${TOKEN_JWT}\"}" || true
fi

echo
echo "==> Consent smoke concluído. Verificações manuais obrigatórias:"
echo "    [a] Nenhuma resposta contém email/telefone em texto claro."
echo "    [b] contact_masked está aplicado em guardian-start."
echo "    [c] JWT decodificado (header.payload base64) NÃO contém birthdate,"
echo "        email, telefone, CPF ou child_ref em claro."
echo "    [d] token-verify após revoke retorna revoked=true."
echo "    [e] dev_otp aparece SOMENTE em HML; em PROD deve ser sempre null."
