# PROD — Readiness final para release somente do AgeKey Consent

> **Status**: Documento preparatório. **Nada foi executado em PROD.** Aguarda decisão executiva de produto/legal antes de qualquer ação. Safety Signals está **fora deste escopo** e ficará para janela posterior.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij` — **não tocado nesta rodada**.
> Project ref HML: `wljedzqgprkpqhuazdzv` — base do que foi validado.
> Commit `main` no momento desta análise: `7e463bc353d61c6ad1cc57dcfc12071a22dc05e8`.

## 1. Estado atual de `main`

- `7e463bc3` (post-PR #76 merge).
- `pnpm test` **359/359** ✅
- `pnpm typecheck` packages/admin clean ✅ (`apps/website` typecheck quebra é pré-existente, não bloqueante)
- `pnpm -r lint` clean (1 warning a11y pré-existente em `apps/admin`) ✅
- 31 migrations versionadas (`000`–`017` + `020`–`031`).
- 33 Edge Functions versionadas (19 Core + 7 Consent + 7 Safety).

## 2. Estado validado de HML — base de comparação

| Eixo | Estado em HML |
|---|---|
| Core (19 funções) | ✅ Operacional, `verify_jwt: false`, v18-v19 |
| Consent (7 funções) | ✅ **Operacional ponta-a-ponta**, v22-v23, `verify_jwt: false` |
| Safety (7 funções) | ✅ Operacional para metadata-only ingest/evaluate/rules-write + 9 privacy guard negatives; alert/step-up/cron requerem dados/segredos |
| Migrations | 30 entradas em `schema_migrations` (000-017 + 020-030 + 031) |
| Migration 031 | ✅ Aplicada em HML em 2026-05-09 22:29 UTC, version `20260509222948` |
| Convenção `verify_jwt` | 33/33 funções `verify_jwt: false` |
| TENANT_API_KEY rotacionada | ✅ atual hash `5365b30c…` (PR #75) |
| smoke `consent-smoke.sh` | ✅ 8/8 steps |
| Privacy guard | `content_included = false`, `pii_included = false` em todos envelopes |

Referência completa do MVP: `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`.

## 3. Resumo do fluxo Consent aprovado em HML

```
1. POST /parental-consent-session
   → cria parental_consent_requests, gera guardian_panel_token, retorna policy + consent_text
2. GET  /parental-consent-session-get/<id>?token=<panel>
   → status público da request, sem PII
3. GET  /parental-consent-text-get/<id>?token=<panel>
   → texto integral versionado por hash (text_body, text_hash)
4. POST /parental-consent-guardian-start/<id>
   → registra guardian_contacts (cifrado em vault.create_secret),
     gera OTP, dev_otp em ambientes não-PROD apenas
5. POST /parental-consent-confirm/<id>
   → valida OTP, aprova/nega, emite parental_consent_token (ES256/JWS)
6. POST /parental-consent-token-verify
   → valid/revoked, claims minimizadas, decision_envelope
7. POST /parental-consent-revoke/<parental_consent_id>
   → revoga, marca revoked_at, atualiza tokens
8. POST /parental-consent-token-verify (pós-revoke)
   → valid=false, revoked=true, reason_code=TOKEN_REVOKED
