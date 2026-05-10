# HML Safety Retention / Legal Hold — Readiness

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Escopo:** análise read-only do `safety-retention-cleanup` cron, classes de retenção, legal_hold e auditoria. Sem execução; sem PROD.

---

## 1. Contrato auditado

`POST {BASE_URL}/safety-retention-cleanup`

```
Headers:
  Authorization: Bearer ${SAFETY_CRON_SECRET}      # privilegiado
  Content-Type: application/json
Body:
  {}                                                 # sem parâmetros

Response 200:
  {
    "ok": true,
    "total_deleted": <int>,
    "total_legal_hold_skipped": <int>,
    "per_class": [
      { "class": "event_30d", "deleted": <int>, "legal_hold_skipped": <int> },
      …
    ]
  }
```

Skip controlado se `enabled=false`:

```
{ "ok": true, "skipped": true, "reason": "safety_disabled" }
```

## 2. Classes de retenção mapeadas

`supabase/functions/safety-retention-cleanup/index.ts:24-34`:

| Class | Days | Categoria |
| --- | --- | --- |
| `no_store` | 0 | Não persiste — cleanup imediato (skip dentro do loop) |
| `session_24h` | 1 | Sessões efêmeras |
| `session_7d` | 7 | Sessões medias |
| `event_30d` | 30 | Eventos de baixo risco |
| `event_90d` | 90 | **Default Safety MVP** (`AGEKEY_SAFETY_DEFAULT_EVENT_RETENTION_CLASS`) |
| `event_180d` | 180 | Eventos sensíveis |
| `alert_12m` | 365 | Alertas operacionais |
| `case_24m` | 730 | Casos consolidados |
| `legal_hold` | ∞ | **Nunca expira por código** — tratado por filtro `legal_hold = true` |

## 3. Verificações exigidas (do prompt) e status

| Verificação | Status | Evidência |
| --- | --- | --- |
| cleanup não apaga `legal_hold` | ✅ | `eq('legal_hold', false)` em todos os SELECT/DELETE (linha 113) |
| eventos vencidos são removidos | ✅ | DELETE em batch por classe (linha 128-132) |
| agregados preservados quando permitido | ✅ | `safety_aggregates` é tabela separada; cleanup só toca `safety_events`. Aggregates são rebuild-eable via `safety-aggregates-refresh` |
| `audit_event` é gerado | ✅ | `writeAuditEvent` por tenant (linhas 148-160) e por skip de legal hold (linhas 171-182) |
| cron exige secret | ✅ | check `req.headers.get('authorization') === Bearer ${cronSecret}` (linha 42-44); throw `ForbiddenError` em mismatch |
| **não deve rodar publicamente** | ✅ | Sem fallback; secret obrigatório |

## 4. Mecanismos de defesa

### 4.1 GUC `agekey.retention_cleanup`

`index.ts:58-62` liga a GUC antes do loop e `index.ts:187-191` (no `finally`) sempre desliga. Esta GUC sinaliza ao trigger `safety_events_no_mutation` que o DELETE em curso é **autorizado** — qualquer DELETE fora deste job é barrado pelo trigger. Garante que mesmo que um operador tente apagar manualmente via SQL com service_role, o trigger bloqueia.

### 4.2 Filtro explícito `legal_hold = false`

Todo SELECT de candidatos para DELETE inclui `eq('legal_hold', false)` (linha 113). Defesa em profundidade ao trigger.

### 4.3 Contagem separada de skips

Antes do DELETE, cleanup faz um SELECT `count: 'exact', head: true` para contar quantas linhas estão em `legal_hold = true` E `occurred_at < cutoff` (linhas 80-86). Esses são logados como `RETENTION_LEGAL_HOLD_ACTIVE` e auditados por tenant. Permite operador detectar se há events sob legal hold que estão "grudados" indefinidamente — é exatamente o comportamento desejado, mas é importante ter visibilidade.

### 4.4 Auditoria por tenant

Para cada tenant afetado (deleções), grava `audit_event` `safety.retention_cleanup` com `actor_type='cron'` e diff `{retention_class, cutoff, deleted_in_tenant}`. Para tenants com legal_hold skipped, grava separadamente `safety.retention_cleanup.legal_hold_skip`.

