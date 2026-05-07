# AgeKey P0 — Release Notes (R1–R11 + post-merge fixes)

> Versão: 2026-05-07.
> Branch base do P0: `agekey/production-readiness-20260429` consolidado em `main`.
> Referência operacional: `docs/audit/agekey-production-readiness-20260429-session-log.md`.

## Sumário

A timeline P0 do AgeKey consolida 11 rodadas funcionais (R1–R11) mais um lote de fixes pós-merge integrados em `main` via PRs #53 (reconciliação P0 ↔ main), #54 (reconciliação histórica de migrações HML), #55 e #56 (fixes administrativos/operacionais associados ao mesmo ciclo).

**Breaking changes: zero.** Todos os contratos públicos (Decision Envelope, AgeKey Token, webhooks, taxonomia de reason codes) são compatíveis com a base anterior.

> O registro operacional detalhado da consolidação está mantido na branch `agekey/production-readiness-20260429` em `docs/audit/agekey-production-readiness-20260429-session-log.md` (não republicado em `main` — ver §1).

## 1. Estado por ambiente

| Ambiente | Estado | Componentes ativos |
|---|---|---|
| HML (`agekey-hml`) | **Completo** — 30 migrations + 35 Edge Functions ACTIVE | Core + Consent (R3/R5/R6) + Safety v1 (R4/R9) + Retention (R7) + Credential stub (R10) + Proof stub (R11) + post-merge fixes (029/030) |
| PROD | **Parcial — apenas Core + migration 017** | Verificações canônicas (Decision Envelope), JWKS, key rotation, retention de núcleo. Consent/Safety/Credential/Proof **não habilitados em PROD**. |

Detalhe operacional do HML: registrado na branch `agekey/production-readiness-20260429`, arquivo `docs/audit/agekey-production-readiness-20260429-session-log.md` (não publicado em `main`).
Decisão para PROD: ver [`consent-safety-prod-decision-memo.md`](./consent-safety-prod-decision-memo.md).

## 2. Features novas (R1–R11)

### R1 — Bootstrap canônico do Core

- Camada modular `packages/shared/src/` com `decision/`, `policy/`, `privacy/`, `taxonomy/`, `webhooks/`, `reason-codes.ts`.
- `Decision Envelope` canônico (`docs/specs/agekey-decision-envelope.md`) usado em token, webhook e REST.
- Privacy Guard em runtime (`packages/shared/src/privacy-guard.ts`) com ≥ 100 vetores de fuzz.

### R2 — Policy engine canônico

- Avaliação determinística por tenant; `assurance_level` mínimo configurável.
- Specs: `docs/specs/agekey-policy-engine-canonical.md`, `agekey-core-canonical-contracts.md`.

### R3 — Parental Consent MVP

- 6 Edge Functions (`parental-consent-session`, `-guardian-start`, `-confirm`, `-session-get`, `-revoke`, `-token-verify`).
- Migrations 020–023 (core, guardian, RLS, webhooks).
- Contato do *guardian* criptografado via Vault `pgsodium`; `child_ref_hmac` HMAC client-side.
- Documentação: `docs/modules/parental-consent/`.

### R4 — Safety Signals MVP (metadata-only)

- 6 Edge Functions (`safety-event-ingest`, `-rule-evaluate`, `-alert-dispatch`, `-step-up`, `-aggregates-refresh`, `-retention-cleanup`).
- Migrations 024–027 (core, RLS, webhooks, seed de regras).
- **Sem** conteúdo bruto; apenas metadados, contadores e agregados por tenant.
- Documentação: `docs/modules/safety-signals/`.

### R5 — OTP real (relay HTTPS) para Parental Consent

- Provider via `agekey.otp_relay_url` + `agekey.otp_relay_token`.
- Feature flag `consent.otp.real_provider` (desligada por padrão).
- Modo eager-fail quando GUCs não configuradas — evita falsa entrega.

### R6 — Endpoint público de texto integral da policy parental

- Edge Function `parental-consent-text-get` (sem JWT).
- Versão da policy retornada com hash; transparência para o guardian.

### R7 — Cron unificado de retenção

- Edge Function `retention-job` orquestrada por `pg_cron` + `pg_net`.
- Modo `dry_run` controlado por GUC; auditável via `audit_events`.
- Spec: `docs/specs/agekey-retention-job.md`, `agekey-retention-classes.md`.

### R8 — Suíte cross-tenant RLS

- `packages/integration-tests/` com matriz cross-tenant.
- Documento: `docs/audit/cross-tenant-test-matrix.md`.
- 1 teste passa contra DB local; 10 skipped exigem DB real (executados manualmente em HML).

### R9 — UI de override de regras de Safety

- Edge Function `safety-rules-write` + páginas em `apps/admin`.
- Override por tenant; auditado em `safety_rules_overrides`.

### R10 — Credential mode (SD-JWT VC) — stub honesto

- Adapter-only; recusa-se a fabricar verificação.
- Real-mode bloqueado por feature flag `credential.real`.
- Spec: `docs/specs/agekey-credential-mode.md`.

### R11 — Proof mode (BBS+ ZKP) — stub honesto

