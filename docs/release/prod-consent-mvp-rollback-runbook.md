# Rollback Runbook — PROD Consent MVP

> ⛔ **NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL.**
> Comandos preparados; nenhum executado.
> Companheiros: `docs/release/prod-consent-mvp-execution-runbook.md`, `docs/release/prod-consent-mvp-executive-go-no-go-pack.md`.

---

## Visão geral

| Tipo de rollback | Quando usar | Tempo | Reversível? |
|---|---|---|---|
| **Rápido (flag OFF)** | qualquer falha funcional pós-ativação | < 2 min | Sim |
| **Função específica (Restore version)** | bug em deploy de uma função | minutos | Sim |
| **Migrations (DROP)** | falha catastrófica em DB | horas | **Parcial** (perde dados) |
| **Fallback operacional** | provider OTP indisponível | imediato | Sim |

---

## 1. Cenários de rollback

| # | Cenário | Severidade | Tipo recomendado |
|---|---|---|---|
| C1 | 5xx em `parental-consent-*` > 1% por 5min | Alta | Rápido (flag OFF) |
| C2 | Privacy Guard falha (PII vazada em resposta) | **Crítica** | Rápido + escalação legal/DPO |
| C3 | Token revogado não detectado online | Alta | Rápido |
| C4 | Vault encryption falha | Alta | Rápido + investigar pgsodium |
| C5 | Latência p95 > 5s | Média | Investigar; rápido se piorar |
| C6 | Provider OTP delivery rate < 50% por 1h | Média | Pausa parcial via flag; investigar provider |
| C7 | Bug isolado em 1 função (ex.: token-verify retornando 500) | Média | Função específica |
| C8 | Migration 020-023+031 com efeito colateral inesperado | Crítica | Avaliar DROP (último recurso) |
| C9 | Comportamento inesperado no smoke pós-ativação | Alta | Rápido + abort da janela |

---

## 2. Rollback rápido — feature flag OFF (RECOMENDADO)

### 2.1. Quando usar

Qualquer falha funcional pós-ativação. **Sempre** o primeiro recurso.

### 2.2. Procedimento

```
🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL

1. Dashboard Supabase PROD (project tpdiccnmsnjtjwhardij)
   → Settings → Edge Functions → Environment variables
2. Editar AGEKEY_PARENTAL_CONSENT_ENABLED:
   - Trocar valor de "true" para "false" (ou deletar a variável)
3. Salvar
4. Aguardar reciclagem dos workers (~30 segundos)
5. (Opcional) Forçar reciclagem via deploy noop:
   supabase functions deploy parental-consent-session \
     --project-ref tpdiccnmsnjtjwhardij --no-verify-jwt
```

### 2.3. Validação pós-rollback

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
curl -i -H "X-AgeKey-API-Key: <key>" \
     -H "Content-Type: application/json" \
     -d '{"application_slug":"<slug>","policy_slug":"<slug>","child_ref_hmac":"<hash>","resource":"smoke","purpose_codes":["x"],"data_categories":["x"],"locale":"pt-BR"}' \
     "https://tpdiccnmsnjtjwhardij.functions.supabase.co/parental-consent-session"

# Esperado após rollback: HTTP 503 com reason_code SYSTEM_INVALID_REQUEST
```

### 2.4. Tempo

**< 2 minutos** desde a decisão até confirmação de 503.

### 2.5. O que se preserva

- Migrations aplicadas (não revertidas).
- Edge Functions deployadas (continuam ACTIVE; só não atendem requests novos por causa do `featureDisabledResponse`).
- Dados existentes em `parental_consent_*` (consents já criados ficam em `awaiting_*` e expiram naturalmente em 24h via `expires_at`).
- Audit events.

---

## 3. Rollback de Edge Functions (versão específica)

### 3.1. Quando usar

Bug isolado em **1 função** após deploy novo, sem afetar fluxo geral. Ex.: `parental-consent-token-verify` retornando 500 mas outras OK.

### 3.2. Procedimento

```
🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL

1. Dashboard Supabase PROD → Edge Functions → selecionar a função afetada
2. Aba "Versions"
3. Identificar versão anterior estável
4. Botão "Restore" (ou "Promote") na versão anterior
5. Confirmar
6. Aguardar redeploy (segundos a minutos)
```

### 3.3. Validação

- Smoke específico do endpoint afetado.
- Se voltar a funcionar, manter rollback parcial.
- Se persistir, escalar para rollback rápido (§2).

---

## 4. Rollback de migrations — **NÃO automático**

### 4.1. Quando considerar

⛔ **Apenas em falha catastrófica** que não pode ser mitigada por flag OFF. Ex.: migration introduziu DDL que corrompe dados existentes.

### 4.2. Pré-condições obrigatórias

- Backup PROD < 24h confirmado **antes** da janela (já registrado em `backup_id`).
- DBA on-call disponível.
- Aprovação produto + legal **explícita** para reverter migration.
- Análise técnica do que será perdido (consents criados, guardian contacts, etc.).

### 4.3. Procedimento (resumo — DBA conduz)

```sql
-- 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL DBA + LEGAL

-- Opção A — restaurar do snapshot (preferida se < 1h após aplicar migrations):
-- Dashboard Supabase → Database → Backups → Restore (point-in-time)

