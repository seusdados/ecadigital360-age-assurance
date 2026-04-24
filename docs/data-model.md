# AgeKey — Modelo de Dados (Fase 1)

Este documento descreve a camada de persistência completa do AgeKey: tabelas, correlações, RLS, particionamento, reason codes. É a especificação viva que rege as migrations `000_bootstrap.sql` → `009_triggers.sql` e os seeds em `supabase/seed/`.

**Instância-alvo (staging/dev):** `tpdiccnmsnjtjwhardij.supabase.co` (organização Supabase "eca digital").

**Princípios não-negociáveis:**
- Nenhuma coluna persiste data de nascimento, documento bruto ou identidade civil.
- Toda tabela de negócio tem `tenant_id` + RLS obrigatório.
- Tabelas de evidência (`verification_results`, `audit_events`, `billing_events`, `revocations`, `policy_versions`) são append-only via trigger.
- Chaves primárias UUID v7 (time-ordered) via função `uuid_generate_v7()`.
- Soft delete apenas em tabelas de configuração (tenants, applications, policies, issuers, webhook_endpoints).

---

## 1. Diagrama ER (resumido)

```
                     auth.users
                          │ N
                          ▼
┌──────────────┐ 1   N ┌──────────────┐ 1   N ┌──────────────┐
│   tenants    │──────▶│ tenant_users │──────▶│ applications │
└──────────────┘       └──────────────┘       └──────┬───────┘
       │ 1                                           │ 1
       │ N                                           │ N
       ▼                                             ▼
┌──────────────┐  1   N ┌────────────────┐    ┌───────────────────────┐
│   policies   │────────▶│ policy_versions│    │ verification_sessions │
└──────┬───────┘         └────────────────┘    └──────┬───────┬────────┘
       │                                              │       │
       │          ┌───────────────────────┐           │ 1   1 │ 1
       │          │ verification_challenges◀─────────┘       │
       │          └───────────────────────┘                   │
       │                                                     ▼ 1
       │                                            ┌────────────────┐
       │                                            │  proof_artifacts│ N
       │                                            └──────┬─────────┘
       │                                                   │
       │                                              1    ▼ 1
       │                                            ┌───────────────────────┐
       │                                            │ verification_results  │
       │                                            └──────────┬────────────┘
       │                                                       │ 1
       │                                                       ▼ 1
       │                                                 ┌──────────────┐
       │                                                 │ result_tokens│
       │                                                 └──────┬───────┘
       ▼                                                        │ 1
┌──────────────┐                                                │ N
│jurisdictions │                                                ▼
└──────────────┘                                        ┌──────────────┐
                                                        │ revocations  │
                                                        └──────────────┘

┌──────────────┐  N   N  ┌──────────────┐ 1   N  ┌─────────────────────┐
│   issuers    │◀───────▶│ trust_lists  │        │ issuer_revocations  │
└──────┬───────┘         └──────────────┘        └─────────────────────┘
       │ (global + per-tenant overrides)
       ▼
┌──────────────┐
│ crypto_keys  │ (global; geridas pelo key-rotation cron)
└──────────────┘

┌────────────────────┐ 1    N ┌────────────────────┐
│ webhook_endpoints  │────────▶│ webhook_deliveries │ (PARTITION BY status)
└────────────────────┘        └────────────────────┘

┌─────────────┐           ┌──────────────┐            ┌────────────────┐
│audit_events │           │billing_events│            │ usage_counters │
│(PART month) │           │(PART month)  │            │(agregado)      │
└─────────────┘           └──────────────┘            └────────────────┘

┌──────────────────────┐                ┌──────────────┐
│ rate_limit_buckets   │                │ ip_reputation│
└──────────────────────┘                └──────────────┘
```

---

## 2. Catálogo de tabelas

### 2.1 Núcleo tenancy

| Tabela | Descrição | Soft delete | RLS |
|---|---|---|---|
| `tenants` | Raiz da hierarquia multi-tenant. | Sim (`deleted_at`) | `id = current_tenant_id()` |
| `tenant_users` | Papel de cada usuário no tenant. | Não | `tenant_id = current_tenant_id()` |
| `applications` | Apps clientes com api_key e webhook. | Sim | `tenant_id = current_tenant_id()` |

### 2.2 Políticas e jurisdições

| Tabela | Descrição | Soft delete | Imutável |
|---|---|---|---|
| `jurisdictions` | Dicionário ISO 3166 + blocos (EU). | Não | — |
| `policies` | Regras de elegibilidade por tenant. Templates globais com `tenant_id = NULL`. | Sim | — |
| `policy_versions` | Snapshot imutável por versão. | Não | Sim (trigger) |

### 2.3 Verificação (núcleo transacional)

