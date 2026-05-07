# Evidência de auditoria — AgeKey Parental Consent

## Cadeia de evidências

Para cada consentimento aprovado, os seguintes registros existem:

1. `parental_consent_requests` — pedido inicial (recurso, finalidade,
   categorias, contexto cliente minimizado).
2. `guardian_contacts` — canal verificado (hash + ciphertext + timestamps).
3. `guardian_verifications` — método, OTP digest, decisão, timestamps.
4. `consent_text_versions` — versão exata do texto + body_hash.
5. `parental_consents` — registro final com `consent_text_hash`,
   `proof_hash`, `assurance_level`, `method`, `risk_tier`, `expires_at`.
6. `parental_consent_tokens` — JTI emitido, `token_hash`, `kid`, `audience`.
7. `audit_events` — duas linhas mínimas:
   - `parental_consent.created` (com payload_hash, decision, hashes).
   - `parental_consent.completed` (escrito explicitamente pela edge function
     `parental-consent-confirm` com o `consentEnvelopeAuditDiff` completo).
8. `webhook_deliveries` — entrega assinada para o(s) endpoint(s) inscritos.

Em revogação, a cadeia ganha:
- `parental_consent_revocations` (APPEND-ONLY).
- `audit_events` com `parental_consent.revoked`.
- `webhook_deliveries` com `parental_consent.revoked`.
- `parental_consent_tokens.status = 'revoked'`.
- `parental_consents.status = 'revoked'`.

## Reprodução matemática do recibo

Dado o token JWS armazenado no cliente, o auditor pode validar:

```
verify_jws(token, jwks)                  # assinatura ES256 ok
parse_claims(token).agekey               # contém consent_token_id, parental_consent_id
SELECT body_markdown
  FROM consent_text_versions
  WHERE id = (
    SELECT consent_text_version_id
      FROM parental_consents
      WHERE id = <parental_consent_id>
  );
SHA-256(body_markdown) == claims.consent_text_hash    # vínculo ao texto exato
```

E para o `proof_hash`:

```
SHA-256(
  subject_ref_hmac || guardian_ref_hmac || resource ||
  consent_text_hash || iat
) == claims.proof_hash
```

(Os dois HMACs estão na linha de `parental_consents`. Como são HMAC
por-tenant, o auditor precisa do tenant_id correto para reproduzir.)

## Campos do `audit_events.diff_json`

Whitelist construtiva (`consentEnvelopeAuditDiff`):

```json
{
  "decision_domain": "parental_consent",
  "envelope_version": 1,
  "decision": "approved",
  "reason_code": "CONSENT_GRANTED",
  "consent_request_id": "...",
  "parental_consent_id": "...",
  "consent_token_id": "...",
  "verification_session_id": null,
  "policy_id": null,
  "policy_version": null,
  "resource": "platform_use",
  "scope": null,
  "risk_tier": "low",
  "guardian_verification_method": "otp_email",
  "assurance_level": "low",
  "consent_text_hash": "0123...",
  "proof_hash": "abcd...",
  "issued_at": 1700000000,
  "expires_at": 1700604800,
  "payload_hash": "ef01...",
  "content_included": false,
  "pii_included": false
}
```

Sem `subject_ref_hmac` no diff (a linha física existe em `parental_consents`,
mas o diff de auditoria não a propaga para evitar correlação acidental
em exports). Sem `guardian_ref_hmac` no diff. Sem qualquer chave de PII.

## Retention efetiva

- `audit_events` (consent.*): `standard_audit` (90 dias default,
  configurável até 365).
- `parental_consents`: `regulatory` (5 anos).
- `parental_consent_revocations`: `regulatory` (5 anos).
- `consent_text_versions`: `regulatory` (5 anos).
- `guardian_verifications`: `ephemeral` (24h após verified_at — ainda a
  ser plugado no retention-job em rodada futura).

## Como exportar para um regulador

1. Filtrar `audit_events` por
   `action LIKE 'parental_consent.%' AND tenant_id = ?` no intervalo.
2. Juntar com `parental_consents` por `resource_id`.
3. Juntar com `parental_consent_revocations` quando aplicável.
4. Re-hashar o `body_markdown` da versão referenciada e provar que bate com
   `consent_text_hash`.
5. Re-verificar o JWS armazenado pelo RP com a JWKS publicada.

Nada precisa de decryption de PII para essa cadeia funcionar — o que
deixa claro o desenho privacy-first.
