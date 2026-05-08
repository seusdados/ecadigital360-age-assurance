# AgeKey HML — Intensive Smoke Test Report

- **Data**: 2026-05-07
- **Agente**: QA Intensivo HML (PR B, draft)
- **Branch**: `claude/qa-hml-intensive-smoke-tests`
- **Base commit**: `bbf9a46` (P0 timeline completo em `main`)
- **Ambiente alvo**: HML Supabase project `wljedzqgprkpqhuazdzv`
- **PROD (NÃO tocado)**: `tpdiccnmsnjtjwhardij` (apenas Core + 017 aplicado)

> **Escopo deste PR**: matriz de smoke + scripts curl com placeholders +
> SQL read-only. **Nenhum** código de produção, **nenhuma** migration,
> **nenhum** segredo, **nenhuma** chamada a PROD. Os scripts são
> executados manualmente pelo time com a `TENANT_API_KEY` de teste.

---

## 1. Confirmação do histórico de migrations em HML

Verificação executada via Supabase MCP `list_migrations` (read-only) no
projeto `wljedzqgprkpqhuazdzv` em 2026-05-07:

| Bloco              | Versões esperadas             | Status |
| ------------------ | ----------------------------- | ------ |
| Core (Round 1+2)   | `000` … `017` (18 versões)    | OK     |
| Skipped (depreciados) | `018`, `019`               | Ausente (esperado) |
| Parental Consent (R3) | `020` … `023` (4 versões)  | OK     |
| Safety Signals (R4)   | `024` … `027` (4 versões)  | OK     |
| Retention Cron        | `028`                       | OK     |
| Post-merge fixes      | `029`                       | OK     |
| RLS audit/billing partitions | `030`                | OK     |

Total: **29 versões aplicadas**. Nenhuma ausência inesperada. Nenhum
`018`/`019` em HML — alinhado com o reconciliation report
(`docs/audit/hml-migration-history-reconciliation-execution-report.md`).

`list_tables` em `public` confirma `rls_enabled = true` em **todas as 65
tabelas/partições** observadas (incluindo `audit_events_*` e
`billing_events_*` particionadas — corolário da migration `030`).

---

## 2. Matriz de testes

### 2.1 Core (`scripts/smoke/core-smoke.sh`)

| #  | Endpoint                              | Método | Resultado esperado                                  | Auto/Manual |
| -- | ------------------------------------- | ------ | --------------------------------------------------- | ----------- |
| 1  | `/applications-list`                  | GET    | 200; só apps do tenant (RLS)                        | Manual      |
| 2  | `/policies-list`                      | GET    | 200; lista contém `age-18-br`, `age-13-br-parental` | Manual      |
| 3  | `/audit-list`                         | GET    | 200; rows recentes do tenant                        | Manual      |
| 4  | `/verifications-session-create`       | POST   | 201; `session_id`, `available_methods[]`            | Manual      |
| 5  | `/verifications-session-get`          | GET    | 200; status público sem PII                         | Manual      |
| 6  | `/verifications-session-complete`     | POST   | 400 (challenge inválido) — contrato                 | Manual      |
| 7  | `/verifications-token-verify`         | POST   | 400 com JWT inválido — contrato                     | Manual      |
| 8  | `/verifications-token-revoke`         | POST   | 404 com jti inexistente — contrato                  | Manual      |
| 9  | `/jwks`                               | GET    | 200; JWK ES256 público                              | **Auto** (smoke público) |
| 10 | `/applications-rotate-key`            | POST   | 400/422 sem `confirm:true` — guard                  | Manual      |

### 2.2 Parental Consent (`scripts/smoke/consent-smoke.sh`)

| #  | Endpoint                                  | Método | Resultado esperado                                            | Auto/Manual |
| -- | ----------------------------------------- | ------ | ------------------------------------------------------------- | ----------- |
| 1  | `/parental-consent-session`               | POST   | 201; `consent_request_id`, `guardian_panel_token`             | Manual      |
| 2  | `/parental-consent-session-get`           | GET    | 200; sem PII                                                  | Manual      |
| 3  | `/parental-consent-text-get`              | GET    | 200; `text_hash` hex                                          | Manual      |
| 4  | `/parental-consent-guardian-start`        | POST   | 200; `contact_masked`; `dev_otp` só em HML                    | Manual      |
| 4b | guardian-start (replay)                   | POST   | 429/400; rate-limit/idempotency                               | Manual      |
| 5  | `/parental-consent-confirm`               | POST   | 200; `decision=approved`; `token.jwt`                         | Manual      |
| 6  | `/parental-consent-token-verify` (válido) | POST   | 200; `valid=true`, `revoked=false`                            | Manual      |
| 7  | `/parental-consent-revoke`                | POST   | 200; status revogado                                          | Manual      |
| 8  | token-verify pós-revoke                   | POST   | 200; `revoked=true`                                           | Manual      |

