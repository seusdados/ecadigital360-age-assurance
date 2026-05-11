<!--
  Template: PR de execução de release Consent MVP em PROD.
  Este arquivo é apenas TEMPLATE. Não é workflow. Não executa nada.
  Use ao abrir o PR que registrará a execução de uma janela autorizada.
-->

# Release Execution PR — AgeKey Consent MVP em PROD

> **⚠ Este PR registra uma execução de release em PROD. Preencha cada seção antes de mergear.**
> **Project ref PROD**: `tpdiccnmsnjtjwhardij`.
> **Project ref HML**: `wljedzqgprkpqhuazdzv` — não tocado nesta janela.

## 1. Escopo da execução

- [ ] **Módulo**: AgeKey Consent MVP (somente).
- [ ] **Safety NÃO incluído** nesta janela.
- [ ] **Retention/cron 028 NÃO aplicada** nesta janela.
- [ ] **Migration 029 NÃO aplicada** nesta janela.

## 2. Pré-flight

- [ ] `main` em commit auditável: `__________________________` (SHA registrado).
- [ ] `pnpm test` verde no momento da execução.
- [ ] Backup/snapshot Supabase PROD < 24h confirmado: `backup_id = __________________________`.
- [ ] Janela de manutenção definida: início `_____ UTC` / fim `_____ UTC`.
- [ ] Operador responsável: `_____________________________`.
- [ ] DBA / on-call: `_____________________________`.
- [ ] Aprovador legal/produto on-call: `_____________________________`.

## 3. Feature flags (PROD)

- [ ] `AGEKEY_PARENTAL_CONSENT_ENABLED` foi setada para `false` (ou ausente) **antes** do deploy.
- [ ] `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` está **ausente** em PROD. **⛔ Proibido em PROD.**
- [ ] `AGEKEY_SAFETY_ENABLED` está **ausente / `false`** em PROD.
- [ ] `SAFETY_CRON_SECRET` está **ausente** em PROD.
- [ ] Flag de SD-JWT VC real está OFF (adapter `vc` é honest stub).
- [ ] Flag de gateway real está OFF.
- [ ] Flag de ZKP/BBS+ real está OFF.

## 4. Env vars e secrets (PROD)

- [ ] `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` configurado para provider **real** (não `noop`).
- [ ] Secrets do provider configurados.
- [ ] `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` definido (URL pública real).
- [ ] **Nenhum secret/raw key/JWT/guardian token está neste PR ou em commits.**

## 5. Migrations aplicadas

Marcar **somente** o que foi efetivamente aplicado em PROD:

- [ ] `020_parental_consent_core`
- [ ] `021_parental_consent_guardian`
- [ ] `022_parental_consent_rls`
- [ ] `023_parental_consent_webhooks`
- [ ] `031_fix_guardian_contacts_store`
- [ ] `030_enable_rls_audit_billing_partitions` (opcional defensiva)

⛔ **Não devem aparecer marcadas**: `024`, `025`, `026`, `027`, `028`, `029`.

Versions registradas em `supabase_migrations.schema_migrations`:

```
______________________________________
```

## 6. Edge Functions deployadas

Marcar **somente** o que foi efetivamente deployado em PROD com `--no-verify-jwt`:

- [ ] `parental-consent-session`
- [ ] `parental-consent-guardian-start`
- [ ] `parental-consent-confirm`
- [ ] `parental-consent-session-get`
- [ ] `parental-consent-text-get`
- [ ] `parental-consent-token-verify`
- [ ] `parental-consent-revoke`

⛔ **Não devem aparecer marcadas**: nenhuma `safety-*`, nenhuma `core` (Core já estável em PROD).

## 7. Smoke tests (pós-ativação)

Resultado dos 8 passos do `consent-smoke.sh` adaptado para PROD:

