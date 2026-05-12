# Safety HML Smoke — pós-redeploy do PR #90

> **Escopo:** HML apenas. PROD está **fora de escopo**.
> **Tipo:** registro de execução de smoke pelo operador.
> **Esta sessão:** doc-only. Nenhuma execução, nenhum deploy, nenhuma alteração de schema/migrations/RLS/dados/feature flags.

## 1. Contexto

| Item | Valor |
|---|---|
| `main` SHA | `03735e5e3325424d1542048d72aea442b69b99b6` (≥ `fbe2400d` que mergeou o PR #90) |
| Origem do código deployado | PR #90 (`feat(safety): harden HML audit trail, policy fallback and alerts UI`), squash-merged em `fbe2400d` |
| HML Supabase project | `AgeKey-hml` — `wljedzqgprkpqhuazdzv` |
| PROD Supabase project | `AgeKey-prod` — `tpdiccnmsnjtjwhardij` — **NÃO consultado nesta janela** |
| Janela do smoke | imediatamente após o redeploy HML das 2 funções afetadas pelo PR #90 |

## 2. Funções redeployadas (HML)

Operador executou redeploy via Supabase CLI com `--no-verify-jwt` no projeto HML. Validação MCP em sessão anterior confirmou:

| Função | Version | verify_jwt | updated_at | Entrypoint |
|---|---|---|---|---|
| `safety-event-ingest` | 22 → **23** | `false` | 2026-05-12 12:08:42 UTC | `/Users/marcelofattori/...` (CLI local) |
| `safety-alert-dispatch` | 22 → **23** | `false` | 2026-05-12 12:08:47 UTC | `/Users/marcelofattori/...` (CLI local) |

As demais funções Safety (`safety-rule-evaluate`, `safety-rules-write`, `safety-step-up`, `safety-aggregates-refresh`, `safety-retention-cleanup`) e todas as Consent + Core permaneceram **inalteradas** (`updated_at` anteriores à janela do redeploy, versions intocadas). Validação detalhada em `docs/release/safety-hml-redeploy-note-pr90.md` + sessão MCP anterior.

## 3. Smoke executado pelo operador (HML)

### 3.1 `safety-event-ingest` — payload metadata-only legítimo

**Resultado:** ✅ PASS (HTTP 200)

| Campo de resposta | Valor |
|---|---|
| `event_id` | gerado |
| `actor_subject_id` | gerado |
| `counterparty_subject_id` | gerado |
| `decision` | `no_risk_signal` |
| `reason_codes` | `["SAFETY_NO_RISK_SIGNAL"]` |
| `severity` | `info` |
| `alert_id` | `null` |
| `step_up_session_id` | `null` |
| `content_included` | `false` |
| `pii_included` | `false` |

Interpretação: ingest principal aceita payload metadata-only, retorna decision envelope minimizado, sem PII na resposta.

### 3.2 `safety-rule-evaluate` — read-only

**Resultado:** ✅ PASS (HTTP 200)

| Campo de resposta | Valor |
|---|---|
| `decision` | `no_risk_signal` |
| `severity` | `info` |
| `risk_category` | `no_risk_signal` |
| `actions` | `[]` |
| `step_up_required` | `false` |
| `parental_consent_required` | `false` |
| `content_included` | `false` |
| `pii_included` | `false` |

Interpretação: avaliação de regras sem persistir alert/event; resposta minimizada.

### 3.3 `safety-rules-write` — override per-tenant

**Resultado:** ✅ PASS (HTTP 200)

| Campo de resposta | Valor |
|---|---|
| `rule_code` | `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` |
| `status` | `updated` |
| `tenant_id` | escopado ao tenant HML (correto) |

Interpretação: override per-tenant aplicado; RLS isolou para o `tenant_id` do principal.

### 3.4 Negative Privacy Guard tests — `safety-event-ingest`

Todos retornaram **HTTP 400** com `reason_code: PRIVACY_CONTENT_NOT_ALLOWED_IN_V1` (perfil `safety_event_v1` bloqueando antes do Zod):

| Vetor | Local | Resultado |
|---|---|---|
| `raw_text` em `metadata` | aninhado | ✅ 400 |
| `message` em `metadata` | aninhado | ✅ 400 |
| `image` em `metadata` | aninhado | ✅ 400 |
| `video` em `metadata` | aninhado | ✅ 400 |
| `audio` em `metadata` | aninhado | ✅ 400 |
| `birthdate` em `metadata` | aninhado | ✅ 400 |
| `email` em `metadata` | aninhado | ✅ 400 |
| `phone` em `metadata` | aninhado | ✅ 400 |
| `raw_text` em root | raiz | ✅ 400 |

Interpretação: Privacy Guard `safety_event_v1` ativo em profundidade (raiz + aninhado), bloqueando conteúdo bruto e PII canônica.

### 3.5 Endpoints avançados — skipados de propósito

| Endpoint | Motivo do skip | Status |
|---|---|---|
| `safety-alert-dispatch` | sem `SAFETY_ALERT_ID` válido capturado nesta janela | ⏭️ deferido |
| `safety-step-up` | sem `SAFETY_ALERT_ID` válido capturado nesta janela | ⏭️ deferido |
| `safety-aggregates-refresh` | sem `SAFETY_CRON_SECRET` autorizado nesta janela | ⏭️ deferido |
| `safety-retention-cleanup` | sem `SAFETY_CRON_SECRET` autorizado nesta janela; destrutivo (DELETE) | ⏭️ deferido |

Skips são intencionais — alinhados ao Smoke Test Pack `docs/release/safety-hml-smoke-test-pack.md` (Caso 9 — Retention só executar com autorização extra).

## 4. Classificação final

| Domínio | Status HML |
|---|---|
| Safety HML metadata-only core (`event-ingest` + `rule-evaluate`) | ✅ **operacional** |
| Safety HML Privacy Guard (`safety_event_v1`) | ✅ **operacional** |
| Safety HML rules override (`rules-write`) | ✅ **operacional** |
| Safety alert-dispatch / step-up | ⏳ pendente de teste com `SAFETY_ALERT_ID` válido |
| Safety cron / retention | ⏳ pendente de teste com `SAFETY_CRON_SECRET` em janela controlada |
| **Safety PROD** | ❌ **fora de escopo desta sessão** |

## 5. Pendências (para janelas futuras autorizadas, fora desta sessão)

1. Disparar um evento que efetivamente trigger uma regra (`UNKNOWN_TO_MINOR_PRIVATE_MESSAGE`, `ADULT_MINOR_HIGH_FREQUENCY_24H`, etc.) para capturar `SAFETY_ALERT_ID` real, depois exercitar:
   - `safety-alert-dispatch` (acknowledge → escalate → resolve → dismiss).
   - `safety-step-up` linkando ao alerta.
   - Verificar em `audit_events`: `safety.alert_created`, `safety.step_up_linked` (ou `safety.step_up_skipped_no_policy`), `safety.alert_acknowledged|_escalated|_resolved|_dismissed`.
2. Em janela controlada e separada, com `SAFETY_CRON_SECRET` HML disponível ao operador:
   - `safety-aggregates-refresh` (não-destrutivo).
   - `safety-retention-cleanup` em HML (destrutivo, requer massa de teste preparada e ciência de que `legal_hold=true` nunca apaga).
3. Verificação de `audit_events` HML pós-exercício completo:
   ```sql
   select action, count(*) from audit_events
   where action like 'safety.%'
     and created_at > now() - interval '24 hours'
   group by action
   order by action;
   ```
4. Operar a UI `/safety/alerts` em HML para validar:
   - Filtros server-side (status/severity/rule_code/since).
   - Paginação offset.
   - Badge de tenant no header.

## 6. Observação — migration history

O `migration list` HML mostra:

- `031` presente localmente, sem contraparte remota.
- Linha remota com timestamp `20260509222948` aparecendo apenas em remoto.

**Tratamento:** este descasamento é histórico/registro, **não bloqueia** o smoke Safety atual nem foi causado pelo PR #90 (PR #90 não introduziu migrations). Item para janela separada de reconciliação de migration history, com autorização explícita.

Nesta sessão **não foi** rodado nem `supabase db push`, nem `supabase migration repair`, nem `supabase db reset`, nem `supabase db pull`.

## 7. Confirmações de escopo desta sessão (doc-only)

- ✅ **PROD intocado.** Nenhuma chamada feita ao project `tpdiccnmsnjtjwhardij` (`AgeKey-prod`).
- ✅ **HML remoto intocado nesta sessão.** O smoke foi executado pelo operador em sessão separada; esta sessão só documenta o resultado.
- ✅ **Sem deploy.** Nenhuma chamada `supabase functions deploy` feita nesta sessão.
- ✅ **Sem `db push` / `db reset` / `db pull` / `migration repair`.** Migration history fica como item documental.
- ✅ **Sem alterações em schema, migrations, RLS, dados ou feature flags.**
- ✅ **Sem secrets reais comitados.** Nomes de variáveis (`SAFETY_ALERT_ID`, `SAFETY_CRON_SECRET`) usados apenas em contexto documental.
- ✅ **Sem PII ou conteúdo bruto** no relatório. Apenas códigos canônicos de reason/severity e shape de resposta.

## 8. Referências

- PR #90: `feat(safety): harden HML audit trail, policy fallback and alerts UI` — `fbe2400d`.
- PR #92: `docs(release): add Safety HML redeploy note for PR #90` — `03735e5e`.
- Nota operacional de redeploy: `docs/release/safety-hml-redeploy-note-pr90.md`.
- Smoke pack: `docs/release/safety-hml-smoke-test-pack.md`.
- Readiness checklist: `docs/release/safety-hml-readiness-checklist.md`.
- Runbook HML: `docs/release/safety-hml-runbook.md`.