**Asserções de privacidade obrigatórias** (verificação humana):

- nenhuma resposta contém email/telefone/CPF/RG em texto claro;
- `contact_masked` aplicado;
- JWT decodificado **não** contém `birthdate`, `email`, `phone`, `cpf`,
  nem `child_ref` em claro — apenas hashes;
- `dev_otp` é `null` em PROD (HML pode retornar quando flag dev ON);
- revoke invalida o token (verificável via verify pós-revoke).

### 2.3 Safety Signals (`scripts/smoke/safety-smoke.sh`)

| #     | Endpoint                          | Método | Resultado esperado                              | Auto/Manual |
| ----- | --------------------------------- | ------ | ----------------------------------------------- | ----------- |
| POS-1 | `/safety-event-ingest`            | POST   | 200/201; `content_included=false`               | Manual      |
| POS-2 | `/safety-rule-evaluate`           | POST   | 200; decision envelope                          | Manual      |
| POS-3 | `/safety-rules-write`             | POST   | 200; idempotente                                | Manual      |
| POS-4 | `/safety-alert-dispatch`          | POST   | 200/202; webhook sem PII                        | Manual      |
| POS-5 | `/safety-step-up`                 | POST   | 200; cria sessão step-up                        | Manual      |
| POS-6 | `/safety-aggregates-refresh`      | POST   | 200                                             | Manual      |
| POS-7 | `/safety-retention-cleanup`       | POST   | 200; deletes_count >= 0                         | Manual      |
| NEG-1 | `event-ingest` com `raw_text`     | POST   | **400** + `PRIVACY_CONTENT_NOT_ALLOWED_IN_V1`   | **Auto**    |
| NEG-2 | `event-ingest` com `message`      | POST   | **400**                                         | **Auto**    |
| NEG-3 | `event-ingest` com `image`        | POST   | **400**                                         | **Auto**    |
| NEG-4 | `event-ingest` com `video`        | POST   | **400**                                         | **Auto**    |
| NEG-5 | `event-ingest` com `audio`        | POST   | **400**                                         | **Auto**    |
| NEG-6 | `event-ingest` com `birthdate`    | POST   | **400**                                         | **Auto**    |
| NEG-7 | `event-ingest` com `email`        | POST   | **400**                                         | **Auto**    |
| NEG-8 | `event-ingest` com `phone`        | POST   | **400**                                         | **Auto**    |

> NEG-* são **obrigatórios** e auto-checados pelo script (assert_400).
> Qualquer falha bloqueia release. Ataca a contrapartida das listas
> `CORE_FORBIDDEN_KEYS` + `CONTENT_FORBIDDEN_KEYS` em
> `packages/shared/src/privacy/forbidden-claims.ts`.

### 2.4 RLS / Isolamento (`scripts/smoke/rls-isolation.sql`)

| #  | Verificação                                                      | Resultado esperado |
| -- | ---------------------------------------------------------------- | ------------------ |
| 1  | RLS habilitada em todas as tabelas de `public`                   | 0 linhas com `rls_enabled=false` |
| 2  | Tabelas críticas SEM policies                                    | 0 linhas           |
| 3  | Contagem de policies por tabela crítica                          | >=1 por tabela     |
| 4  | Cross-tenant SELECT (com JWT do outro tenant)                    | 0 linhas           |
| 5  | Partições de `audit_events` / `billing_events` com RLS           | Todas habilitadas  |
| 6  | `crypto_keys` — secret nunca exposto                             | Apenas `private_key_present` boolean |
| 7  | `schema_migrations`                                              | 000–017, 020–030; sem 018/019 |

### 2.5 Feature flags

