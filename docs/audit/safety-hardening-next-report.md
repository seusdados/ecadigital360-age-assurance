# Safety Hardening — Round 5 (Agent 5) — Audit Report

**Branch:** `claude/safety-hardening-next`
**Target PR:** PR E (draft)
**Date:** 2026-05-07
**Scope:** Hardening do AgeKey Safety Signals MVP (metadata-only V1) sem
quebra de contrato, sem migrações, sem mudança de schema, sem execução
em PROD. Compatibilidade com HML preservada.

---

## 1. O que foi revisado

### Edge Functions (`supabase/functions/safety-*`)

| Function | Verificação | Status |
| -------- | ----------- | ------ |
| `safety-event-ingest` | Privacy guard `safety_event_v1` ANTES do Zod; defesa em profundidade no metadata; `assertPayloadSafe(response, 'public_api_response')` final | OK |
| `safety-rule-evaluate` | Privacy guard no body de input; envelope público minimizado | OK |
| `safety-rules-write` | Audit event para POST/PATCH/DELETE; bloqueia edição de regra global; força `tenant_id = principal.tenantId` | OK |
| `safety-alert-dispatch` | RLS por tenant_id; admin minimized view profile | OK |
| `safety-step-up` | Cria `verification_session` no Core; nunca duplica lógica de verificação | OK |
| `safety-aggregates-refresh` | Cron + bearer; idempotente | OK |
| `safety-retention-cleanup` | Filtro `legal_hold = false`; GUC `agekey.retention_cleanup`; auditoria | **HARDENED** |

### Helpers (`supabase/functions/_shared/safety/*`)

| File | Verificação | Status |
| ---- | ----------- | ------ |
| `payload-hash.ts` | SHA-256 do raw body; nunca persiste raw | OK |
| `feature-flags.ts` | Flags via env; defaults seguros | OK |
| `subject-resolver.ts` | Idempotente; só upgrade `unknown→known` | **HARDENED** (inclui `subject_ref_hmac` na resposta) |
| `aggregates.ts` | Upsert + RPC fallback | OK |
| `step-up.ts` | Insere em `verification_sessions` (Core) | OK |
| `consent-check.ts` | Insere `parental_consent_requests` quando habilitado; nunca duplica lógica do módulo Consent | OK |

### Pure libs (`packages/shared/src/safety/*`)

| File | Verificação | Status |
| ---- | ----------- | ------ |
| `relationship.ts` | Pure; `adult_to_minor`, `unknown_to_minor` etc. | OK |
| `rule-engine.ts` | 5 regras hardcoded; severity↔action invariant | **HARDENED** (invariant agora aplicado tanto ao override per-rule quanto ao agregado) |

### Privacy Guard (read-only, forbidden file)

Confirmado que `forbidden-claims.ts` no perfil `safety_event_v1` rejeita
em profundidade todos os campos exigidos:
`message, raw_text, message_body, image, image_data, video, video_data,
audio, audio_data, birthdate, dob, age, exact_age, name, full_name,
civil_name, cpf, rg, passport, document, email, phone, selfie, face,
biometric, address, ip, gps, latitude, longitude` (e seu superset
canônico de PII). Comparação é case-insensitive com normalização de
underscore/hífen.

### Reason codes canônicos

Todos os reason codes emitidos pelo rule-engine estão em
`SAFETY_*` (`packages/shared/src/taxonomy/reason-codes.ts`) — não há
strings inline ad-hoc fora do catálogo. Catálogo não foi modificado
(forbidden file).

---

## 2. Mudanças aplicadas

### `packages/shared/src/safety/rule-engine.ts`

- **Adicionado** `enforceSeverityActionInvariant(severity, actions)`:
  função pura que garante que `severity in {high, critical}` sempre
  inclui pelo menos uma ação humana
  (`escalate_to_human_review` ou `notify_safety_team`). Se ausente,
  acrescenta `notify_safety_team` ao final preservando ordem.
- **Aplicado** o invariant ao override per-rule (após o tenant config)
  **e** ao set de ações agregadas — defesa em profundidade dupla.
- Invariant é no-op para severities `info|low|medium`.

### `supabase/functions/safety-retention-cleanup/index.ts`

- **Detecção explícita** de rows `legal_hold=true` antes do DELETE
  (`SELECT count(*) ... legal_hold=true`); resultado vai para
  `legal_hold_skipped` no relatório por classe.