## 5. Lacunas identificadas

### R1 — Cron schedule não existe para Safety
Migration `028_retention_cron_schedule.sql` agenda **apenas** `agekey-retention-job` (Core). Safety `safety-retention-cleanup` precisa de schedule próprio (ex.: `agekey-safety-retention-job` em horário diferente, ou compartilhado). **Severidade**: alta para PROD; em HML pode rodar manualmente. **Ação**: `030_safety_cron_schedule.sql` em janela separada — **não nesta sessão**.

### R2 — Aggregates refresh não tem schedule
Mesmo gap para `safety-aggregates-refresh`. **Severidade**: média (aggregates ficam stale com retention rodando, mas eventos novos os mantêm vivos).

### R3 — `set_config` via RPC
Linha 58 chama `client.rpc('set_config', { setting_name, new_value, is_local: false })`. `set_config(..., false)` afeta a sessão inteira; em conexão poolada (PgBouncer transaction mode), pode vazar para outras requisições. **Mitigação atual**: `finally` sempre desliga. **Risco residual**: se a session não é a mesma do trigger check (porque PgBouncer assignou outra), a defesa some. **Severidade**: média. **Ação**: revisar com Eng de Plataforma; pode ser que Supabase use session pooling para Edge Functions, mitigando o risco.

### R4 — Batch size não é ajustável por tenant
`AGEKEY_SAFETY_RETENTION_CLEANUP_BATCH_SIZE` é env global (default 500). Tenants grandes podem precisar batches maiores; pequenos, menores. **Severidade**: baixa. **Ação**: parametrizável em rodada futura.

### R5 — Cleanup não cobre `safety_alerts`, `safety_interactions`, `safety_subjects`, `safety_evidence_artifacts`
Hoje o cron toca só `safety_events`. Os outros recursos têm retention class própria mas o cleanup não os alcança. **Severidade**: média a alta para PROD (compliance); em HML é tolerável. **Ação**: estender o cleanup para outras tabelas em rodada futura — **não nesta sessão**.

### R6 — Sem dry-run mode
Não há flag para `dry_run = true` que retorne `would_delete` sem executar. Útil para auditoria pré-prod. **Severidade**: baixa. **Ação**: adicionar em rodada futura.

### R7 — Cobertura de teste é apenas no nível de regras unitárias
- ✅ `retention-cleanup-rules.test.ts` (20 tests)
- ✅ `safety-retention-legal-hold.test.ts` (5 tests)

Não há teste integração com tabela real cobrindo skip de legal_hold + audit_event. **Severidade**: baixa (tests de regra dão alta confiança), mas integração com auditoria poderia ser exercitada.

## 6. Critérios para executar `safety-retention-cleanup` em HML

1. ✅ `SAFETY_CRON_SECRET` confirmado em vault HML (não em commit, não em CI público).
2. ✅ Operador autorizado.
3. ✅ Janela de manutenção (cleanup pode mover muitos eventos; melhor fora do horário de smoke).
4. ✅ Confirmação prévia da contagem esperada de exclusão (via UI `/safety/retention`).
5. ✅ Backup verificado (Supabase PITR ativo em HML).
6. ✅ R1 resolvido OU operador explicitamente OK em rodar manualmente.

**Esta sessão NÃO executa retention-cleanup** — depende de `SAFETY_CRON_SECRET` e autorização explícita.

## 7. Verificação cruzada com UI

- `/safety/retention` mostra eventos por classe e count de `legal_hold = true`. ✅
- `/safety/events` mostra `retention_class` e ícone 🔒 quando `legal_hold = true`. ✅
- `/safety/evidence` mostra `legal_hold` e `retention_class` por artefato. ✅
- Não há UI para alternar `legal_hold` — operação manual via SQL ou via API dedicada (que ainda não existe). **Gap UI4** documentado em `hml-safety-ui-readiness.md`.

## 8. Veredito

- `safety-retention-cleanup` está **funcionalmente correto** para HML.
- Para PROD precisa:
  - R1 resolvido (cron schedule formal).
  - R3 revisado (set_config + PgBouncer).
  - R5 escopo expandido OU decisão explícita de manter só eventos no MVP.
- **Sem ações executadas nesta sessão.**