- Adapter-only; recusa-se a fabricar verificação.
- Real-mode bloqueado por feature flag `proof.real`.
- Spec: `docs/specs/agekey-proof-mode.md`.

## 3. Post-merge fixes em `main`

| PR | Resumo | Impacto |
|---|---|---|
| #53 | Reconciliação P0 ↔ main: P0 adotado como source of truth técnico. Port aditivo de migration 017 (fix de tenant self-access) e da spec consolidada `agekey-core-canonical-contracts.md`. Histórico da timeline alternativa preservado em `docs/audit/historical-main-timeline/`. | Sem mudança de runtime adicional além da 017. |
| #54 | Plano de reconciliação de migrations HML — alinhamento entre histórico aplicado em HML e ordem das migrations do repositório. Documento auditável. | Apenas docs. |
| #55 | Fix administrativo/operacional pós-reconciliação (revisão de scripts e housekeeping). | Sem mudança de schema. |
| #56 | Fix administrativo/operacional pós-reconciliação (idem). | Sem mudança de schema. |

> Observação: as referências a #55 e #56 acima descrevem o lote de PRs administrativos do mesmo ciclo. A descrição é genérica para evitar dependência de detalhes que possam ter sido renumerados após a abertura desta release notes.

### 3.1 Migrations 029 e 030

- `029_post_merge_p0_fixes.sql`:
  - `set_current_tenant(uuid)` RPC.
  - `safety_recompute_messages_24h(...)` recomputação determinística de agregado.
  - `build_parental_consent_event_payload(...)` com `payload_hash` SHA-256 real (`encode(digest(v_payload::text), 'hex')`).
- `030_enable_rls_audit_billing_partitions.sql`:
  - `ENABLE ROW LEVEL SECURITY` em 26 partições legadas (`audit_events_*` + `billing_events_*`).
  - Resolve advisor crítico de RLS em partições.

## 4. Breaking changes

**Nenhum.** Compatibilidade total com:

- AgeKey Token (claims existentes preservadas; novas opcionais).
- Decision Envelope (campos novos opcionais).
- Webhooks (esquema versionado; v1 estável).
- Reason codes (taxonomia aditiva).
- SDK público (`@agekey/sdk-js`, `@agekey/widget`).

## 5. Migrações que vão para HML (já aplicadas)

Sequência total aplicada em `agekey-hml`:

```
000_bootstrap … 016_vault_create_secret
017_fix_tenant_self_access            ← reconciliado em main via PR #53
020_parental_consent_core             ← R3
021_parental_consent_guardian         ← R3
022_parental_consent_rls              ← R3
023_parental_consent_webhooks         ← R3
024_safety_signals_core               ← R4 (com fix de palavra reservada "window")
025_safety_signals_rls                ← R4
026_safety_signals_webhooks           ← R4
027_safety_signals_seed_rules         ← R4
028_retention_cron_schedule           ← R7
029_post_merge_p0_fixes               ← post-merge
030_enable_rls_audit_billing_partitions ← post-merge
```

## 6. Migrações em PROD

Apenas as de Core (`000–016`) + `017_fix_tenant_self_access`. Migrations 020–030 **não foram aplicadas** em PROD.

A autorização para promover Consent + Safety + Retention para PROD depende do checklist HML→PROD ([`hml-to-prod-release-checklist.md`](./hml-to-prod-release-checklist.md)) e da decisão de produto ([`consent-safety-prod-decision-memo.md`](./consent-safety-prod-decision-memo.md)).

## 7. Edge Functions

- HML: 35/35 ACTIVE (21 pré-existentes + 14 deployadas em R1–R11).
- PROD: subconjunto Core (verificação, JWKS, key-rotation, webhooks-worker, retention-job, applications/policies/issuers/audit/admin endpoints, tenant-bootstrap). Funções de Consent/Safety/Credential/Proof **não deployadas** em PROD.

## 8. Pendências operacionais (não-bloqueantes para o code freeze)

- Configuração de GUCs de retention em PROD (URL, secret, dry-run).
- Configuração do provider OTP real (R5) em PROD.
- Habilitação modular por feature flag por tenant.
- Auditoria criptográfica externa antes de habilitar `credential.real` (R10) e `proof.real` (R11).
- Pentest com escopo cross-tenant + Privacy Guard + webhooks.
- Separação física `agekey-prod` distinta de `agekey-hml`.
- Domínios de produção e DNS finais.

## 9. Referências

- [`hml-to-prod-release-checklist.md`](./hml-to-prod-release-checklist.md).
- [`consent-safety-prod-decision-memo.md`](./consent-safety-prod-decision-memo.md).
- [`../../compliance/ripd-agekey.md`](../../compliance/ripd-agekey.md).
- [`../../compliance/data-retention-policy.md`](../../compliance/data-retention-policy.md).
- [`../audit/agekey-p0-main-reconciliation-report.md`](../audit/agekey-p0-main-reconciliation-report.md).
- Registro consolidado da sessão de produção R1–R11 + post-merge fixes (mantido na branch `agekey/production-readiness-20260429` em `docs/audit/agekey-production-readiness-20260429-session-log.md`).