| Tabela | Descrição | Imutável |
|---|---|---|
| `verification_sessions` | Sessão criada pelo SDK. | Não (estado evolui) |
| `verification_challenges` | Nonce anti-replay por sessão. | Parcial (consumed_at) |
| `proof_artifacts` | Hash + path no Storage. | Não |
| `verification_results` | Decisão final (approved/denied). | Sim (trigger) |
| `result_tokens` | JTIs emitidos; suporta revogação. | Quase (só revogação) |

### 2.4 Confiança

| Tabela | Descrição | Escopo |
|---|---|---|
| `issuers` | Emissores confiáveis. `tenant_id` NULL = global. | Global + per-tenant |
| `trust_lists` | Overrides de confiança por tenant. | Per-tenant |
| `issuer_revocations` | Cache de revogações publicadas pelo issuer. | Global |
| `revocations` | Revogações internas (tokens/artefatos). Append-only. | Per-tenant |
| `crypto_keys` | Chaves de assinatura AgeKey (ES256). Service_role apenas. | Global |

### 2.5 Webhooks

| Tabela | Descrição | Particionamento |
|---|---|---|
| `webhook_endpoints` | URL + secret + eventos subscritos. | — |
| `webhook_deliveries` | Fila de entregas com retry. | `LIST (status)` |

### 2.6 Auditoria e billing

| Tabela | Descrição | Particionamento | Imutável |
|---|---|---|---|
| `audit_events` | Log de mudanças em tabelas sensíveis. | `RANGE (created_at)` mensal | Sim |
| `billing_events` | Uma linha por verificação processada. | `RANGE (created_at)` mensal | Sim |
| `usage_counters` | Agregado diário (tenant, app, day). | — | Não (upsert) |

### 2.7 Segurança

| Tabela | Descrição |
|---|---|
| `rate_limit_buckets` | Token bucket por api_key + rota. |
| `ip_reputation` | Cache de risk score por IP (TTL 1h). |

---

## 3. Campos sensíveis e minimização

| Campo | Armazenamento | Racional |
|---|---|---|
| `applications.api_key_hash` | SHA-256(raw) | Raw key exibida 1x na criação; nunca persistida. |
| `applications.webhook_secret_hash` | SHA-256(raw) | Idem. |
| `webhook_endpoints.secret_hash` | SHA-256(raw) | Idem. |
| `proof_artifacts.artifact_hash` | SHA-256(bytes) | Integridade; blob raw fica em Storage com RLS. |
| `crypto_keys.private_key_enc` | Cifrado (Supabase Vault) | Exposto apenas ao Edge Function signing via service_role. |
| Data de nascimento | **AUSENTE** | Princípio de minimização. |
| Documento civil | **AUSENTE** | Idem. |
| Nome completo | **AUSENTE** | Idem. |

---

## 4. RLS (resumo)

Todas as tabelas de negócio têm `ENABLE ROW LEVEL SECURITY`. Duas funções helper:

- `current_tenant_id()` — lê de `SET LOCAL app.current_tenant_id` (setado pelo middleware das Edge Functions a partir do JWT).
- `has_role(required)` — verifica o papel do usuário no tenant corrente. Hierarquia: `owner > admin > operator > auditor > billing`.

Políticas tipo "apenas service_role" são implementadas por `FOR ... WITH CHECK (false)` — qualquer INSERT/UPDATE via JWT de usuário é bloqueado, mas o service_role bypassa RLS.

Testes de isolamento cross-tenant ficam em `packages/shared/__tests__/rls.test.ts` e rodam via `pnpm test:rls`.

---

## 5. Particionamento

### 5.1 audit_events, billing_events

- `PARTITION BY RANGE (created_at)`, uma partição por mês.
- `pg_partman` gerencia manutenção via cron diário (`partman-maintenance`).
- Partições iniciais criadas manualmente em `006_audit_billing.sql` para bootstrap (abril–junho 2026).
- Retention job (a implementar em Fase 2) faz `DETACH PARTITION` de partições antigas conforme `tenant.retention_days`.

### 5.2 webhook_deliveries

- `PARTITION BY LIST (status)` com 4 partições (pending, delivered, failed, dead_letter).
- Worker lê apenas de `webhook_deliveries_pending` (hot path pequeno).

---

## 6. Catálogo de Reason Codes

Todos os reason codes emitidos em `verification_results.reason_code` e no claim `reason_code` dos tokens assinados. Formato: `UPPER_SNAKE_CASE`.

### 6.1 Decisões positivas

| Code | Significado |
|---|---|
| `THRESHOLD_SATISFIED` | Idade provada >= threshold; decisão = approved. |
| `BAND_SATISFIED` | Idade dentro da faixa `[age_band_min, age_band_max]`. |

### 6.2 Decisões negativas por método