- **Audit event** `safety.retention_cleanup.legal_hold_skip` por tenant
  afetado, com `reason_code: 'RETENTION_LEGAL_HOLD_ACTIVE'` no `diff`.
- **`try/finally`** que sempre desliga
  `agekey.retention_cleanup` (off) ao final, garantindo que o trigger
  `safety_events_no_mutation` permanece ativo fora deste job.
- Resposta agora inclui `total_legal_hold_skipped` e cada item de
  `per_class` traz `legal_hold_skipped`.

### `supabase/functions/_shared/safety/subject-resolver.ts`

- `SafetySubjectResolved` agora inclui `subject_ref_hmac`. Permite que
  callers (`safety-event-ingest` → `requestParentalConsentCheck`) usem
  uma referência opaca estável em vez do UUID interno.
- SELECTs incluem o campo; UPDATE branch repassa o hmac.

### Arquivos NOVOS de teste (`packages/shared/__tests__/`)

- **`safety-privacy-guard-rejects-raw.test.ts`** — exercita cada chave
  de `SAFETY_EVENT_FORBIDDEN_KEYS` no perfil `safety_event_v1` (raiz +
  aninhado), variantes case/separador, e confirma que payload
  metadata-only legítimo passa.
- **`safety-rule-engine-severity-action.test.ts`** — invariant
  severity↔action: high/critical sempre carrega human review, ordem
  preservada, não-ativação para low/medium, e cobertura via
  `evaluateAllRules` (override "ruim" reinjeta human review).
- **`safety-retention-legal-hold.test.ts`** — modela a lógica do
  cleanup e prova: (a) `legal_hold=true` nunca é deletado, (b) audit
  event `RETENTION_LEGAL_HOLD_ACTIVE` é emitido por tenant impactado,
  (c) rows recentes não são tocadas, (d) `no_store`/days=0 são
  ignorados.

---

## 3. Tests adicionados — totalização

| Test file | Test cases |
| --------- | ---------- |
| `safety-privacy-guard-rejects-raw.test.ts` | ~70 (parametrizado por key) |
| `safety-rule-engine-severity-action.test.ts` | 9 |
| `safety-retention-legal-hold.test.ts` | 5 |
| **TOTAL** | **+80 tests** |

`@agekey/shared`: **236 → 316 testes passando** (zero regressão).
`@agekey/integration-tests`: 1 passing + 10 skipped (sem regressão).

---

## 4. Issues encontrados e resolvidos

| # | Issue | Severidade | Resolução |
| - | ----- | ---------- | --------- |
| 1 | Override per-tenant podia remover `notify_safety_team` de regra `high` | medium (configuração ruim, não execução de código) | `enforceSeverityActionInvariant` aplicado no override e no agregado. |
| 2 | GUC `agekey.retention_cleanup` permanecia `on` após erro no batch — abertura de janela para DELETEs fora do cron passar pelo trigger | medium (race em failure paths) | `try/finally` reseta GUC para `off`. |
| 3 | Cleanup deletava só rows com `legal_hold=false`, mas não emitia audit do skip — falta de trilha para auditoria DPO | medium | Audit `RETENTION_LEGAL_HOLD_ACTIVE` por tenant afetado. |
| 4 | `subject_ref_hmac` era acessado em `safety-event-ingest:380` mas não estava no shape de `SafetySubjectResolved` (caía no fallback `?? id`) | low (correctness) | Campo adicionado ao SELECT/return. |

---

## 5. Issues deferred (fora de escopo / risco aceito)

- **`safety-rules-write` PATCH/DELETE em UUID inválido**: a regex já
  filtra UUIDs válidos no path; ataques 404. Aceitável para MVP.
- **`safety-aggregates-refresh` retorno detalhado por classe**: a RPC
  `safety_recompute_messages_24h` é black-box; cobertura de invariância
  ficaria mais natural via teste E2E em HML. Defer.
- **Admin UI**: read-only review confirmou que não há vazamento de PII
  (já blindado por privacy guard server-side antes do response). Sem
  mudança em `apps/admin/`.

---

## 6. Verificação Privacy / Compatibilidade

### NEGATIVOS confirmados (constraints não-negociáveis)

- **NO raw content**: `safety_event_v1` rejeita `message`, `raw_text`,
  `message_body`, `image`, `image_data`, `video`, `video_data`,
  `audio`, `audio_data`. `payload-hash.ts` só faz SHA-256 do body
  string; não persiste rawText.
