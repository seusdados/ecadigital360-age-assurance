# HML — Consent MVP end-to-end smoke ✅ SUCESSO

> **Status**: ✅ AgeKey Consent MVP operacional em HML para o fluxo técnico end-to-end. Todos os 8 passos do `consent-smoke.sh` passaram. Schema/data preservados. PROD intocada.
>
> Data do smoke validado: 2026-05-10 (UTC).
> Commit `main` na validação: `92a5769c0715fc3ab5ec0fdaedaea011427ea148`.
> Project ref HML: `wljedzqgprkpqhuazdzv`.
> Project ref PROD: `tpdiccnmsnjtjwhardij` — **não tocado**.

## 1. Pré-requisitos consolidados (linha do tempo)

| # | Item | PR / Operação | Resultado |
|---|---|---|---|
| 1 | Workflow GHA "Deploy HML Edge Functions" com `--no-verify-jwt` | PR #64 (merged `40bcb421`) | ✅ |
| 2 | Audit trail HML pré-fix (PR #63) | merged `f6a47737` | ✅ |
| 3 | Rotações de TENANT_API_KEY (PRs #65, #68, #74, #75) | 4 rotações por exposição em log | ✅ |
| 4 | Fix runtime `DecisionEnvelope.expires_at` aceita offset RFC 3339 | PR #66 (merged `bab46374`) | ✅ |
| 5 | Smoke scripts alinhados com contratos reais (Consent + Safety) | PR #67 (merged `124f36b5`) | ✅ |
| 6 | Migration `031_fix_guardian_contacts_store` (vault.create_secret) | PR #70 (merged `79f7179f`) | ✅ |
| 7 | Aplicação migration 031 em HML (`mcp__apply_migration`, version `20260509222948`) | PR #71 (merged `3394dfee`) | ✅ |
| 8 | Fix runtime `parental-consent-token-verify.activated_at` (era `rotated_at`) | PR #73 (merged `661e8955`) | ✅ |
| 9 | Env var `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` em HML (Bug A) | Operador (Supabase Dashboard) | ✅ |
| 10 | Workflow GHA disparado pós-PR #73 (14 funções redeployadas) | Workflow run | ✅ token-verify v23 / outras versões ↑ |
| 11 | Convenção `verify_jwt: false` mantida nas 14 funções | validação MCP | ✅ |
| 12 | Rotação final TENANT_API_KEY (hash `5365b30c…`) | PR #75 (merged `92a5769c`) | ✅ |

## 2. Estado das Edge Functions HML (validado via MCP)

- **33 funções totais** com `verify_jwt: false`.
- **14 Consent + Safety**: redeployadas pelo workflow GHA.
- **`parental-consent-session`**: v23.
- **`parental-consent-guardian-start`**: v22.
- **`parental-consent-confirm`**: v22.
- **`parental-consent-session-get`**: v22.
- **`parental-consent-text-get`**: v22.
- **`parental-consent-token-verify`**: v23 (com fix do PR #73 — `activated_at`).
- **`parental-consent-revoke`**: v22.
- **Outras 7 Safety**: v22.
- **19 Core**: v18-v19, intocadas.

## 3. Resultado do `consent-smoke.sh` — 8/8 passos ✅

### 3.1. Step 1 — `parental-consent-session` (POST)

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `consent_request_id` retornado | ✅ |
| `guardian_panel_url` retornado | ✅ |
| `guardian_panel_token` retornado | ✅ |
| `policy.slug = dev-13-plus` | ✅ |
| `consent_text` retornado | ✅ |
| `decision_envelope.decision = pending_guardian` | ✅ |
| `decision_envelope.content_included = false` | ✅ |
| `decision_envelope.pii_included = false` | ✅ |

### 3.2. Step 2 — `parental-consent-session-get` (GET)

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `status = awaiting_guardian` | ✅ |
| `policy` e `consent_text` retornados | ✅ |
| `decision_envelope.decision = pending_guardian` | ✅ |
| `content_included = false`, `pii_included = false` | ✅ |

### 3.3. Step 3 — `parental-consent-text-get` (GET)

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `text_body` integral retornado | ✅ |
| `text_hash` retornado | ✅ |
| `content_type = text/plain` | ✅ |

### 3.4. Step 4 — `parental-consent-guardian-start` (POST) — **antes era HTTP 500**

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `guardian_verification_id` gerado | ✅ |
| `contact_masked` aplicado (sem PII em claro) | ✅ |
| `dev_otp` retornado em HML (Bug A destravado) | ✅ |
| `status = awaiting_verification` | ✅ |

Migration 031 + env var DEV_RETURN_OTP funcionando.

### 3.5. Step 5 — `parental-consent-confirm` (POST)

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `parental_consent_id` gerado | ✅ |
| `status = approved` | ✅ |
| `decision = approved` | ✅ |
| `reason_code = CONSENT_APPROVED` | ✅ |
| `token.jwt` (ES256, JWS) gerado | ✅ |
| `decision_envelope.decision = approved` | ✅ |
| `decision_envelope.assurance_level = AAL-C1` | ✅ |
| `content_included = false`, `pii_included = false` | ✅ |

### 3.6. Step 6 — `parental-consent-token-verify` positivo — **antes era HTTP 500**

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `valid = true` | ✅ |
| `revoked = false` | ✅ |
| `reason_code = CONSENT_APPROVED` | ✅ |
| `decision_envelope.decision = approved` | ✅ |

PR #73 fix (`activated_at`) funcionando.

### 3.7. Step 7 — `parental-consent-revoke` (POST)

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `revoked_at` retornado | ✅ |
| `reason_code = CONSENT_REVOKED` | ✅ |
| `decision_envelope.decision = revoked` | ✅ |

### 3.8. Step 8 — `parental-consent-token-verify` pós-revogação

| Verificação | Resultado |
|---|---|
| HTTP 200 | ✅ |
| `valid = false` | ✅ |
| `revoked = true` | ✅ |
| `reason_code = TOKEN_REVOKED` | ✅ |
| `decision_envelope.decision = revoked` | ✅ |

## 4. Garantias de privacidade observadas

- **Nenhuma** resposta pública contém email, telefone, CPF, RG, name, birthdate em texto claro.
- `contact_masked` aplicado em `guardian-start`.
- `dev_otp` aparece **apenas em HML** (env var `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` controla); PROD não terá esse campo.
- `decision_envelope.content_included = false` e `decision_envelope.pii_included = false` em todas as respostas.
- `child_ref_hmac` aceito como hash opaco; nunca PII.
- JWT minimizado: hashes opacos, sem birthdate/email/child_ref em claro.

## 5. Observação de segurança operacional sobre artefatos do smoke

O output do smoke logado **contém artefatos que devem ser tratados como expostos**:

- `guardian_panel_token` do consent_request usado: **comprometido** — não reutilizar. (Trate como sessão de teste apenas.)
- `token.jwt` emitido: **comprometido** — porém **já revogado no próprio fluxo** (Step 7). Verificável: token-verify pós-revoke retornou `revoked: true, reason_code: TOKEN_REVOKED`.
- Antes de qualquer compartilhamento posterior (ex.: documentação pública, vídeo demo), **mascarar** `guardian_panel_token` e `JWT` no output.

A `TENANT_API_KEY` **não foi exposta** no output final do smoke (só hash/prefixo). Mas a raw key da rotação `5365b30c…` está em uso ativo — manter no password manager até nova rotação programada.

## 6. Status board HML — atualização

| Módulo | Estado em HML | Notas |
|---|---|---|
| **Core** (verifications, applications, policies, issuers, audit, jwks, key-rotation, etc.) | ✅ Operacional | 19 funções v18-v19, `verify_jwt: false` |
| **Consent MVP** | ✅ **Operacional ponta-a-ponta** | 7 funções v22-v23. Migration 031 aplicada. Env DEV_RETURN_OTP=true. Smoke 8/8 passou |
| **Safety metadata-only** | ✅ Operacional para `event-ingest`, `rule-evaluate`, `rules-write` (admin), 9 negative privacy guards | Pendente apenas: `alert-dispatch` (precisa `safety_alert_id` real); `step-up` (precisa `safety_alert_id` real); `aggregates-refresh`, `retention-cleanup` (precisam `SAFETY_CRON_SECRET`) |

## 7. Confirmações de não-ação (este relatório)

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`. Único projeto HML.
- ❌ Nenhum `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Nenhum deploy de Edge Function executado nesta operação.
- ❌ Nenhum disparo de workflow.
- ❌ Nenhuma alteração de schema, migrations, RLS, dados de negócio ou feature flags.
- ❌ Raw TENANT_API_KEY não solicitada nem registrada.
- ✅ Apenas: leituras de validação + escrita deste relatório.

## 8. Próximos passos sugeridos (operador decide)

### 8.1. HML — refinamentos opcionais

- Cobrir `safety-step-up` e `safety-alert-dispatch` em smoke quando houver alert real (ex.: gerado por uma regra que disparou em algum evento).
- Cobrir `safety-aggregates-refresh` / `safety-retention-cleanup` com `SAFETY_CRON_SECRET` em janela controlada (não em smoke público).
- Smoke UI no painel admin HML (rotas Consent + Safety).

### 8.2. PROD — caminho documentado, não autorizado nesta operação

A migration 031 ainda **não está em PROD**. Quando a janela for autorizada:

1. PROD precisa, na ordem:
   - Aplicar migrations Phase 2 (Consent: 020-023) — não autorizado nesta sessão.
   - Aplicar migration 031 (mesmo SQL deste HML).
   - Configurar provider real de OTP (`AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER=twilio` ou similar; **não** usar `DEV_RETURN_OTP` em PROD).
   - Deploy 14 funções Consent + Safety em PROD com `--no-verify-jwt` via workflow específico de PROD (NÃO o de HML).
2. Smoke equivalente em PROD com tenant API key de PROD.

### 8.3. apps/website (deploy Vercel) — pré-existente

Falha pré-existente em main (deps Next/Node ausentes). Não bloqueia Edge Functions ou admin. PR separado quando convier.

## 9. Hashes / referências

| Item | Valor |
|---|---|
| Commit `main` na validação | `92a5769c0715fc3ab5ec0fdaedaea011427ea148` |
| HML project ref | `wljedzqgprkpqhuazdzv` |
| PROD project ref | `tpdiccnmsnjtjwhardij` (não tocado) |
| Migration 031 registrada | version `20260509222948` |
| TENANT_API_KEY ativa (hash first8) | `5365b30c` (PR #75) |
| Cadeia de PRs do MVP | #63, #64, #65, #66, #67, #68, #70, #71, #73, #74, #75 |

## 10. Conclusão

**AgeKey Consent MVP está operacional em HML para o fluxo técnico end-to-end.** Todos os endpoints públicos respeitam a minimização (`content_included = false`, `pii_included = false`), o token revogado é detectado online, e o painel do responsável funciona via `guardian_panel_token` com OTP.

Os bugs encontrados durante o ciclo (DecisionEnvelope offset, vault.create_secret vs INSERT direto, env var DEV_RETURN_OTP, coluna activated_at) foram todos resolvidos e versionados (PRs #66, #70/#71, configuração HML, #73). A trilha de auditoria está completa e versionada.

Próximo gate é **decisão de produto/legal** sobre quando iniciar Phase 2/3 em PROD, não mais constraint técnico de HML.
