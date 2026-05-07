# AgeKey — Relatório de divergência P0 vs main

> Branch de reconciliação: `claude/reconcile-p0-main-agekey` (a ser criada).
> Data: 2026-05-07.
> Tipo: **diagnóstico** — nenhuma alteração foi feita ainda.

## 1. Sumário da divergência

A repository `seusdados/ecadigital360-age-assurance` evoluiu em **duas
timelines paralelas** desde o commit `3c4a4c7` (ancestral comum, anterior
às Rodadas 3 e 4):

- **P0** (`claude/agekey-p0-post-merge-fixes`, HEAD `a9f425f`) — timeline
  efetivamente deployada em homologação. Construiu R3 + R4 + R5 + R6 + R7
  + R8 + R9 + R10 + R11 e fixes pós-merge.
- **main** (`origin/main`, HEAD `9d9f187`) — timeline desta sessão de
  Claude Code. Construiu Core canônico (PR #48), DecisionEnvelope runtime
  (PR #50), Round 3 / Consent (PR #51) e Round 4 / Safety (PR #52) com
  versões alternativas e mais antigas dos mesmos módulos.

**Tamanho da divergência:**

| Métrica | Valor |
|---|---|
| Ancestral comum | `3c4a4c7` |
| Commits exclusivos de P0 | 13 |
| Commits exclusivos de main | 18 |
| Arquivos divergentes | 312 |
| Linhas inseridas (P0 → main) | 23.157 |
| Linhas removidas (P0 → main) | 20.753 |

## 2. Commits exclusivos de P0 (não em main)

| Commit | Mensagem |
|---|---|
| `a9f425f` | fix(consent): destructure policy_version_id (was incorrectly typed versionId) |
| `7c543d8` | chore(p0): post-merge fixes — types regen + migrations 029/030 |
| `790a066` | test(cross-tenant): infra + suítes RLS isolation (R8) (#44) |
| `332a7d0` | feat(proof): honest stub ZKP/BBS+ mode (R11) (#41) |
| `31d7969` | feat(credential): honest stub SD-JWT VC mode (R10) (#40) |
| `b96c8b4` | feat(safety): UI + Edge Function para override de regras (R9) (#42) |
| `0b8c6ed` | feat(retention): cron unificado de retenção (R7) (#43) |
| `90796d1` | feat(consent): endpoint público de texto integral do painel parental (R6) (#38) |
| `121caa7` | feat(consent): provider real de OTP via relay HTTPS (R5) (#39) |
| `7acac09` | feat(safety): AgeKey Safety Signals MVP metadata-only (R4) (#37) |
| `f40349a` | feat(consent): AgeKey Consent MVP — parental consent auditável (R3) (#36) |
| `00d69db` | feat(shared): introduzir camada canônica modular para Core/Consent/Safety (#34) |
| `53875b3` | docs: add AgeKey production readiness pack |

## 3. Commits exclusivos de main (não em P0)

| Commit | Mensagem |
|---|---|
| `9d9f187` | feat(safety): AgeKey Safety Signals metadata-only MVP (Round 4) (#52) |
| `9052bb0` | feat(consent): AgeKey Parental Consent MVP (Round 3) (#51) |
| `a86d495` | feat(core): drive verifications-session-complete from canonical Decision Envelope (#50) |
| `687fe01` | feat(shared): canonical Core contracts (envelope, taxonomy, webhooks, retention, policy) (#48) |
| `f38c24b` | fix(rls): tenant_users/tenants self-access policies (017) (#46) |
| `3e1aa5d` | chore(functions): drop deprecated `--import-map` flag from deploy scripts (#33) |
| `fda22a8` | fix(functions): import_map.json para o empacotador remoto resolver `zod` (#32) |
| `368e796` | chore(infra): map real Supabase projects (prod + hml) + provision hml schema (#31) |
| `0c5afc7` | feat(faq): public /faq page with search, filters and JSON-LD (#30) |
| `84212fd` | docs(infra): Vercel env vars audit matrix + script (AK-P0-07) (#21) |
| ... | (mais 8 commits de chores e infra) |

## 4. PRs representados em cada timeline

| Round / feature | P0 | main |
|---|---|---|
| R3 — Parental Consent MVP | PR #36 ✅ | PR #51 ✅ (versão alternativa) |
| R4 — Safety Signals MVP | PR #37 ✅ | PR #52 ✅ (versão alternativa) |
| R5 — OTP real (HTTPS relay) | PR #39 ✅ | ❌ |
| R6 — Endpoint público de texto de consentimento | PR #38 ✅ | ❌ |
| R7 — Cron unificado de retenção | PR #43 ✅ | ❌ |
| R8 — Suítes RLS cross-tenant | PR #44 ✅ | ❌ |
| R9 — UI + override de regras Safety | PR #42 ✅ | ❌ |
| R10 — SD-JWT VC stub honesto | PR #40 ✅ | ❌ |
| R11 — ZKP/BBS+ stub honesto | PR #41 ✅ | ❌ |
| Core canonical contracts | implícito em #34 | PR #48 ✅ (versão alternativa) |
| DecisionEnvelope runtime | implícito em #34 | PR #50 ✅ (versão alternativa) |
| 017 fix tenant self-access | ❌ | PR #46 ✅ |
| Mapeamento Supabase projetos | ❌ | PR #31 ✅ |
| FAQ público | (rota existe — origem incerta) | PR #30 ✅ |
| import_map / deploy fixes | ❌ | PRs #32 e #33 ✅ |

## 5. Módulos presentes em cada timeline

### P0

- DecisionEnvelope canônico (`packages/shared/src/decision/`)
- Privacy Guard (`packages/shared/src/privacy-guard.ts` + `privacy/`)
- Reason Codes (`packages/shared/src/reason-codes.ts` + `taxonomy/`)
- Webhook Signer + Types (`packages/shared/src/webhooks/`)
- Retention Classes (`packages/shared/src/retention/`)
- Policy Engine (`packages/shared/src/policy/`)
- Age Taxonomy (`packages/shared/src/taxonomy/age-taxonomy.ts`)
- **Parental Consent** (`packages/shared/src/parental-consent/` + 7 edge functions)
- **Safety Signals** (`packages/shared/src/safety/` + 6 edge functions)
- **Credential mode** (SD-JWT VC stub, `packages/shared/src/credential/`)
- **Proof mode** (ZKP/BBS+ stub, `packages/shared/src/proof/`)
- **OTP providers pluggable** (`supabase/functions/_shared/parental-consent/otp-providers/`)
- **Retention cron unificado** (`supabase/functions/safety-retention-cleanup/` consolidado)
- **integration-tests** com suítes RLS cross-tenant
- 28 migrations sequenciais (000–016 + 020–030)
- Database types regenerados (3.701 linhas)
- 5 audit reports + ~30 docs de specs/módulos

### main

- DecisionEnvelope canônico (versão alternativa)
- Privacy Guard (estrutura levemente diferente)
- Reason Codes (no formato canônico, sem split root/taxonomy)
- Webhook Signer + Types **com test files**
- Retention Classes **com test file**
- Policy Engine **com test file**
- Age Taxonomy **com test file**
- **Consent (alternativo)** — `packages/shared/src/consent/` (NÃO `parental-consent`); contratos `external_user_ref` raw, taxonomia mais granular; 6 edge functions com nomes diferentes (`parental-consent-session-create`, etc.)
- **Safety (alternativo)** — `packages/shared/src/safety/`; 22 event types vs 8 do P0; reason codes diferentes
- **Sem credential / proof modules**
- **Sem OTP provider real**
- **Sem cron unificado de retenção**
- **Sem integration-tests com RLS suite** (apenas `_tests/` com testes Deno)
- **Sem UI/edge function de override de regras**
- 20 migrations sequenciais (000–019)
- Database types **stub** (66 linhas — placeholder esperando regen)
- 5 audit reports (3 desta sessão) + 22 docs ricos de módulo (sob `docs/modules/{parental-consent,safety-signals}/`)
- `agekey-core-canonical-contracts.md` (spec consolidada que P0 não tem)
- Migration `017_fix_tenant_self_access.sql` (P0 não tem)

## 6. Riscos de manter as duas timelines paralelas

| # | Risco | Severidade |
|---|---|---|
| 1 | Documentação canônica em `main` não bate com o produto rodando em HML/PROD. Auditor não consegue conciliar. | Alta |
| 2 | Time pode tentar deployar `main` e quebrar HML (schemas incompatíveis em `parental_consent_requests`, `safety_events`, etc.). | Crítica |
| 3 | Integradores recebem dois contratos diferentes para os mesmos endpoints. | Alta |
| 4 | Reason codes e webhook event types diferentes entre as duas timelines confundem dashboards e SIEM. | Média |
| 5 | Migrations sequenciais 018/019 em main duplicam 020–028 do P0 — `supabase db push` em main quebra. | Crítica |
| 6 | Trabalho dobrado em qualquer rodada futura — qual timeline recebe a Rodada 12? | Média |
| 7 | Bugs encontrados em uma timeline não chegam à outra (ex.: o fix `policy_version_id` foi feito apenas em P0). | Média |

## 7. Recomendação técnica

**Adotar P0 como source of truth técnico** e fazer `main` absorver P0
seletivamente. Justificativa:

1. **P0 está rodando em HML** com schemas, migrations e secrets aplicados.
   Forçar `main` em HML exigiria DROP destrutivo (proibido por
   `infrastructure/environments.md` sem aprovação).
2. **P0 é mais maduro** — entrega R3 a R11, enquanto `main` cobre
   apenas R3 e R4 com versões alternativas mais antigas.
3. **Algumas escolhas de P0 são privacy-preservadas** (cliente
   pré-computa HMAC; sem `external_user_ref` raw cruzando boundary).
4. **Bug crítico já foi corrigido em P0** (`a9f425f` — desestruturação
   de `policy_version_id`). `main` não tem esse fix porque o handler
   correspondente nem existe lá com aquele nome.

**Itens a portar de `main` para `P0` (cherry-picks seletivos):**

- Migration `017_fix_tenant_self_access.sql` (PR #46) — P0 não tem.
- 7 arquivos de teste vitest existentes só em `main`:
  - `decision/decision-envelope.test.ts`
  - `policy/policy-engine.test.ts`
  - `retention/retention-classes.test.ts`
  - `webhooks/webhook-signer.test.ts`
  - `webhooks/webhook-types.test.ts`
  - `taxonomy/age-taxonomy.test.ts`
  - `taxonomy/reason-codes.test.ts`
  - Eventual adaptação a depender da estrutura real dos módulos em P0.
- Documentação rica de módulos: 22 arquivos em
  `docs/modules/{parental-consent,safety-signals}/` que descrevem
  arquitetura, security, privacy-by-design, audit-evidence, ux-copy,
  backlog. Esses podem complementar (não substituir) os READMEs de P0.
- Spec consolidada `docs/specs/agekey-core-canonical-contracts.md`.
- Audit reports históricos das PRs #51 e #52, preservados como
  registro do trabalho desta sessão (mesmo sendo timeline alternativa).

**Itens descartados de `main` (ficam só no histórico do git):**

- `packages/shared/src/consent/` (8 arquivos — versão alternativa,
  P0 usa `parental-consent/`).
- `packages/shared/src/safety/` (versão alternativa do main, P0 tem
  `safety/` com estrutura diferente; mantém-se a do P0).
- `supabase/functions/parental-consent-session-create/` (P0 usa
  `parental-consent-session/`).
- `supabase/migrations/018_parental_consent.sql` (substituído por 020–023).
- `supabase/migrations/019_safety_signals.sql` (substituído por 024–027).
- Edge functions Deno em `supabase/functions/_tests/` que testam o
  schema alternativo de `main` — não compatíveis com schema P0.

## 8. Comparação por área (25 áreas)

Classificação:
- `P0` — P0 é superior, manter P0
- `MAIN` — main é superior, portar de main para P0
- `EQUIV` — equivalente, manter P0 (não muda nada)
- `MERGE` — precisa porte parcial (lado a lado)
- `DISCARD` — main tem versão obsoleta, descartar

| # | Área | Veredito | Recomendação |
|---|---|---|---|
| 1 | shared core (`index.ts`, `errors.ts`, `types.ts`) | `P0` | Manter P0; structure modular já bem mapeada. |
| 2 | DecisionEnvelope | `MERGE` | Manter `decision-envelope.ts` de P0; **portar** test file de main; manter `legacy-mapper.ts` de P0 (compat). |
| 3 | Privacy Guard | `P0` | Manter estrutura de P0 (split root + privacy/). |
| 4 | Reason Codes | `P0` | Manter split de P0 (root `reason-codes.ts` + `taxonomy/reason-codes.ts`). |
| 5 | Age Taxonomy | `P0` | **Portar** test file de main; manter código de P0. |
| 6 | Webhook Signer + Types | `P0` | **Portar** 2 test files de main; manter código de P0. |
| 7 | Retention Classes | `P0` | **Portar** test file de main; manter código de P0. |
| 8 | Policy Engine | `P0` | **Portar** test file de main; manter código de P0. |
| 9 | Consent module | `P0` | Descartar `consent/` de main; manter `parental-consent/` de P0. |
| 10 | Safety module | `P0` | Descartar versão alternativa de main; manter P0. |
| 11 | OTP providers | `P0` | Manter P0 (provider extensível). |
| 12 | Endpoint texto consentimento | `P0` | Manter P0 (`parental-consent-text-get/` existe). |
| 13 | Retention cron | `P0` | Manter P0 (consolidado). |
| 14 | RLS tests | `P0` | Manter P0 (`packages/integration-tests/` + `_tests/`). |
| 15 | UI / rule override | `P0` | Manter P0 (`safety-rules-write/` + admin pages). |
| 16 | SD-JWT VC stub | `P0` | Manter P0 (extensibility placeholder). |
| 17 | ZKP/BBS+ stub | `P0` | Manter P0 (extensibility placeholder). |
| 18 | Migrations | `P0` | **Portar** `017_fix_tenant_self_access.sql` de main; descartar 018/019 de main; manter 020–030 de P0. |
| 19 | Database types | `P0` | Manter P0 (3.701 linhas — full schema). main tem stub apenas. |
| 20 | docs/audit | `MERGE` | Manter audits de P0; **portar** os 5 audits de main como histórico (incluindo os 3 desta sessão). |
| 21 | docs/specs | `MERGE` | Manter os 13 specs granulares de P0; **portar** `agekey-core-canonical-contracts.md` de main como spec consolidada. |
| 22 | docs/modules | `MERGE` | Manter READMEs/integration-guides de P0; **portar** os 22 docs ricos de main (api, architecture, audit-evidence, backlog, data-model, prd, privacy-by-design, security, ux-copy, frontend-spec, taxonomy, etc.). |
| 23 | Edge functions | `P0` | Manter conjunto P0 (inclui `parental-consent-text-get`, `safety-rules-write`). |
| 24 | SDK / widget | `P0` | Manter P0 (safety SDK simplificado, `child_ref_hmac` pré-computado). |
| 25 | Admin UI | `P0` | Manter P0 (mantém safety/rules + FAQ; main tem alternativos descartáveis). |

**Distribuição final:** `P0` = 19 áreas; `MERGE` = 6 áreas; `MAIN` = 0; `EQUIV` = 0; `DISCARD` = 0.

Em todas as 6 áreas `MERGE`, o porte de main é **aditivo** (testes ou
documentação) — não substitui código de P0. Não há área onde `main`
substitua P0 ou onde os dois lados precisem ser fundidos linha a linha.

## 9. Próximo passo

Esta sessão de reconciliação procederá a:

1. Criar branch `claude/reconcile-p0-main-agekey` a partir de P0 (HEAD `a9f425f`).
2. Aplicar os ports de área `MERGE` da tabela acima — sem tocar em
   código de P0, apenas adicionando tests, docs e a migration `017`.
3. Rodar `pnpm typecheck && pnpm lint && pnpm test` em ambas as
   pontas (antes / depois).
4. Documentar o resultado em
   `docs/audit/agekey-p0-main-reconciliation-report.md`.
5. Abrir PR draft `Reconcile AgeKey P0 timeline with main`.

Nenhuma alteração é feita neste diagnóstico — apenas a análise.

## 10. Confirmações de princípios

Esta análise NÃO recomenda:
- ❌ Reativar versão alternativa de Consent (R3 do main) que armazena
  `external_user_ref` raw na borda.
- ❌ Reativar versão alternativa de Safety (R4 do main) com 22 event
  types em vez do catálogo enxuto de 8 do P0.
- ❌ Aplicar migrations 018 e 019 de main, que conflitam com 020–028
  de P0 e quebrariam o banco de HML.
- ❌ Forçar redeploy de `main` em HML/PROD (operação destrutiva,
  proibida sem aprovação documentada).

Esta análise PRESERVA:
- ✅ Princípio de não armazenar PII pública.
- ✅ Princípio de não duplicar Privacy Guard / DecisionEnvelope /
  Webhook Signer / Reason Codes / Retention Classes.
- ✅ Princípio de não emitir SD-JWT VC ou ZKP/BBS+ como produção
  (P0 tem stubs honestos behind feature flag).
- ✅ Princípio de Safety v1 metadata-only.
- ✅ Princípio de não quebrar build, lint, vitest, deno test.
