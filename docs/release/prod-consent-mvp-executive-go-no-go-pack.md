# Executive Go/No-Go Pack — PROD Consent MVP Release

> **Para**: PO, Legal/DPO, Tech Lead, CEO/Diretor responsável.
> **De**: Release Manager (Claude) com base em validação HML + auditoria PROD read-only.
> **Data**: 2026-05-10.
> **Commit `main` na análise**: `9e85b64f3bc909cdc9c89f7dcf600b9c85129b25`.
> **Decisão solicitada**: AUTORIZAR / RECUSAR / ADIAR a execução de release Consent MVP em PROD.

---

## 1. Resumo executivo (TL;DR)

| Item | Estado |
|---|---|
| Validação técnica HML | ✅ 8/8 passos do `consent-smoke.sh` |
| Estado PROD (read-only) | Phase 1 limpa, sem conflitos para Consent |
| Pacote documental | Memo + Runbook + Rollback + Smoke + ADR + Board (mergeados em main) |
| Bloqueadores remanescentes | **10 de governança**, 0 técnicos |
| Recomendação técnica | **GO WITH CONDITIONS** (cumpridos os 10 → GO) |

**Tempo estimado de janela**: 2 horas (Fase 0–5 do runbook).
**Tempo de rollback rápido**: < 2 minutos (flag OFF).

---

## 2. Recomendação final

**🟡 GO WITH CONDITIONS** — autorizar a execução assim que os 10 itens de governança (§7) estejam cumpridos.

Não autorizar agora **abrindo janela diretamente** porque há dependências externas (provider OTP, RIPD assinado, decisão de tenant) que precisam ser fechadas antes.

Não recomendar **NO-GO permanente**: o estado técnico está sólido; a decisão é de produto/legal sobre quando ativar.

---

## 3. Status detalhado

| Status | Significado |
|---|---|
| ❌ NO-GO | impossível abrir janela; falha técnica ou bloqueador legal absoluto |
| 🟡 **GO WITH CONDITIONS** ← *atual* | técnico OK; cumprir governança e seguir runbook |
| ✅ GO | tudo verde, executar runbook |

---

## 4. Escopo do release (este pacote)

### 4.1. O que será ativado

- Módulo **AgeKey Consent MVP** em PROD (`tpdiccnmsnjtjwhardij`).
- 5 migrations: `020_parental_consent_core`, `021_parental_consent_guardian`, `022_parental_consent_rls`, `023_parental_consent_webhooks`, `031_fix_guardian_contacts_store`.
- 1 migration opcional defensiva: `030_enable_rls_audit_billing_partitions`.
- 7 Edge Functions Consent (`parental-consent-*`) com `--no-verify-jwt`.
- Feature flag `AGEKEY_PARENTAL_CONSENT_ENABLED=true` ao final da Fase 3.
- Provider OTP **real** (Twilio/Mailgun/SES — operador escolhe e configura antes da janela).

### 4.2. Tenant alvo (decisão pendente)

- **Recomendação**: tenant interno `dev` em PROD para release técnico inicial.
- **Alternativa**: criar tenant piloto externo via `tenant-bootstrap` antes da janela.

---

## 5. Fora de escopo (confirmação expressa)

- ❌ **Safety Signals** (migrations 024-027, 7 Edge Functions, flag `AGEKEY_SAFETY_ENABLED`, `SAFETY_CRON_SECRET`).
- ❌ **Migration 028** (`retention_cron_schedule`) — defer; janela própria.
- ❌ **Migration 029** (`post_merge_p0_fixes`) — refs Safety; falha sem 024.
- ❌ **`AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP`** — proibido em PROD por design.
- ❌ **ZKP / SD-JWT VC real / gateways novos** — adapters seguem honest stubs.
- ❌ **Tenant adicional além do alvo definido** — escopo controlado.

---

## 6. Estado HML (evidência)

| Eixo | Estado |
|---|---|
| 33 Edge Functions, todas `verify_jwt: false` | ✅ |
| Migrations `000–017` + `020–031` aplicadas | ✅ (30 entradas em `schema_migrations`) |
| `consent-smoke.sh` end-to-end | ✅ 8/8 passos |
| `decision_envelope.content_included = false`, `pii_included = false` | ✅ |
| Token revogado detectado online | ✅ |
| Privacy Guard (9 negative tests) | ✅ |
| `vault.create_secret()` em `guardian_contacts_store` | ✅ |

Referência detalhada: `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`.

---

## 7. Estado PROD (evidência)