```

Garantias provadas em HML:
- Nenhum endpoint público vaza email/telefone/CPF/RG/birthdate em claro.
- `decision_envelope.content_included=false`, `decision_envelope.pii_included=false`.
- JWT minimizado: hashes opacos, sem identidade civil.
- Token revogado é detectado online.
- Cifragem de contato via `vault.create_secret()` (sem GRANT em pgsodium internals).

## 4. Confirmação: Safety Signals está fora do escopo desta rodada

- **Não aplicar** migrations `024_safety_signals_core`, `025_safety_signals_rls`, `026_safety_signals_webhooks`, `027_safety_signals_seed_rules` em PROD.
- **Não deployar** as 7 Edge Functions Safety em PROD.
- **Não habilitar** feature flags Safety em PROD.

Justificativa: Safety v1 é metadata-only por design, mas exige análise legal/produto separada (LGPD: tratamento de relacionamento adulto-menor é base legal sensível). A primeira ativação Safety em PROD precisa de RIPD específico.

## 5. Estado atual de PROD (referência — sem ação nesta rodada)

| Item | Estado em PROD (`tpdiccnmsnjtjwhardij`) |
|---|---|
| Schema | Phase 1 aplicada — Core + migration `017_fix_tenant_self_access` (referência: `docs/audit/prod-phase-1-migration-017-execution-report.md`) |
| Migrations 020-031 | ❌ NÃO aplicadas |
| Edge Functions Consent | ❌ NÃO deployadas |
| Edge Functions Safety | ❌ NÃO deployadas |
| Feature flags Consent | ❌ Desligadas (default: `AGEKEY_PARENTAL_CONSENT_ENABLED` ausente → defensive 503) |
| Backup recente | A confirmar pelo operador antes de qualquer ação (`docs/release/prod-consent-go-no-go-checklist.md` cobre) |

## 6. Migrations necessárias para Consent em PROD

### 6.1. Núcleo Consent — obrigatórias

| Migration | O que faz | Risco |
|---|---|---|
| `020_parental_consent_core.sql` | Tabelas: parental_consent_requests, parental_consents, parental_consent_revocations, parental_consent_tokens, consent_text_versions | Baixo (DDL aditivo) |
| `021_parental_consent_guardian.sql` | Tabelas: guardian_contacts, guardian_verifications. RPC `guardian_contacts_store` (versão original com `INSERT INTO vault.secrets` — **substituída por 031**) | Baixo (DDL aditivo) |
| `022_parental_consent_rls.sql` | RLS policies para tabelas Consent | Baixo (defensivo) |
| `023_parental_consent_webhooks.sql` | Triggers de webhook fan-out para eventos parental_consent.* | Baixo (eventos só disparam quando flag ativa) |
| `031_fix_guardian_contacts_store.sql` | Substitui body de `guardian_contacts_store` para usar `vault.create_secret()`; previne `42501 permission denied for function _crypto_aead_det_noncegen` | Baixo (CREATE OR REPLACE FUNCTION; corrige bug que ocorre em runtime no managed Supabase) |

**Ordem obrigatória**: 020 → 021 → 022 → 023 → 031.

### 6.2. Cross-cutting — análise individual

| Migration | Recomendação | Justificativa |
|---|---|---|
| `024–027` (Safety) | **NÃO aplicar** | Fora do escopo (fica para janela Safety) |
| `028_retention_cron_schedule.sql` | **Defer** (aplicar em janela posterior) | Cron schedule do `retention-job` é genérico mas exige `agekey.cron_secret` GUC + `agekey.retention_job_url` GUC. Operador pode aplicar quando preferir agendar limpeza. Sem ele, o `retention-job` ainda pode ser invocado manualmente. **Não bloqueia** Consent MVP. |
| `029_post_merge_p0_fixes.sql` | ⚠ **NÃO aplicar como está** | A migration contém 3 RPCs: (1) `set_current_tenant` (genérico, OK); (2) `safety_recompute_messages_24h` que **referencia tabelas safety_events/safety_interactions** — vai falhar pois Safety não está aplicado; (3) `build_parental_consent_event_payload` v2 com `payload_hash` real (relevante para Consent). **Trade-off**: aplicar agora exige cherry-pick (criação de migration nova — fora do escopo desta rodada por ordem do operador). Sem ela, o webhook Consent usa `build_parental_consent_event_payload` v1 da migration 023 (sem hash atualizado). **Não bloqueia** funcionalmente — payload é entregue e assinado HMAC por webhook secret; apenas o campo derivado `payload_hash` segue o cálculo v1. |
| `030_enable_rls_audit_billing_partitions.sql` | ✅ **Aplicar** | Habilita RLS em partições `audit_events_*` e `billing_events_*` que já existem em PROD desde o Core. É um **endurecimento defensivo** e independente de Consent/Safety. Risco: baixo (apenas adiciona RLS; SELECT/INSERT continua via service_role) |

### 6.3. Recorte recomendado para esta janela

**Aplicar em PROD**: `020`, `021`, `022`, `023`, `031`, e opcionalmente `030`.

**Não aplicar em PROD**: `024`, `025`, `026`, `027`, `028`, `029`.

Total: 5 migrations obrigatórias + 1 opcional defensiva.

## 7. Dependências de ambiente

### 7.1. Secrets / env vars necessárias em PROD (Supabase Dashboard → Edge Functions)

| Variável | Valor PROD | Por quê |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `true` | Habilita o módulo (default 503 sem isso) |
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | provider real (ex.: `twilio`, `mailgun`, etc.) | **Não usar `noop`** em PROD |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO definir** ou `false` | Ativaria retorno do OTP em cleartext na resposta — **proibido em PROD** |
| `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | URL real do painel parental | ex.: `https://panel.agekey.com.br/parental-consent` |
| Secrets do provider OTP (depende do provider) | configurar | ex.: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | já existem (Core) | reutilizadas |

### 7.2. Provider OTP — bloqueador real

A documentação do AgeKey Consent **exige** um provider real de OTP em PROD (email/SMS). Atualmente o código tem provider `noop` (default) e `email_console_log` (debug). Antes do release Consent em PROD, decidir e configurar:

- Email provider (ex.: `mailgun`, `sendgrid`, `ses`).
- SMS provider (ex.: `twilio`, `zenvia`, `sinch`).
- Implementação se ainda não houver: o registry em `supabase/functions/_shared/parental-consent/otp-providers/index.ts` é a porta de entrada.