- **NO LLM no Safety**: nenhum import de provedor LLM em
  `supabase/functions/safety-*` ou `_shared/safety/*`. Verificado por
  grep (`grep -r anthropic\|openai supabase/functions/safety-*` → 0).
- **NO facial / emotion recognition**: nenhuma referência a `face`,
  `emotion`, `facial`, `image_classification` no rule engine. Regras
  operam sobre flags de metadata (`has_media`, `has_external_link`).
- **NO interception**: nenhuma captura de tráfego, TLS interception ou
  device monitoring. Eventos chegam por POST do tenant.
- **NO universal cross-tenant score**: aggregates são por
  `(tenant_id, application_id, subject_id)`; nenhum cálculo combina
  tenants. RLS exige `tenant_id` em `safety_subjects`,
  `safety_events`, `safety_alerts`, `safety_aggregates`.
- **NO crime detection claim**: reason codes e payloads usam termos
  de "risk signal proporcional"; output do rule engine fala em
  `decision: needs_review|step_up_required|...`. Nada que afirme
  conduta criminal.
- **NO breaking API change**: contratos
  `SafetyEventIngestResponse`, `SafetyGetDecisionResponse`,
  `SafetyRuleWriteResponse`, `SafetyAlertActionRequestSchema`
  inalterados. `safety-retention-cleanup` adiciona campo
  `total_legal_hold_skipped` (additive/non-breaking).

### POSITIVOS confirmados

- **Privacy Guard** chamado com perfil `safety_event_v1` em
  `safety-event-ingest:96` ANTES da validação Zod (linha 114).
- **Defesa em profundidade**: `assertPayloadSafe(response,
  'public_api_response')` aplicado a TODA resposta pública dos 5
  endpoints públicos (event-ingest, rule-evaluate, step-up,
  rules-write, alert-dispatch). [verificado por grep]
- **Audit trail**: cada `safety-rules-write` emite
  `safety.rule.{created|updated|deleted}` em `audit_events`
  (já implementado no Round 4; verificado).
- **Step-up via Core**: `safety-step-up` insere em
  `verification_sessions` (tabela do Core), nunca cria sessão
  inline. [linha 99-106]
- **Consent-check via módulo Consent**: `safety-event-ingest` chama
  `requestParentalConsentCheck` que insere em
  `parental_consent_requests` (tabela do Consent). [linha 373-385]
- **Trigger `safety_events_no_mutation`** continua intacto; cleanup
  só passa por causa da GUC `agekey.retention_cleanup=on` ligada
  exclusivamente em try/finally pelo cron job.

---

## 7. Validação

| Comando | Resultado |
| ------- | --------- |
| `pnpm typecheck` | 6/6 successful |
| `pnpm lint` | clean (warning pré-existente em `apps/admin` fora de escopo) |
| `pnpm test` (shared) | **316 passing** (236 baseline + 80 novos) |
| `pnpm test` (integration-tests) | 1 passing, 10 skipped (no regression) |

`git diff --stat` toca apenas:

- `packages/shared/src/safety/rule-engine.ts`
- `supabase/functions/_shared/safety/subject-resolver.ts`
- `supabase/functions/safety-retention-cleanup/index.ts`
- `packages/shared/__tests__/safety-*.test.ts` (3 novos)
- `docs/audit/safety-hardening-next-report.md` (este arquivo)

Nenhum arquivo na lista FORBIDDEN foi alterado.

---

## 8. Riscos remanescentes

1. **`safety-aggregates-refresh` depende de RPC opaca** — se a função
   SQL `safety_recompute_messages_24h` não existir em algum ambiente,
   o retorno é silenciosamente `[]`. Coberto operacionalmente em HML.
2. **`enforceSeverityActionInvariant` adiciona `notify_safety_team`
   mesmo quando o tenant pediu silêncio total** — esse é o
   comportamento desejado (defesa em profundidade); deve ser
   documentado no painel admin para o tenant entender. Não há ação
   técnica adicional para este round.
3. **Audit de legal_hold só dispara se houve linha encontrada na
   janela** — se um tenant nunca tem rows expirando, nunca há audit.
   Comportamento esperado.

---

## 9. Resumo

Este round foi puramente de hardening: zero schema, zero migrations,
zero novos endpoints, zero quebra de contrato HML. Foram fechados 4
pequenos riscos (1 funcional, 2 de auditoria/operação, 1 de
correctness no resolver) e adicionados 80 testes que blindam as
invariantes core do Safety v1 (metadata-only, severity↔action,
legal_hold absoluto).