| # | Endpoint | Esperado | Resultado |
|---|---|---|---|
| 1 | `parental-consent-session` | HTTP 200, `decision_envelope.{content,pii}_included=false` | ☐ |
| 2 | `session-get/<id>?token=…` | HTTP 200, status=awaiting_guardian | ☐ |
| 3 | `text-get/<id>?token=…` | HTTP 200, text_body + text_hash | ☐ |
| 4 | `guardian-start/<id>` | HTTP 200, **dev_otp = null** (PROD); contact_masked aplicado | ☐ |
| 5 | `confirm/<id>` (OTP real) | HTTP 200, parental_consent_id, token.jwt | ☐ |
| 6 | `token-verify` (positivo) | HTTP 200, valid=true | ☐ |
| 7 | `revoke/<id>` | HTTP 200, revoked_at | ☐ |
| 8 | `token-verify` (pós-revoke) | HTTP 200, valid=false, reason_code=TOKEN_REVOKED | ☐ |

Confirmações privacidade:

- [ ] Nenhuma resposta pública contém email/telefone/CPF/RG/birthdate em texto claro.
- [ ] `contact_masked` aplicado em guardian-start.
- [ ] JWT decodificado **não** contém birthdate/email/child_ref em claro.
- [ ] `decision_envelope.content_included=false`, `pii_included=false` em todos envelopes.
- [ ] `audit_events_<partição>` cresceu por cada operação realizada.

## 8. Rollback

- [ ] Plano de rollback compreendido pelo operador (`docs/release/prod-consent-mvp-rollback-runbook.md`).
- [ ] Rollback foi acionado? `☐ Sim ☐ Não`
- [ ] Se sim, tipo: `☐ Rápido (flag OFF) ☐ Função específica ☐ Migration (com aprovação)`
- [ ] Cenário acionador (C1–C9): `___`

## 9. Evidências pós-execução

Anexar como referência (links para Dashboard, screenshots, etc.):

- [ ] `mcp__list_migrations(project_id="tpdiccnmsnjtjwhardij")` mostra as migrations aplicadas.
- [ ] `mcp__list_edge_functions(project_id="tpdiccnmsnjtjwhardij")` mostra 7 funções `parental-consent-*` com `verify_jwt: false`.
- [ ] Logs Edge Functions sem stack trace inesperado.
- [ ] Métricas T+1h sem 5xx.

## 10. Confirmações de segurança

- [ ] **Nenhum** secret, raw API key, JWT, guardian token, OTP em claro está neste PR.
- [ ] **Nenhum** contato real de cliente ou menor está neste PR.
- [ ] **Nenhuma** PII de qualquer pessoa está neste PR.
- [ ] PROD foi o único projeto tocado nesta execução.
- [ ] HML não foi tocada durante a janela.

## 11. Aprovações

- [ ] **PO (Produto)**: `_____________________________` em `_______ UTC`.
- [ ] **DPO / Legal**: `_____________________________` em `_______ UTC`.
- [ ] **Tech Lead (Engenharia)**: `_____________________________` em `_______ UTC`.
- [ ] **Operador (execução)**: `_____________________________` em `_______ UTC`.

## 12. Próximos passos

- [ ] Postmortem T+72h: `docs/audit/prod-consent-mvp-release-execution-report.md`.
- [ ] Atualizar `docs/audit/agekey-release-status-board.md` com novo estado PROD.
- [ ] Atualizar `compliance/privacy-by-design-record.md` com entrada executada.
- [ ] Comunicar tenant piloto (se externo).
- [ ] Janela Safety planejada? `_____________________________`.

## 13. Referências

- Memo executivo: `docs/release/prod-consent-mvp-executive-go-no-go-pack.md`
- Runbook: `docs/release/prod-consent-mvp-execution-runbook.md`
- Rollback runbook: `docs/release/prod-consent-mvp-rollback-runbook.md`
- Smoke test pack: `docs/release/prod-consent-mvp-smoke-test-pack.md`
- ADR: `docs/adr/ADR-AGEKEY-CONSENT-PROD-RELEASE.md`
- Canonical map: `docs/release/prod-consent-docs-canonical-map.md`
- Pre-launch checklist: `docs/audit/agekey-release-pre-launch-checklist.md`

---

<!--
  Após preencher, marcar este PR como Ready for Review e seguir
  o processo de aprovação definido no memo executivo §13.
-->