**Sem provider real configurado, o módulo Consent não pode ir para PROD**, mesmo com migrations aplicadas — o `deliverOtp` lançará erro intencional (linha 61-65 de `_shared/parental-consent/otp.ts`) para evitar drop silencioso.

## 8. Feature flags necessárias

| Flag | Estado em PROD na ativação |
|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `true` (controla 7 funções Consent) |
| `AGEKEY_SAFETY_ENABLED` | **NÃO setar / `false`** (Safety fica fora) |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO setar** (proibido em PROD) |

A flag `AGEKEY_PARENTAL_CONSENT_ENABLED` deve ser ligada **depois** de:
1. Migrations aplicadas.
2. Edge Functions Consent deployadas.
3. Provider OTP configurado.
4. Smoke pré-ativação OK (com flag ainda OFF? — ver runbook).

Atualmente, com flag OFF, todas as 7 funções respondem `503 ServiceUnavailableError` por design (`featureDisabledResponse` em `_shared/parental-consent/feature-flags.ts:63`).

## 9. Riscos

### 9.1. Bloqueadores (resolver antes do go-live)

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Provider OTP real não configurado | **Crítica** | Configurar antes de habilitar a flag |
| R2 | RIPD/análise legal de Consent não fechada | **Alta** | Decisão de produto/legal antes do go-live |
| R3 | Backup recente PROD não confirmado | Alta | Operador confirma snapshot Supabase antes de migrations |
| R4 | Tenant API key real PROD ainda não emitida (clientes piloto) | Média | Plano de emissão das primeiras keys via `applications-write` ou bootstrap |

### 9.2. Operacionais (mitigáveis na própria janela)

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R5 | Migration 029 (cross-cutting) — webhook payload sem `payload_hash` v2 | Baixa | Documentar que webhook payload usa v1 enquanto Safety não está em PROD; aplicar 029 (ou cherry-pick) na mesma janela do Safety futuro |
| R6 | Cron retention não agendado (migration 028 deferida) | Baixa | Invocar `retention-job` manualmente quando necessário até janela 028 |
| R7 | Workflow GHA `Deploy HML Edge Functions` apontaria para PROD se mal usado | Crítica (mas mitigada por hardcode) | Workflow tem project_ref hardcoded `wljedzqgprkpqhuazdzv` + guard defensivo. **PR separado deve criar workflow distinto para PROD** quando autorizado |
| R8 | Convenção `--no-verify-jwt` precisa ser respeitada em PROD | Alta | Se usar workflow, replicar o padrão; se CLI manual, todo `supabase functions deploy` deve ter o flag |
| R9 | Smoke pós-release pode revelar diferenças de ambiente PROD vs HML (rate limit, timeouts, network) | Média | Smoke faseado: primeiro com flag ON em janela controlada antes de tráfego real |

### 9.3. Latentes (monitorar em produção)

| # | Risco | Mitigação |
|---|---|---|
| R10 | Provider OTP de produção pode falhar (delivery rate) | Monitorar `delivered=false` em audit_events |
| R11 | Vault encryption performance em alto volume | Monitorar latência de `guardian-start` |
| R12 | Webhook fan-out backpressure | Monitorar `webhooks-worker` execution time |

## 10. Rollback

### 10.1. Rollback **rápido** (sem reverter migrations) — recomendado

1. **Desativar feature flag**: setar `AGEKEY_PARENTAL_CONSENT_ENABLED=false` no Supabase Dashboard.
2. Aguardar reciclagem de workers (~30s).
3. As 7 funções voltam a responder `503` por design — comportamento "feature off".
4. Tráfego de Consent é interrompido sem perda de dados em DB; consents já criados ficam preservados.

**Tempo de rollback**: < 2 minutos.

### 10.2. Rollback **agressivo** (reverter funções)

- Re-deployar versões anteriores das funções via Supabase CLI ou admin UI (Edge Functions → Deploy old version).
- Útil se houver bug em código deployado, não relacionado a flag.

### 10.3. Rollback de migrations — **NÃO automático**

Migrations 020-023 + 031 fazem `CREATE TABLE`, `CREATE INDEX`, `CREATE OR REPLACE FUNCTION`. Reverter exige:
- `DROP TABLE` cascata — perde dados de consent que já podem ter sido criados.
- Análise caso-a-caso.

**Regra**: rollback de migration **só após** análise pelo operador. Não há script de rollback automatizado.

## 11. Smoke tests pós-release em PROD

### 11.1. Pré-ativação (com flag OFF)

- Chamar `/parental-consent-session` com tenant API key piloto: esperado `503 ServiceUnavailableError` com `reason_code: SYSTEM_INVALID_REQUEST`.
- Confirma que módulo está plumbed mas não ativado.

### 11.2. Pós-ativação (flag ON)