| Flag                                          | Valor esperado HML | Valor esperado PROD |
| --------------------------------------------- | ------------------ | ------------------- |
| `AGEKEY_PARENTAL_CONSENT_ENABLED`             | `true`             | `false` (até GA)    |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP`      | `true` (HML only)  | **NUNCA `true`**    |
| `AGEKEY_SAFETY_SIGNALS_ENABLED`               | `true`             | `false` (até GA)    |
| `AGEKEY_SAFETY_SIGNALS_AUTO_DISPATCH`         | `true`/`false` à escolha | `false` inicialmente |

Validação em runtime: chamar endpoints com flag OFF deve retornar
**HTTP 403 / `ForbiddenError`** (`AgeKey ... module is disabled`).

---

## 3. Automação vs. Manual

| Categoria                                  | Automatizável agora                | Requer execução manual com TENANT_API_KEY |
| ------------------------------------------ | ---------------------------------- | ---------------------------------------- |
| Privacy guard (NEG-1..8 Safety)            | **Sim** — `safety-smoke.sh` faz assert | —                                        |
| `/jwks` público                            | **Sim**                            | —                                        |
| Lista de migrations (MCP)                  | **Sim** — `list_migrations`        | —                                        |
| RLS habilitada (catálogo)                  | **Sim** — `list_tables` MCP        | —                                        |
| Lifecycle Core/Consent/Safety positivo     | Não (depende de fixtures/idempotência) | Sim (operador roda script)            |
| Cross-tenant SELECT                        | Não (precisa 2º tenant em HML)     | Sim (SQL Editor + dois JWTs)             |
| OTP delivery + parental flow ponta a ponta | Não (depende de canal externo)     | Sim (com `DEV_RETURN_OTP=true`)          |

Recomendação: promover NEG-* a CI assim que existir um `TENANT_API_KEY`
de smoke armazenado em GitHub Actions secrets (escopo restrito, somente
HML). Os demais permanecem como gate manual em `/release`.

---

## 4. Riscos remanescentes

1. **Cobertura PROD = mínima.** PROD só tem 000-017. Qualquer chamada
   pós-Round 3/4 falhará em PROD por ausência de tabelas; flags devem
   permanecer OFF até promoção planejada.
2. **Webhook signing fixtures.** Smoke não valida assinatura HMAC dos
   webhooks de `safety-alert-dispatch` / `parental-consent-*`.
   Recomenda-se um teste de integração futuro com fake receiver.
3. **OTP de teste em HML.** `DEV_RETURN_OTP=true` é necessário para
   smoke, mas precisa estar **explicitamente desligado** em PROD.
   Adicionar item de checklist pré-release.
4. **Cross-tenant via JWT.** Atualmente só validável via SQL Editor com
   `set_config`. Falta cliente automatizado simulando dois tenants.
5. **Rate-limit / idempotência.** Script testa o caminho mas não simula
   carga; recomendado incluir cenário de stress 50 req/s (fora deste PR).
6. **Privacy guard ainda baseado em key-name matching.** Bypass por
   nomes ofuscados (ex.: `m_e_s_s_a_g_e`) é detectado pela normalização
   atual, mas convém auditar a lista de aliases periodicamente.

---

## 5. Recomendação sobre release PROD

Esta entrega é **read-only** e **não** executa nada em PROD. A decisão
de promover Round 3 (Parental Consent) e Round 4 (Safety Signals) para
PROD permanece com o time de Produto/Compliance.

Pré-condições mínimas que recomendamos antes de qualquer promoção PROD
(check humano, fora deste PR):

- [ ] Rodar todos os scripts de `scripts/smoke/` em HML; nenhum FAIL em
      NEG-*; nenhum 5xx em POS-*.
- [ ] Confirmar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=false` em PROD.
- [ ] Confirmar variáveis de Vault/cifragem de contato configuradas em
      PROD (necessário para `parental-consent-guardian-start`).
- [ ] Aplicar migrations 020-030 em PROD em janela definida (out of scope
      para este PR — Agent 2 não executa).
- [ ] Webhook receiver real configurado e validado para alertas de
      safety (se `AGEKEY_SAFETY_SIGNALS_AUTO_DISPATCH=true`).
- [ ] Smoke pós-deploy contra PROD com `TENANT_API_KEY` interno.

Sem essas pré-condições, **não** recomendamos liberar Round 3/4 em PROD.

---

## 6. Arquivos entregues por este PR (5)

- `scripts/smoke/core-smoke.sh`
- `scripts/smoke/consent-smoke.sh`
- `scripts/smoke/safety-smoke.sh`
- `scripts/smoke/rls-isolation.sql`
- `docs/audit/hml-intensive-smoke-test-report.md` (este arquivo)

Garantias respeitadas:

- nenhum segredo em código (apenas placeholders `$BASE_URL`,
  `$TENANT_API_KEY`, `$ANON_KEY`, `$APPLICATION_ID`, `$USER_REF`,
  `$ACTOR_REF_HMAC`, `$CHILD_REF_HMAC` etc.);
- nenhum arquivo em `packages/shared/src/`, `supabase/functions/`,
  `apps/admin/` foi modificado;
- nenhuma execução em PROD; nenhuma migration aplicada;
- typecheck/lint/test continuam válidos (vide §7).

---

## 7. Validação local (gate antes do commit)

| Comando             | Pré-PR (baseline) | Pós-PR (esta entrega) |
| ------------------- | ----------------- | --------------------- |
| `pnpm typecheck`    | 6/6 OK            | 6/6 OK (sem mudança em src) |
| `pnpm lint`         | OK                | OK                    |
| `pnpm test`         | >= 236 passing    | >= 236 passing (sem mudança em src) |

Como este PR adiciona apenas arquivos `*.sh`, `*.sql` e `*.md`, eles
não estão no escopo dos pipelines TypeScript/Vitest e o resultado é
idêntico ao baseline.
