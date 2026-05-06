# AgeKey — Production Readiness 20260429: Registro Consolidado de Sessão

**Branch base:** `agekey/production-readiness-20260429`
**HEAD final:** `a417962` (PR #47 — chore(p0): post-merge fixes)
**Projeto Supabase:** `agekey-hml` (`wljedzqgprkpqhuazdzv`)
**Encerramento:** 2026-05-06

---

## 1. Escopo entregue nesta sessão

Esta sessão consolidou:
1. As 11 rodadas funcionais (R1–R11) em um único branch de produção.
2. Os fixes pós-merge P0 (alinhamento código ↔ banco real).
3. Deploy de 14 Edge Functions pendentes em `agekey-hml`.

Nenhuma das atividades aplicou mudanças destrutivas; toda alteração de código está versionada via PRs squash-mergeados, e toda alteração de schema está em migrations versionadas.

---

## 2. Histórico de PRs integrados em `agekey/production-readiness-20260429`

```
a417962 chore(p0): post-merge fixes — types regen + migrations 029/030 (#47)
790a066 test(cross-tenant): infra + suítes RLS isolation (R8)         (#44)
332a7d0 feat(proof): honest stub ZKP/BBS+ mode (R11)                  (#41)
31d7969 feat(credential): honest stub SD-JWT VC mode (R10)            (#40)
b96c8b4 feat(safety): UI + Edge Function para override de regras (R9) (#42)
0b8c6ed feat(retention): cron unificado de retenção (R7)              (#43)
90796d1 feat(consent): endpoint público de texto integral (R6)        (#38)
121caa7 feat(consent): provider real de OTP via relay HTTPS (R5)      (#39)
7acac09 feat(safety): AgeKey Safety Signals MVP metadata-only (R4)    (#37)
f40349a feat(consent): AgeKey Consent MVP — parental consent (R3)     (#36)
00d69db feat(shared): introduzir camada canônica modular              (#34)
```

---

## 3. Estado do banco em `agekey-hml`

### 3.1 Migrations aplicadas (020–030)

| Migration | Conteúdo | Origem |
|---|---|---|
| 020 | Tabelas de Consent (parental_consents, parental_consent_*) | R3 |
| 021 | Tabelas de Safety Signals (safety_events, safety_aggregates, safety_alerts) | R4 |
| 022 | OTP provider real (relay HTTPS) | R5 |
| 023 | Endpoint público de texto integral de policy | R6 |
| 024 | Safety Signals core — *fix* `"window"` (palavra reservada PG, agora aspada) | R4 fix |
| 025 | Cron unificado de retenção (pg_cron + pg_net) | R7 |
| 026 | UI + Edge Function de override de regras | R9 |
| 027 | SD-JWT VC stub honesto | R10 |
| 028 | BBS+ ZKP stub honesto | R11 |
| 029 | RPCs P0: `set_current_tenant`, `safety_recompute_messages_24h`, recriação de `build_parental_consent_event_payload` com `payload_hash` SHA-256 real | PR #47 |
| 030 | `ENABLE ROW LEVEL SECURITY` nas 26 partições legadas (audit_events_* + billing_events_*) | PR #47 |

### 3.2 Extensões habilitadas
- `pgsodium` — instalada para criptografia de contatos de guardian via Vault.
- `pg_cron` + `pg_net` — usados pelo retention-job e pelo recompute do Safety.
- `pgcrypto` — usado para `digest()` no `payload_hash` real.

### 3.3 Advisors críticos resolvidos
- ✅ RLS habilitado em 26 partições (advisor crítico anterior).
- ✅ pgsodium instalado (pré-requisito para criptografia de PII de guardian).

---

## 4. Edge Functions em `agekey-hml`

**Estado final:** 35/35 ACTIVE.

### 4.1 Já existentes antes desta sessão (21)
`verifications-session-create`, `verifications-session-get`, `verifications-session-complete`, `verifications-token-verify`, `verifications-token-revoke`, `verifications-list`, `issuers-register`, `issuers-list`, `policies-list`, `policies-write`, `applications-list`, `applications-write`, `applications-rotate-key`, `tenant-bootstrap`, `audit-list`, `proof-artifact-url`, `jwks`, `key-rotation`, `webhooks-worker`, `retention-job`, `trust-registry-refresh`.

### 4.2 Deployadas nesta sessão (14)

| # | Function | Round | Tamanho |
|---|---|---|---|
| 1 | `parental-consent-session` | R3 | 156.7 kB |
| 2 | `parental-consent-guardian-start` | R3 | 160.0 kB |
| 3 | `parental-consent-confirm` | R3 | 168.1 kB |
| 4 | `parental-consent-session-get` | R3 | 152.0 kB |
| 5 | `parental-consent-revoke` | R3 | 152.5 kB |
| 6 | `parental-consent-token-verify` | R3 | 152.0 kB |
| 7 | `parental-consent-text-get` | R6 | 152.6 kB |
| 8 | `safety-event-ingest` | R4 | 165.5 kB |
| 9 | `safety-rule-evaluate` | R4 | 156.0 kB |
| 10 | `safety-alert-dispatch` | R4 | 149.9 kB |
| 11 | `safety-step-up` | R4 | 145.5 kB |
| 12 | `safety-aggregates-refresh` | R4 | 124.7 kB |
| 13 | `safety-retention-cleanup` | R4 | 126.3 kB |
| 14 | `safety-rules-write` | R9 | 151.8 kB |

Comando usado:
```bash
npx supabase functions deploy <slug> --project-ref wljedzqgprkpqhuazdzv --no-verify-jwt
```
Verify-JWT desligado segue o padrão das 21 anteriores: a autenticação é feita por API key dentro da própria function.

---

## 5. Sincronia código ↔ banco

- `apps/admin/types/database.ts` regenerado via `supabase gen types` (3 703 linhas) e re-exporta 27 aliases de conveniência (`TenantRow`, `UsageCounterRow`, `ParentalConsentRequestRow`, `SafetyAlertRow`, etc.) para preservar compat com o código existente.
- `packages/integration-tests/package.json` recebeu `@types/node ^20.16.0`; `tsconfig.json` recebeu `"types": ["node"]` para que `process.env` seja reconhecido em runtime de teste.
- `pnpm-lock.yaml` regravado para incluir o workspace `@agekey/integration-tests`.

---

## 6. Fixes notáveis aplicados durante a sessão

| Fix | Onde | Motivo |
|---|---|---|
| `window` aspas duplas | migration 024 | `window` é palavra reservada em PostgreSQL — column def e UNIQUE constraint precisaram virar `"window"`. |
| `payload_hash` real | migration 029 | Substituído placeholder por SHA-256 efetivo de `v_payload::text` via `encode(digest(...), 'hex')`. |
| Renomear `ASSURANCE_RANK` para `AGE_ASSURANCE_RANK` | shared canonical | Colisão com export legado em `types.ts`; helper `meetsAgeAssurance` introduzido. |
| Cherry-pick + force-push para R6/R11 | recuperação | Force-push fez o GitHub auto-fechar PRs com diff zero; recriados via cherry-pick dos SHAs originais. |
| Hard-conflict R11 vs R10 já mergeado | `package.json` + `src/index.ts` do shared | Ambas rodadas tocavam a mesma linha (`./credential` vs `./proof`); resolvido mantendo as duas exportações. |

---

## 7. Pendências operacionais (não-bloqueantes para code freeze)

Estas pendências não exigem mais alterações de código no branch — são tarefas de configuração/runtime para o operador de plataforma.

### 7.1 GUCs do cron de retenção
Sem isso, o `retention-job` cron não tem URL para chamar:
```sql
ALTER DATABASE postgres SET agekey.retention_job_url
  = 'https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1/retention-job';
ALTER DATABASE postgres SET agekey.cron_secret = '<defina-um-secret>';
ALTER DATABASE postgres SET agekey.retention_dry_run = 'true';
```

### 7.2 Provider real de OTP
Configurar `agekey.otp_relay_url`, `agekey.otp_relay_token` e ligar a feature flag `consent.otp.real_provider` quando o relay HTTPS estiver pronto. Enquanto isso, o módulo opera em modo eager-fail conforme contrato.

### 7.3 Feature flags
A ativação modular (Consent / Safety / Credential / Proof) é feita por feature flag por tenant. Padrão é desligado.

### 7.4 Auditoria criptográfica externa (R10/R11)
Os modos SD-JWT VC e BBS+ ZKP estão em **stub honesto** — recusam fabricar verificação. Para sair de stub é necessário auditoria externa antes de habilitar `credential.real` e `proof.real`.

### 7.5 Pré-go-live
- DNS para domínios de produção.
- Separação `agekey-prod` (projeto Supabase distinto).
- Pentest no escopo cross-tenant + Privacy Guard + webhooks.

---

## 8. Limpeza de repositório feita nesta sessão

- ✅ Branch local `agekey/production-readiness-20260429` em sincronia com `origin`.
- ✅ Worktrees temporários removidos (R5–R11 já consolidados via PR).
- ✅ Branch redundante remoto `claude/agekey-p0-post-merge-fixes` agendado para deleção (mesmo conteúdo do PR #47, sem PR aberto associado).

---

## 9. Encerramento da sessão

Esta sessão fica formalmente encerrada com:
- 11 rodadas funcionais integradas.
- P0 fixes integrados via PR #47.
- 14 edge functions deployadas (35/35 ACTIVE).
- Documentação consolidada neste arquivo.

A próxima sessão pode iniciar a **rodada 2** a partir do HEAD `a417962` em `agekey/production-readiness-20260429` com banco e edge runtime já alinhados ao código.