#### ZKP (adapter-zkp)
| Code | Significado |
|---|---|
| `ZKP_PROOF_INVALID` | Verificação criptográfica da prova falhou. |
| `ZKP_NONCE_MISMATCH` | Prova não está atada ao nonce da sessão. |
| `ZKP_PREDICATE_FAILED` | Predicado `age > threshold` retornou falso. |
| `ZKP_CURVE_UNSUPPORTED` | Curva do esquema não suportada (esperado BLS12-381). |

#### VC (adapter-vc)
| Code | Significado |
|---|---|
| `VC_SIGNATURE_INVALID` | Assinatura da VC/SD-JWT inválida. |
| `VC_ISSUER_UNTRUSTED` | Issuer não está em `issuers.trust_status = trusted`. |
| `VC_CREDENTIAL_REVOKED` | Presente em `issuer_revocations`. |
| `VC_EXPIRED` | `exp` claim no passado. |
| `VC_NOT_YET_VALID` | `nbf` claim no futuro. |
| `VC_SELECTIVE_DISCLOSURE_MISMATCH` | Disclosure não cobre claim de idade. |
| `VC_FORMAT_UNSUPPORTED` | Formato recebido não está em `issuers.supports_formats`. |

#### Gateway (adapter-gateway)
| Code | Significado |
|---|---|
| `GATEWAY_ATTESTATION_INVALID` | Assinatura da attestation falhou. |
| `GATEWAY_PROVIDER_ERROR` | Provedor retornou erro não-recuperável. |
| `GATEWAY_PROVIDER_UNAVAILABLE` | Provedor indisponível (timeout/5xx). |
| `GATEWAY_CONFIG_MISSING` | Adapter sem configuração para este issuer. |

#### Fallback (adapter-fallback)
| Code | Significado |
|---|---|
| `FALLBACK_DECLARATION_ACCEPTED` | Declaração aceita (assurance `low`). |
| `FALLBACK_RISK_HIGH` | Risco alto (IP/fingerprint) — escalado para `needs_review`. |
| `FALLBACK_FRICTION_REQUIRED` | Captcha/delay exigido antes de aceitar. |

### 6.3 Erros transversais

| Code | Significado |
|---|---|
| `SESSION_EXPIRED` | `verification_sessions.expires_at < now()`. |
| `SESSION_ALREADY_COMPLETED` | Tentativa de re-completar sessão terminal. |
| `POLICY_ASSURANCE_UNMET` | Assurance entregue < `required_assurance_level`. |
| `POLICY_JURISDICTION_MISMATCH` | Jurisdição do usuário não coberta pela policy. |
| `RATE_LIMIT_EXCEEDED` | Bucket esgotado em `rate_limit_buckets`. |
| `INVALID_REQUEST` | Payload rejeitado por Zod schema. |
| `INTERNAL_ERROR` | Erro genérico; sempre gera log com `trace_id`. |

---

## 7. Seeds

Executados em ordem alfabética. Idempotentes via `ON CONFLICT DO NOTHING`.

| Arquivo | Conteúdo | Depende |
|---|---|---|
| `01_jurisdictions.sql` | Bloco EU + 27 Estados-membro + BR + 26 UFs + DF | — |
| `02_trust_registry.sql` | 5 issuers mock (AgeKey demo, EUDI, Google, Apple, Serpro) | — |
| `03_policies_default.sql` | 7 templates (BR: 13+/16+/18+/21+; EU: 13+/16+/18+) | `jurisdictions` |
| `04_dev_tenant.sql` | Tenant "dev", 1 application, 3 policies clonadas, trust_list | todos acima |

**Credenciais dev (staging apenas, nunca em produção):**
- Raw api_key: `ak_dev_sk_test_0123456789abcdef`
- Raw webhook secret: `whsec_dev_0123456789abcdef`

---

## 8. Como aplicar

### Local (Docker)
```bash
supabase start
supabase db reset   # aplica migrations + seeds em banco limpo
```

### Remoto (staging `tpdiccnmsnjtjwhardij`)
```bash
export SUPABASE_ACCESS_TOKEN=<pat>
supabase link --project-ref tpdiccnmsnjtjwhardij
supabase db push
supabase db seed    # (ou aplicar seeds manualmente em ordem)
```

---

## 9. Critérios de aceite (Fase 1)

- [ ] `supabase db reset` aplica tudo em banco limpo sem erro.
- [ ] `SELECT count(*) FROM jurisdictions` retorna 56 (1 bloco + 27 UE + BR + 27 BR-UFs).
- [ ] `SELECT count(*) FROM policies WHERE is_template` retorna 7.
- [ ] `SELECT count(*) FROM issuers WHERE tenant_id IS NULL` retorna 5.
- [ ] Teste de RLS cross-tenant em `pnpm test:rls` passa (a implementar em Fase 2).
- [ ] `EXPLAIN` confirma uso dos índices nas queries críticas (listagem de sessões, validação de JTI).
- [ ] Revisão de segurança e minimização assinada.
