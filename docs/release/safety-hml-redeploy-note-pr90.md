# Nota operacional — Redeploy HML Edge Functions pós-merge PR #90

> **Escopo:** HML apenas. PROD **fora de escopo**.
> **Status:** documento operacional para o operador. Esta sessão **não** executa o redeploy.
> **PR origem:** [seusdados/ecadigital360-age-assurance#90](https://github.com/seusdados/ecadigital360-age-assurance/pull/90) (squash merged em `main` @ `fbe2400d0b200a8be611706bf034b3d73da22232`).

## 1. Motivo do redeploy

PR #90 (`safety: harden HML audit trail, policy fallback and alerts UI`) introduziu mudanças de código em duas Edge Functions Safety. Sem redeploy, o código novo está mergido em `main` mas **não está rodando** em HML — o comportamento atual do projeto HML continua o de pré-merge.

As mudanças que entram em vigor após o redeploy:

- **`safety-event-ingest`**
  - Fallback resiliente quando o tenant não tem policy/versão ativa (substitui no-op silencioso por audit explícito).
  - Emissão de `safety.alert_created`, `safety.step_up_linked`, `safety.parental_consent_check_linked`.
  - Emissão de `safety.step_up_skipped_no_policy` (`reason_code: SAFETY_STEP_UP_NO_ACTIVE_POLICY`) e `safety.parental_consent_skipped_no_policy` (`reason_code: SAFETY_PARENTAL_CONSENT_NO_ACTIVE_POLICY`).
  - Troca de `single()` → `maybeSingle()` em lookup de `policy_versions`.
  - Passa a importar o novo helper `_shared/safety/audit.ts`.
- **`safety-alert-dispatch`**
  - Emissão de `safety.alert_acknowledged | _escalated | _resolved | _dismissed` para cada admin action.
  - `assertPayloadSafe(response, 'public_api_response')` aplicado à resposta (defesa em profundidade na saída).
  - Passa a importar o novo helper `_shared/safety/audit.ts`.

O helper `supabase/functions/_shared/safety/audit.ts` é **novo** e bundlado em ambas as funções acima; o sanitizer puro `packages/shared/src/safety/audit-sanitize.ts` também é novo e consumido pelo helper.

## 2. Funções afetadas (redeploy obrigatório)

| # | Função | Motivo |
|---|---|---|
| 1 | `safety-event-ingest` | `index.ts` modificado + bundle inclui novo `_shared/safety/audit.ts` e novo `packages/shared/src/safety/audit-sanitize.ts` |
| 2 | `safety-alert-dispatch` | `index.ts` modificado + bundle inclui novo `_shared/safety/audit.ts` |

## 3. Funções explicitamente **NÃO** afetadas (não redeployar)

Nenhuma alteração no respectivo `index.ts`; comportamento de execução em HML não muda:

Safety:
- `safety-rule-evaluate`
- `safety-rules-write`
- `safety-step-up`
- `safety-aggregates-refresh`
- `safety-retention-cleanup`

Consent (intocado por PR #90):
- `parental-consent-session`
- `parental-consent-guardian-start`
- `parental-consent-confirm`
- `parental-consent-session-get`
- `parental-consent-text-get`
- `parental-consent-token-verify`
- `parental-consent-revoke`

Core/JWKS/issue/verify/webhooks/retention/etc. (intocado por PR #90):
- nenhuma função do Core listada acima.

> Observação técnica: `safety-rule-evaluate` faz `import ... from '.../packages/shared/src/safety/index.ts'`, e o `index.ts` ganhou re-exports (`alert-list-filters`, `audit-sanitize`). Porém os símbolos consumidos por `safety-rule-evaluate` (`evaluateAllRules`, `deriveRelationship`) **não foram modificados**. Não há mudança de comportamento esperada; portanto, não há necessidade operacional de redeploy.

## 4. Comando CLI para o operador (HML)

Pré-requisitos no ambiente do operador:

- `supabase` CLI instalado (mesmo binário usado pelo workflow do repo).
- `SUPABASE_ACCESS_TOKEN` no ambiente — **personal access token** do dashboard Supabase. **Não usar** service_role JWT, DB password, tenant API key, ou token Vercel.
- Checkout local do repo na revisão `main` pós-merge (HEAD = `fbe2400d0b200a8be611706bf034b3d73da22232` ou posterior).

Comandos:

```bash
# Project ref HML (hardcoded — mesmo valor do workflow):
export SUPABASE_PROJECT_REF=wljedzqgprkpqhuazdzv

# 1) Redeploy safety-event-ingest
supabase functions deploy safety-event-ingest \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --no-verify-jwt

# 2) Redeploy safety-alert-dispatch
supabase functions deploy safety-alert-dispatch \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --no-verify-jwt
```

Justificativa do `--no-verify-jwt`: AgeKey Consent e Safety se autenticam via header `X-AgeKey-API-Key` (modelo próprio em `supabase/functions/_shared/auth.ts`), não via JWT Supabase. Sem essa flag, a plataforma Supabase responde 401 antes do request chegar à função (regressão documentada em PR #63 §0.4–0.6).

Não rodar nenhum comando adicional. Em particular:
- ❌ Não rodar `supabase db push`.
- ❌ Não rodar `supabase db reset`.
- ❌ Não rodar `supabase db pull`.
- ❌ Não rodar `supabase migration repair`.
- ❌ Não alterar feature flags (`AGEKEY_SAFETY_*`) remotas.

## 5. Comando GitHub Actions (alternativa) — aplicável com ressalva

O workflow `.github/workflows/deploy-hml-edge-functions.yml` existe e está pronto, **mas faz redeploy das 14 funções Consent + Safety simultaneamente**. Para PR #90 isso **excede o escopo necessário** (apenas 2 funções precisam).

**Recomendação:** usar o CLI da §4 para limitar o blast radius ao mínimo.

Caso o operador opte por usar o workflow assim mesmo, o caminho é:

1. GitHub → Actions → **Deploy HML Edge Functions** → **Run workflow**
2. No campo `confirm_hml_deploy`, digitar exatamente: `DEPLOY_HML_EDGE_FUNCTIONS`
3. Submeter.

O workflow reusa o secret `SUPABASE_ACCESS_TOKEN` do repo e está hardcoded em `SUPABASE_PROJECT_REF=wljedzqgprkpqhuazdzv` (HML). Aplica `--no-verify-jwt` automaticamente.

Se o operador quiser uma execução mais cirúrgica via Actions, a alternativa é abrir nova PR (em sessão separada) com um workflow `workflow_dispatch` parametrizado pelo nome da função; isso **não** está autorizado nesta sessão.

## 6. Pós-redeploy — verificação operacional (não-executada por mim)

Sugestão de verificação a ser feita pelo operador em HML:

1. Listar functions deployadas em HML e conferir `updated_at` de `safety-event-ingest` e `safety-alert-dispatch` apontando para a janela de redeploy.
2. Smoke pack — `docs/release/safety-hml-smoke-test-pack.md`, Casos 1, 3, 4, 5, 6 (privacy guard, regra triggered, policy fallback, admin acknowledge, cross-tenant isolation).
3. Verificação de audit trail em HML:
   ```sql
   select action, count(*) from audit_events
   where action like 'safety.%'
     and created_at > now() - interval '1 hour'
   group by action
   order by action;
   ```
   Após smoke, devem aparecer linhas para `safety.alert_created`, `safety.step_up_linked` (ou `safety.step_up_skipped_no_policy`), `safety.alert_acknowledged`, etc., **sem** quaisquer campos de PII em `diff_json`.
4. Marcar `docs/release/safety-hml-readiness-checklist.md` correspondentemente.

## 7. Confirmações de escopo desta nota

- ✅ **HML-only.** O `SUPABASE_PROJECT_REF` autorizado é exclusivamente `wljedzqgprkpqhuazdzv`.
- ✅ **PROD fora.** Nenhum project ref de PROD aparece nesta nota; nenhum comando de deploy ou inspect aponta para PROD.
- ✅ **Apenas duas funções.** A nota lista explicitamente as 2 funções a redeployar e as 12 a **não** redeployar.
- ✅ **Sem migrations / sem schema / sem RLS / sem feature flags.** Redeploy de Edge Function não toca em qualquer um destes domínios.
- ✅ **Sem secrets reais.** Esta nota usa `SUPABASE_ACCESS_TOKEN` apenas como nome de variável de ambiente; não há token, API key, JWT, OTP, `pcpt_*`, `SAFETY_CRON_SECRET` ou guardian token comitado.
- ✅ **Nenhuma execução nesta sessão.** Esta sessão produz a nota; a execução fica a cargo do operador, em janela e contexto separados.
- ✅ **Sem workflow de PROD.** Não toca em `.github/workflows/*prod*` (não existe e não será criado nesta sessão).
