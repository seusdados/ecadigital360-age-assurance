# AgeKey — Pre-Launch Checklist (manual, markdown)

> **Status**: Checklist manual a ser marcado pelo operador da janela.
> **Formato**: Markdown com tabelas marcáveis. Cada item deve ser independentemente verificável.
> **Última versão**: 2026-05-10 (após PR #86, commit `71c39a4a`).

---

## 0. Identificação do release

```yaml
release:
  module: AgeKey Consent MVP
  environment: PROD
  project_ref: tpdiccnmsnjtjwhardij
  commit_main: __________________________
  scheduled_window_utc_start: __________________________
  scheduled_window_utc_end: __________________________
  estimated_duration_hours: 2

operators:
  primary: __________________________
  dba_on_call: __________________________
  legal_product_on_call: __________________________

approvals:
  product_owner: __________________________
  dpo_legal: __________________________
  tech_lead: __________________________
```

---

## 1. Pré-condições gerais

| # | Item | Estado | Evidência |
|---|---|---|---|
| 1.1 | `main` em commit auditável (≥ `71c39a4a`) | ☐ | SHA registrado |
| 1.2 | `pnpm test` verde no momento da execução | ☐ | CI da branch |
| 1.3 | `pnpm typecheck` packages/admin verde | ☐ | CI |
| 1.4 | `pnpm -r lint` clean (apenas a11y warning pré-existente) | ☐ | CI |
| 1.5 | HML 8/8 smoke validado nas últimas 24h pré-janela | ☐ | `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` |
| 1.6 | Pre-flight PROD read-only confirmado | ☐ | `docs/audit/prod-consent-mvp-preflight-readiness-report.md` |

---

## 2. Backup PROD

| # | Item | Estado | Evidência |
|---|---|---|---|
| 2.1 | Snapshot Supabase PROD < 24h confirmado | ☐ | Dashboard → Database → Backups |
| 2.2 | `backup_id` registrado | ☐ | log da janela |
| 2.3 | Plano de rollback compreendido (`docs/release/prod-consent-mvp-rollback-runbook.md`) | ☐ | operador confirma |

---

## 3. Janela e responsáveis

| # | Item | Estado |
|---|---|---|
| 3.1 | Janela UTC definida (início + fim) | ☐ |
| 3.2 | Tenant piloto comunicado (se externo) | ☐ |
| 3.3 | Canal de incidente combinado (Slack/etc.) | ☐ |
| 3.4 | Operador responsável nomeado | ☐ |
| 3.5 | DBA on-call nomeado | ☐ |
| 3.6 | Aprovador legal/produto on-call | ☐ |

---

## 4. Decisões executivas formalizadas

| # | Item | Estado |
|---|---|---|
| 4.1 | Memo executivo (`docs/release/prod-consent-mvp-executive-go-no-go-pack.md` §13) assinado por PO | ☐ |
| 4.2 | Memo executivo assinado por DPO / Legal | ☐ |
| 4.3 | Memo executivo assinado por Tech Lead | ☐ |
| 4.4 | RIPD AgeKey Consent v1 (`compliance/ripd-agekey.md`) aceito formalmente pelo DPO | ☐ |
| 4.5 | Decisão sobre tenant alvo (interno `dev` vs piloto externo) registrada | ☐ |
| 4.6 | Privacy by Design entry D17 (`compliance/privacy-by-design-record.md`) revisado | ☐ |

---

## 5. Feature flags (PROD, Dashboard Supabase)

```yaml
flags_expected_state:
  AGEKEY_PARENTAL_CONSENT_ENABLED: "false"     # OFF antes do deploy; será true no fim da Fase 3
  AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP: "AUSENTE / NÃO SETAR"
  AGEKEY_SAFETY_ENABLED: "AUSENTE / NÃO SETAR"
  SD_JWT_VC_REAL_FLAG: "OFF"
  GATEWAY_REAL_FLAG: "OFF"
  ZKP_REAL_FLAG: "OFF"
```

| # | Item | Estado |
|---|---|---|
| 5.1 | `AGEKEY_PARENTAL_CONSENT_ENABLED=false` (ou ausente) | ☐ |
| 5.2 | `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` **AUSENTE em PROD** ⛔ | ☐ |
| 5.3 | `AGEKEY_SAFETY_ENABLED` **AUSENTE / OFF** | ☐ |
| 5.4 | `SAFETY_CRON_SECRET` **AUSENTE** | ☐ |
| 5.5 | Flag SD-JWT VC real **OFF** | ☐ |
| 5.6 | Flag gateway real **OFF** | ☐ |
| 5.7 | Flag ZKP real **OFF** | ☐ |

---

## 6. Env vars / secrets (PROD)

| # | Item | Estado |
|---|---|---|
| 6.1 | `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` = provider real (não `noop`) | ☐ |
| 6.2 | Secrets do provider OTP configurados (Twilio/Mailgun/SES/etc.) | ☐ |
| 6.3 | `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` = URL pública real | ☐ |
| 6.4 | Provider OTP testado em sandbox (deliverability OK) | ☐ |
| 6.5 | **Nenhum secret será registrado** em commits, PRs, comentários, logs ou chats | ☐ |

---

## 7. Tenant + Application + Policy + Consent Text

| # | Item | Estado |
|---|---|---|
| 7.1 | Tenant alvo confirmado (interno `dev` ou piloto externo) | ☐ |
| 7.2 | Application ativa em PROD para o tenant | ☐ |
| 7.3 | TENANT_API_KEY raw custodiada exclusivamente pelo operador (password manager) | ☐ |
| 7.4 | Hash da TENANT_API_KEY confere com `applications.api_key_hash` em PROD | ☐ |
| 7.5 | Policy alvo definida com slug | ☐ |
| 7.6 | `consent_text_versions` ativa para policy + locale `pt-BR` (após Fase 1) | ☐ |

---

## 8. Migrations a aplicar (Fase 1)

**Ordem obrigatória**:

| # | Migration | Aplicar? | Aplicada? |
|---|---|---|---|
| 8.1 | `020_parental_consent_core` | ✅ Sim | ☐ |
| 8.2 | `021_parental_consent_guardian` | ✅ Sim | ☐ |
| 8.3 | `022_parental_consent_rls` | ✅ Sim | ☐ |
| 8.4 | `023_parental_consent_webhooks` | ✅ Sim | ☐ |
| 8.5 | `031_fix_guardian_contacts_store` | ✅ Sim (corrige bug pgsodium) | ☐ |
| 8.6 | `030_enable_rls_audit_billing_partitions` | 🟡 Opcional defensiva | ☐ |
| 8.7 | `024_safety_signals_core` | ❌ **NÃO aplicar** (Safety fora) | ☐ confirmar não-aplicação |
| 8.8 | `025_safety_signals_rls` | ❌ **NÃO aplicar** | ☐ confirmar não-aplicação |
| 8.9 | `026_safety_signals_webhooks` | ❌ **NÃO aplicar** | ☐ confirmar não-aplicação |
| 8.10 | `027_safety_signals_seed_rules` | ❌ **NÃO aplicar** | ☐ confirmar não-aplicação |
| 8.11 | `028_retention_cron_schedule` | ❌ **NÃO aplicar** (defer) | ☐ confirmar não-aplicação |
| 8.12 | `029_post_merge_p0_fixes` | ❌ **NÃO aplicar** (refs Safety) | ☐ confirmar não-aplicação |

---

## 9. Deploy de Edge Functions (Fase 2)

**Todas com `--no-verify-jwt`**:

| # | Edge Function | Deploy? | Deployada? |
|---|---|---|---|
| 9.1 | `parental-consent-session` | ✅ Sim | ☐ |
| 9.2 | `parental-consent-guardian-start` | ✅ Sim | ☐ |
| 9.3 | `parental-consent-confirm` | ✅ Sim | ☐ |
| 9.4 | `parental-consent-session-get` | ✅ Sim | ☐ |
| 9.5 | `parental-consent-text-get` | ✅ Sim | ☐ |
| 9.6 | `parental-consent-token-verify` | ✅ Sim | ☐ |
| 9.7 | `parental-consent-revoke` | ✅ Sim | ☐ |
| 9.8 | Nenhuma `safety-*` deployada | ❌ NÃO | ☐ confirmar |
| 9.9 | Nenhuma `core` re-deployada | ❌ NÃO | ☐ confirmar |
| 9.10 | Workflow `Deploy HML Edge Functions` **NÃO usado** (hardcoded HML) | ❌ NÃO | ☐ confirmar |
| 9.11 | Workflow GHA PROD usado (se aplicável) OU CLI manual | ✅ | ☐ |

---

## 10. Smoke tests (Fase 4)

### 10.1. Pré-ativação (flag OFF, esperar 503)

| # | Verificação | Estado |
|---|---|---|
| 10.1 | `parental-consent-session` retorna HTTP 503 com `reason_code: SYSTEM_INVALID_REQUEST` | ☐ |

### 10.2. Pós-ativação (flag ON, 8 steps)

| # | Step | Estado |
|---|---|---|
| 10.2.1 | `parental-consent-session` → HTTP 200 | ☐ |
| 10.2.2 | `session-get/<id>?token=…` → HTTP 200 | ☐ |
| 10.2.3 | `text-get/<id>?token=…` → HTTP 200 | ☐ |
| 10.2.4 | `guardian-start/<id>` → HTTP 200, `dev_otp = null`, `contact_masked` aplicado | ☐ |
| 10.2.5 | Operador recebe OTP real em email/SMS | ☐ |
| 10.2.6 | `confirm/<id>` (com OTP real) → HTTP 200, `parental_consent_id`, `token.jwt` | ☐ |
| 10.2.7 | `token-verify` (positivo) → HTTP 200, `valid=true` | ☐ |
| 10.2.8 | `revoke/<parental_consent_id>` → HTTP 200, `revoked_at` | ☐ |
| 10.2.9 | `token-verify` (pós-revoke) → HTTP 200, `valid=false`, `reason_code=TOKEN_REVOKED` | ☐ |

### 10.3. Garantias de privacidade

| # | Verificação | Estado |
|---|---|---|
| 10.3.1 | Zero PII em respostas públicas (email/telefone/CPF/RG/birthdate em claro) | ☐ |
| 10.3.2 | `contact_masked` aplicado em guardian-start | ☐ |
| 10.3.3 | JWT decodificado sem birthdate/email/child_ref em claro | ☐ |
| 10.3.4 | `decision_envelope.content_included = false`, `pii_included = false` em todos envelopes | ☐ |
| 10.3.5 | `audit_events_<partição>` cresceu por cada operação | ☐ |
| 10.3.6 | Logs Edge Function sem stack trace inesperado | ☐ |

---

## 11. Rollback

| # | Item | Estado |
|---|---|---|
| 11.1 | Rollback rápido (flag OFF) compreendido | ☐ |
| 11.2 | Rollback de função específica compreendido | ☐ |
| 11.3 | Rollback de migration **NÃO automático** confirmado pelo operador | ☐ |
| 11.4 | Rollback acionado durante janela? `☐ Sim ☐ Não` | ☐ |
| 11.5 | Se acionado, cenário (C1–C9): `___` | ☐ |

---

## 12. Comunicação

| # | Item | Estado |
|---|---|---|
| 12.1 | Comunicação interna iniciada antes da janela | ☐ |
| 12.2 | Tenant piloto (se externo) avisado | ☐ |
| 12.3 | Status page atualizada (se aplicável) | ☐ |
| 12.4 | Postmortem template pronto | ☐ |

---

## 13. Monitoramento (Fase 5)

| # | Item | Estado |
|---|---|---|
| 13.1 | T+0 a T+1h: operador no console em tempo real | ☐ |
| 13.2 | T+1h a T+24h: checagem horária | ☐ |
| 13.3 | T+24h a T+72h: 2x/dia | ☐ |
| 13.4 | 5xx em `parental-consent-*` < 1% no período | ☐ |
| 13.5 | Latência p95 `parental-consent-session` < 2s | ☐ |
| 13.6 | Provider OTP `delivered=false` < 5% | ☐ |

---

## 14. Go/No-Go final (assinaturas no momento da janela)

| # | Aprovador | Decisão | Data/Hora UTC | Assinatura |
|---|---|---|---|---|
| 14.1 | Operador | ☐ Go ☐ No-Go | ______ | ______ |
| 14.2 | Aprovador legal/produto | ☐ Go ☐ No-Go | ______ | ______ |
| 14.3 | Plantão DBA | ☐ Go ☐ No-Go | ______ | ______ |
| 14.4 | **Decisão final** | ☐ **GO** ☐ **NO-GO** | ______ | ______ |

**Critério para GO**: 14.1 + 14.2 + 14.3 todos Go, e **nenhum item ⛔ vermelho** nas seções 1–13.

---

## 15. Pós-release (T+72h)

| # | Item | Estado |
|---|---|---|
| 15.1 | Postmortem light criado: `docs/audit/prod-consent-mvp-release-execution-report.md` | ☐ |
| 15.2 | Atualizado `docs/audit/agekey-release-status-board.md` com novo estado PROD | ☐ |
| 15.3 | Atualizado `compliance/privacy-by-design-record.md` D17 com `executado: <data UTC>` | ☐ |
| 15.4 | Próxima janela Safety planejada? `_____________________________` | ☐ |
| 15.5 | Janela 028 (cron retention) planejada? `_____________________________` | ☐ |

---

## 16. Confirmações negativas (esta janela)

- ☐ **Safety NÃO foi habilitado em PROD nesta janela.**
- ☐ **`AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` NÃO foi setado em PROD.**
- ☐ **SD-JWT VC real NÃO foi habilitado.**
- ☐ **ZKP/BBS+ real NÃO foi habilitado.**
- ☐ **Gateways novos NÃO foram habilitados.**
- ☐ **Nenhum secret foi registrado** em commits, PRs, comentários, logs ou chats durante a janela.
- ☐ **Nenhum dado pessoal real** foi usado em smoke (apenas contato do operador e hashes opacos).
- ☐ **HML NÃO foi tocada** durante a janela.

---

## 17. Notas livres do operador

```
(livre para o operador anotar observações, surpresas, decisões on-the-fly)




```

---

## 18. Referências

- Memo executivo: `docs/release/prod-consent-mvp-executive-go-no-go-pack.md`
- Runbook: `docs/release/prod-consent-mvp-execution-runbook.md`
- Rollback runbook: `docs/release/prod-consent-mvp-rollback-runbook.md`
- Smoke test pack: `docs/release/prod-consent-mvp-smoke-test-pack.md`
- ADR: `docs/adr/ADR-AGEKEY-CONSENT-PROD-RELEASE.md`
- Canonical map: `docs/release/prod-consent-docs-canonical-map.md`
- Status board: `docs/audit/agekey-release-status-board.md`
- Readiness board: `docs/audit/prod-consent-release-readiness-board.md`
- Pre-flight PROD: `docs/audit/prod-consent-mvp-preflight-readiness-report.md`
- HML smoke: `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`
- RIPD: `compliance/ripd-agekey.md`
- Privacy by Design: `compliance/privacy-by-design-record.md`
- Subprocessadores: `compliance/subprocessors-register.md`
- Incident response: `compliance/incident-response-playbook.md`
- Template PR execução: `.github/PULL_REQUEST_TEMPLATE/prod-consent-release.md`