| Eixo | Estado |
|---|---|
| Phase 1 (000-017) | ✅ aplicada |
| Migrations 020-031 | ❌ ausentes (caminho limpo) |
| 19 Edge Functions Core, todas `verify_jwt: false` | ✅ |
| 0 funções `parental-consent-*` ou `safety-*` | ✅ (sem conflito) |
| 0 tabelas `parental_consent_*`/`guardian_*`/`safety_*` | ✅ (sem conflito) |
| 1 tenant ativo (`dev`/AgeKey Dev), 1 application (`dev-app`), 10 policies | ✅ |
| Feature flag Consent | ❌ OFF (default → 503 defensivo) |
| Provider OTP real | ⏸ pendente operador |
| Backup recente | ⏸ confirmar antes da janela |

Referência detalhada: `docs/audit/prod-consent-mvp-preflight-readiness-report.md` (PR #81).

---

## 8. Evidências disponíveis para o decisor

| Documento | O que prova |
|---|---|
| `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` | Validação técnica E2E em HML |
| `docs/audit/prod-consent-mvp-preflight-readiness-report.md` | Estado real de PROD via MCP read-only |
| `docs/audit/prod-phase-1-migration-017-execution-report.md` | Histórico de Phase 1 PROD |
| `docs/audit/prod-consent-mvp-release-decision-memo.md` | Memo de decisão (PR #79) |
| `docs/audit/prod-consent-mvp-release-runbook.md` | Runbook técnico (PR #79) |
| `docs/audit/prod-consent-mvp-go-no-go-checklist.md` | Checklist (PR #79) |
| `docs/audit/agekey-release-status-board.md` | Painel por módulo (PR #79) |
| `docs/audit/prod-consent-release-readiness-board.md` | Tabela de readiness (este pacote) |
| `docs/release/prod-consent-mvp-execution-runbook.md` | Runbook operacional (este pacote) |
| `docs/release/prod-consent-mvp-rollback-runbook.md` | Rollback runbook (este pacote) |
| `docs/release/prod-consent-mvp-smoke-test-pack.md` | Smoke pack (este pacote) |
| `docs/adr/ADR-AGEKEY-CONSENT-PROD-RELEASE.md` | Decision record arquitetural (este pacote) |
| `compliance/ripd-agekey.md` | RIPD vivo (LGPD art. 38) |
| `compliance/privacy-by-design-record.md` | Decisões PbD |
| `compliance/data-retention-policy.md` | Política de retenção |
| `compliance/subprocessors-register.md` | Lista de subprocessadores |
| `compliance/incident-response-playbook.md` | Playbook de incidente |

---

## 9. Lacunas identificadas (gaps)

| # | Lacuna | Tipo | Mitigação |
|---|---|---|---|
| L1 | Provider OTP real **não selecionado** | Bloqueador externo | Operador escolhe (Twilio/Mailgun/SES); configura secrets em PROD |
| L2 | Decisão de tenant alvo (interno `dev` vs piloto externo) | Bloqueador de produto | Recomendação: tenant interno primeiro |
| L3 | RIPD AgeKey Consent v1 não tem assinatura formalizada (DPO) | Bloqueador legal | Cerimônia de assinatura |
| L4 | Memo executivo não tem assinatura formalizada (PO + DPO + Tech Lead) | Bloqueador de governança | Cerimônia de assinatura |
| L5 | Workflow GHA dedicado a PROD não criado | Operacional | PR separado **antes** da janela (recomendado) ou plano CLI |
| L6 | Tenant API key piloto PROD não emitida | Operacional | `tenant-bootstrap` ou rotação no momento da janela |
| L7 | `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` PROD não definida | Operacional | Decidir URL pública e setar no Dashboard |
| L8 | Backup recente PROD não confirmado | Operacional | Snapshot < 24h antes da janela |
| L9 | Janela e operador não definidos | Operacional | Calendário + plantão |
| L10 | DBA on-call (caso §5.3 do rollback runbook) não definido | Operacional | Plantão |

---

## 10. Riscos e mitigadores

### 10.1. Bloqueadores (resolver antes do go-live)

| # | Risco | Severidade | Mitigador |
|---|---|---|---|
| R1 | Provider OTP real ausente → `deliverOtp` lança por design | Crítica | Configurar antes (L1) |
| R2 | RIPD não fechado → exposição legal | Crítica | Assinatura DPO (L3) |
| R3 | Backup ausente → rollback de migration sem ponto seguro | Alta | Snapshot < 24h (L8) |
| R4 | Workflow HML usado por engano → deploy em projeto errado | Crítica | Workflow PROD próprio com `tpdiccnmsnjtjwhardij` hardcoded (L5) |

### 10.2. Operacionais (mitigáveis na janela)

| # | Risco | Severidade | Mitigador |
|---|---|---|---|
| R5 | `--no-verify-jwt` esquecido | Alta | Loop `for fn in ...` no runbook + checagem MCP pós-deploy |
| R6 | Migration 029 deferida → `payload_hash` v1 nos webhooks | Baixa | Documentado; corrigido na janela Safety futura |
| R7 | Smoke pode revelar diferenças PROD vs HML | Média | Smoke faseado: pré-ativação 503 + pós-ativação 200 |
| R8 | OTP real não chega ao operador (provider down) | Média | Aguardar/retry; fallback documentado em provider's SLA |

### 10.3. Latentes (monitorar pós-release)

| # | Risco | Mitigador contínuo |
|---|---|---|
| R9 | Provider OTP delivery rate baixa | Monitor `delivered=false`; SLA do provider |
| R10 | Vault encryption performance em alto volume | Monitor latência de `guardian-start` |
| R11 | Webhook fan-out backpressure | Monitor `webhooks-worker` |
| R12 | Tenant pode usar `child_ref_hmac` que de fato é PII | Privacy Guard rejeita; revisão contratual |

---

## 11. Decisões pendentes

| # | Decisão | Quem decide |
|---|---|---|
| D1 | Aprovar release Consent MVP em PROD nesta janela | PO + DPO + Tech Lead |
| D2 | Manter Safety fora desta janela | Confirmação |
| D3 | Provider OTP escolhido | Operador + PO |
| D4 | Tenant alvo inicial: interno `dev` ou piloto externo | PO |
| D5 | Janela de manutenção (data/hora UTC) | Operador + PO |
| D6 | Operador responsável | Operador |
| D7 | Plantão DBA on-call | Eng Lead |
| D8 | Workflow GHA PROD vs CLI manual | Operador |
| D9 | Comunicação com tenant (se externo) | PO |
| D10 | RIPD assinado | DPO |

---

## 12. Critérios de aceite (Definition of Done)

Após executar Fase 0-5 do runbook, considerar release **bem-sucedido** se:

- ✅ 5 migrations Consent + (opcional) 030 aplicadas, registradas em `schema_migrations`.
- ✅ 7 Edge Functions Consent ativas com `verify_jwt: false`.
- ✅ Smoke pré-ativação retornou HTTP 503 com `reason_code: SYSTEM_INVALID_REQUEST`.
- ✅ Flag `AGEKEY_PARENTAL_CONSENT_ENABLED=true` setada.
- ✅ Smoke pós-ativação 8/8 steps verdes.
- ✅ `decision_envelope.content_included = false`, `pii_included = false` em todas as respostas.
- ✅ Nenhuma resposta pública contém PII em texto claro.
- ✅ Token revogado detectado online (revoked=true, TOKEN_REVOKED).
- ✅ Audit events crescem em proporção às operações.
- ✅ Logs Edge Function sem stack trace inesperado.
- ✅ T+1h sem 5xx novos em `parental-consent-*`.
- ✅ T+72h sem incidentes; postmortem light produzido.

---

## 13. Autorização formal necessária

A execução desta janela requer:

| Papel | Aprovação | Mecanismo |
|---|---|---|
| Produto (PO) | ☐ Aprovado ☐ Recusado | Assinatura no memo `docs/audit/prod-consent-mvp-release-decision-memo.md` |
| Legal / DPO | ☐ Aprovado ☐ Recusado | Mesmo memo + RIPD assinado |
| Engenharia (Tech Lead) | ☐ Aprovado ☐ Recusado | Mesmo memo |
| Operador da janela | ☐ Designado | Nome + contato registrados |
| DBA on-call | ☐ Designado | Nome + contato registrados |

**Decisão final (4 assinaturas obrigatórias)**:

| Decisão | Quem | Data UTC | Assinatura |
|---|---|---|---|
| ☐ **APROVADO** ☐ **RECUSADO** ☐ **ADIADO** | _______________ | _______________ | _______________ |

---

## 14. Próximos passos pós-decisão

### 14.1. Se APROVADO

1. Cumprir os 10 itens de governança (§9).
2. Configurar provider OTP real em PROD.
3. Criar workflow GHA PROD (se aplicável) em PR separado.
4. Marcar janela.
5. Executar Fase 0–5 do `docs/release/prod-consent-mvp-execution-runbook.md`.
6. Postmortem T+72h.

### 14.2. Se RECUSADO

1. Documentar razão.
2. Reavaliar em janela posterior.

### 14.3. Se ADIADO

1. Definir nova data de revisão.
2. Manter docs atualizados.
3. Reavaliar quando bloqueador for removido.

---

## 15. Confirmações de não-ação (este pacote)

- ❌ Nada executado em PROD ou HML.
- ❌ Nenhuma migration aplicada.
- ❌ Nenhum deploy.
- ❌ Nenhuma alteração de feature flags, secrets, schema, RLS, dados.
- ❌ Nenhum workflow executável de PROD criado.
- ❌ Nenhuma chave/JWT/token real exposto.
- ❌ Consent NÃO habilitado em PROD.
- ❌ Safety NÃO habilitado em PROD.
- ❌ DEV_RETURN_OTP NÃO habilitado em PROD.
- ✅ Apenas: pacote de governança documental para decisão executiva.