-- Opção B — DROP cascata (perde dados criados após migration):
DROP TABLE IF EXISTS public.guardian_verifications CASCADE;
DROP TABLE IF EXISTS public.guardian_contacts CASCADE;
DROP TABLE IF EXISTS public.parental_consent_tokens CASCADE;
DROP TABLE IF EXISTS public.parental_consent_revocations CASCADE;
DROP TABLE IF EXISTS public.parental_consents CASCADE;
DROP TABLE IF EXISTS public.parental_consent_requests CASCADE;
DROP TABLE IF EXISTS public.consent_text_versions CASCADE;
-- + DROP FUNCTIONS associated (guardian_contacts_store etc.)
-- + DELETE FROM supabase_migrations.schema_migrations WHERE name LIKE '02_%' OR ...

-- Opção C — manter tabelas, reverter apenas function 031:
-- CREATE OR REPLACE FUNCTION guardian_contacts_store(...) com body original de 021
-- (re-introduz bug pgsodium; só faz sentido se 031 quebrou outra coisa)
```

### 4.4. Tempo

- Snapshot restore: 30 minutos a 2 horas.
- DROP cascata + DELETE migrations: 5-15 minutos, mas **comunicação + decisão** geralmente toma horas.

### 4.5. Comunicação obrigatória

- Notificar tenant piloto (se externo).
- Status page atualizada.
- Postmortem **detalhado** dentro de 48h.
- Possível notificação ANPD se houver vazamento (DPO decide).

### 4.6. Recuperação pós-rollback de migration

- Análise técnica do que falhou.
- Correção em PR separado.
- Nova janela autorizada antes de re-aplicar.

---

## 5. Fallback operacional (provider OTP indisponível)

### 5.1. Quando usar

Provider OTP (Twilio/Mailgun/etc.) caiu ou está com delivery rate baixo.

### 5.2. Opções

| Opção | Procedimento | Impacto |
|---|---|---|
| A | Pausar via flag OFF temporariamente; aguardar provider voltar | Sem novos consents durante a pausa |
| B | Trocar provider via env var (se segundo provider estiver configurado) | Reciclagem de workers; teste rápido antes |
| C | Comunicar tenant para retentar mais tarde | Sem ação técnica imediata |

⛔ **Não habilitar `DEV_RETURN_OTP=true` em PROD** mesmo durante incidente — proibido por design.

---

## 6. Comunicação durante rollback

### 6.1. Canais

- **Slack interno**: #agekey-prod-incident (ou similar).
- **Tenant piloto** (se externo): canal contratual.
- **Status page** (se aplicável): atualizar.
- **DPO**: alertar imediatamente em casos C2 (privacy) ou C8 (migration rollback).

### 6.2. Mensagem template (ajustar contexto)

```
[AgeKey PROD - Consent MVP] Rollback acionado

Quando: <UTC>
Trigger: <cenário C# do rollback runbook>
Tipo de rollback: <rápido | função específica | migration>
Status atual: <ativo | em curso | concluído>
Próximo update: <ETA>
Operador: <nome>

Tráfego de Consent está temporariamente desabilitado. Consents
ja aprovados continuam válidos. Pediremos retentativa quando
o serviço estiver restaurado.
```

---

## 7. Critérios de acionamento (resumo)

| Acionar imediatamente? | Severidade | Quem aciona |
|---|---|---|
| Sim | Crítica (C2 privacy, C8 migration) | Operador, sem aguardar aprovador |
| Sim, após confirmação | Alta (C1, C3, C4, C7, C9) | Operador + DBA on-call |
| Aguardar análise | Média (C5, C6) | Operador discute com aprovador |

---

## 8. Responsáveis

| Papel | Quem | Para qual rollback |
|---|---|---|
| Operador da janela | (nome) | §2 (rápido), §3 (função), §5 (fallback) |
| DBA on-call | (nome) | §4 (migration) |
| Aprovador legal/produto | (nome) | §4 (migration) — autoriza |
| DPO | (nome) | C2 (privacy) — autoriza notificação ANPD se aplicável |
| Comunicação | (nome) | §6 — canais internos + tenant |

---

## 9. Pós-rollback

1. Coletar logs do período do incidente (Edge Functions + DB + audit).
2. Identificar causa raiz.
3. Postmortem dentro de 48h.
4. PR de correção (se aplicável).
5. Re-planejamento da janela.

---

## 10. Lições do ciclo HML (referência preventiva)

Bugs detectados em HML que **já estão corrigidos** em main e não devem reaparecer em PROD:

- **DecisionEnvelope offset** (PR #66) — Zod aceita timezone offset.
- **vault.create_secret** (PR #70 + migration 031) — substitui INSERT direto.
- **token-verify activated_at** (PR #73) — coluna correta de `crypto_keys`.
- **DEV_RETURN_OTP** — env var deve estar setada apenas em HML, **proibida em PROD**.

Se algum desses sintomas aparecer em PROD, é regressão — investigar antes de aplicar rollback de migration.

---

## Confirmações de não-ação (este runbook como documento)

- ❌ Nada executado em PROD.
- ❌ Nenhuma migration revertida.
- ❌ Nenhum DROP em qualquer ambiente.
- ❌ Nenhuma flag alterada.
- ✅ Apenas runbook documental.