Mesmo `consent-smoke.sh` validado em HML, adaptado para PROD:

```bash
export BASE_URL=https://tpdiccnmsnjtjwhardij.functions.supabase.co
export TENANT_API_KEY=<chave de PROD do tenant piloto>
export APPLICATION_SLUG=<slug do tenant piloto>
export POLICY_SLUG=<policy de PROD compatível>
export CHILD_REF_HMAC=$(printf 'smoke-prod-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="<contato real do operador para receber OTP em PROD>"

bash scripts/smoke/consent-smoke.sh
```

**Diferenças críticas PROD vs HML**:
- `dev_otp` **não vai aparecer** (env var DEV_RETURN_OTP **não setada** em PROD). O operador deve receber o OTP **realmente** no contato configurado (email/SMS).
- O contato de teste DEVE ser do operador, **não** dado fictício — pois o OTP é entregue via provider real.
- Após confirmar com o OTP recebido, **revogar imediatamente** o token gerado para não deixar consent ativo de teste.

### 11.3. Checagens manuais obrigatórias

- Body de respostas: zero PII (email/telefone/CPF/RG/name/birthdate em claro).
- `contact_masked` aplicado.
- JWT decodificado: zero claims sensíveis.
- `decision_envelope.content_included=false`, `pii_included=false` em todas as respostas.
- `audit_events` na partição corrente cresceu em proporção às operações.
- Logs Edge Function sem stack trace inesperado.

## 12. Critérios de **go/no-go**

### 12.1. Go (todos verdes)

| Critério | Como verificar |
|---|---|
| ✅ HML validada ponta-a-ponta | `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` |
| ✅ main em commit auditável | `7e463bc3` ou descendente |
| ✅ `pnpm test` 359/359 verde | CI dos PRs recentes |
| ✅ Provider OTP real configurado em PROD | Operador confirma env vars no Dashboard |
| ✅ Decisão legal/produto formalizada | Memo `docs/release/prod-consent-legal-product-decision-memo.md` assinado |
| ✅ Backup PROD recente confirmado | Operador no Dashboard Supabase → Database → Backups |
| ✅ Janela de manutenção definida | Comunicação com clientes piloto |
| ✅ Operador responsável definido | Pessoa nomeada para a janela |
| ✅ Plano de rollback compreendido | Operador conhece §10 |
| ✅ Workflow PROD ou CLI plan validado | Não usar workflow HML (hardcoded) |

### 12.2. No-go (qualquer um vermelho)

| Bloqueador | Ação |
|---|---|
| ❌ Provider OTP não real | Não há como cumprir o fluxo; aborta |
| ❌ Decisão legal não fechada | Não inicia a janela |
| ❌ Backup não confirmado | Não inicia a janela |
| ❌ HML smokes regridem antes da janela | Investigar antes de PROD |

## 13. Decisão pendente do usuário

**Esta documentação não autoriza ação em PROD.** A decisão pendente é:

1. **Aprovar plano** (este documento + runbook + checklist + memo legal) ou solicitar ajustes.
2. **Confirmar provider OTP** real e habilitação de secrets.
3. **Definir janela** de release.
4. **Designar operador** responsável.
5. **Fechar memo legal/produto** (RIPD, base legal, comunicação a tenant piloto).

Após esses 5 itens, abrir nova rodada de execução com autorização explícita.

## 14. Referências e documentos relacionados

| Documento | Conteúdo |
|---|---|
| `docs/release/prod-consent-release-runbook.md` | Passo a passo operacional (Fase 0-5) |
| `docs/release/prod-consent-go-no-go-checklist.md` | Checklist detalhado |
| `docs/release/prod-consent-legal-product-decision-memo.md` | Memo executivo de decisão |
| `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` | Validação HML completa |
| `docs/audit/prod-phase-1-migration-017-execution-report.md` | Estado atual PROD (Phase 1) |
| `docs/audit/prod-migration-application-plan.md` | Planejamento original cross-fase |
| `docs/audit/prod-rollback-playbook-consent-safety.md` | Playbook de rollback (sucessor desta análise) |

## 15. Confirmações de não-ação (esta rodada)

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`.
- ❌ Nenhum `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Nenhuma migration aplicada em PROD.
- ❌ Nenhum SQL em PROD.
- ❌ Nenhum deploy em PROD.
- ❌ Nenhuma alteração de feature flags remotas.
- ❌ Nenhuma alteração em Vercel.
- ❌ Nenhuma alteração em Supabase PROD.
- ❌ Nenhuma alteração de schema, migrations, RLS, dados ou flags em qualquer ambiente.
- ❌ Nenhuma migration nova criada.
- ❌ Nenhum código runtime alterado.
- ❌ Nenhuma raw TENANT_API_KEY solicitada ou registrada.
- ✅ Apenas: 4 documentos novos em `docs/`.
