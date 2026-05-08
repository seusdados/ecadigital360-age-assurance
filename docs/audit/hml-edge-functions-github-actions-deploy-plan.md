# HML — Edge Functions deploy via GitHub Actions

> Workflow: `.github/workflows/deploy-hml-edge-functions.yml`
> Tipo: manual (`workflow_dispatch`) com confirmação por input.
> Ambiente: HML apenas (`wljedzqgprkpqhuazdzv`).
> Status: criado, **NÃO disparado**.

## 1. Por que GitHub Actions

- O operador não tem acesso ao notebook agora; não consegue rodar `supabase functions deploy` localmente.
- A sessão de Claude Code não tem `SUPABASE_ACCESS_TOKEN` configurada e não autenticou via `supabase login`.
- O MCP `deploy_edge_function` exigiria bundling manual de centenas de arquivos cross-monorepo (risco real de runtime crash) — descartado.
- GitHub Actions resolve as três restrições:
  - Usa o Supabase CLI oficial via `supabase/setup-cli@v1` — bundling automático e idêntico ao que o operador rodaria localmente.
  - Auth via secret de repositório (`SUPABASE_ACCESS_TOKEN`), nunca em código.
  - Disparo manual + auditável (logs do GitHub Actions retêm cada execução).

## 2. Por que MCP `deploy_edge_function` foi rejeitado

| Aspecto | MCP | GitHub Actions com CLI |
|---|---|---|
| Bundling | Manual: precisa enviar `files[]` com cada arquivo transitivamente importado | Automático: o CLI segue imports e empacota |
| Cross-monorepo (`../../../packages/shared/src/...`) | Frágil: 1 arquivo faltando = 500 em runtime | Suportado nativamente pelo CLI |
| Quantidade de arquivos por function | ~30 (Consent) a ~50 (Safety) | N/A |
| Total para 14 functions | ~300 arquivos com risco de duplicação/sobrescrita | N/A |
| Reversibilidade em caso de erro | Difícil (function já no estado parcial) | Opera-se via re-trigger; CLI atômico por function |
| Auditoria | Apenas a tool result do MCP nesta sessão | Logs persistentes em GitHub Actions |

Conforme regra do operador "**se houver erro de deploy, pare e reporte**", o caminho via CLI é o tecnicamente correto.

## 3. Secrets necessários

**Apenas um secret**:

- `SUPABASE_ACCESS_TOKEN`: Personal Access Token gerado em https://supabase.com/dashboard/account/tokens
  - Escopo: pode ser do projeto HML específico, ou pessoal "all projects".
  - Recomendação: usar token específico de operação, sem reuso em PROD.
  - Não é o `service_role` do projeto.
  - Não é a senha do banco.
  - Não é tenant API key.
  - Não é Vercel token.

**Não usados** (e não devem ser configurados como secret deste workflow):

- ❌ `SUPABASE_DB_PASSWORD` (não há `db push`/`migration` neste workflow)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` (escopo é deploy, não DML/DDL)
- ❌ `AGEKEY_HML_TENANT_API_KEY` (não há smoke test neste workflow)
- ❌ `VERCEL_TOKEN` (não toca em Vercel)

## 4. Configuração do secret no GitHub

1. Acesse: https://github.com/seusdados/ecadigital360-age-assurance/settings/secrets/actions
2. Clique **New repository secret**.
3. Preencha:
   - **Name**: `SUPABASE_ACCESS_TOKEN`
   - **Secret**: cole o token gerado em https://supabase.com/dashboard/account/tokens
4. Clique **Add secret**.

Depois de configurado, **não há rotação automática** — quando o token for revogado, atualizar manualmente o secret.

## 5. Como disparar manualmente a Action

1. Acesse: https://github.com/seusdados/ecadigital360-age-assurance/actions
2. Na barra lateral, clique em **Deploy HML Edge Functions**.
3. Clique no botão **Run workflow** (canto direito).
4. No campo `confirm_hml_deploy`, **digite exatamente**:
   ```
   DEPLOY_HML_EDGE_FUNCTIONS
   ```
5. Selecione branch `main` (ou outra que tenha o workflow se aplicável).
6. Clique **Run workflow**.

## 6. Input obrigatório de confirmação

```yaml
confirm_hml_deploy:
  description: 'Type DEPLOY_HML_EDGE_FUNCTIONS to confirm. HML only — never PROD.'
  required: true
  type: string
```

Validação **dupla**:

1. Em nível de job: `if: github.event.inputs.confirm_hml_deploy == 'DEPLOY_HML_EDGE_FUNCTIONS'` — se não bater, job inteiro é pulado.
2. Em nível de step (runtime guard): primeiro step do job revalida e aborta com `exit 1` se não bater.

Esta dupla checagem evita que alguém digite uma string parecida (ex.: `deploy_hml_edge_functions` em minúsculas) por engano.

## 7. Funções deployadas (14)

Em ordem de execução (function-by-function, sem wildcard):

### Consent (7)

1. `parental-consent-session`
2. `parental-consent-guardian-start`
3. `parental-consent-confirm`
4. `parental-consent-session-get`
5. `parental-consent-text-get`
6. `parental-consent-token-verify`
7. `parental-consent-revoke`

### Safety (7)

8. `safety-event-ingest`
9. `safety-rule-evaluate`
10. `safety-rules-write`
11. `safety-alert-dispatch`
12. `safety-step-up`
13. `safety-aggregates-refresh`
14. `safety-retention-cleanup`

Cada deploy é um step próprio do GitHub Actions, com `set -euo pipefail` implícito. Falha em qualquer step **interrompe** o workflow (semântica padrão do GitHub Actions: steps subsequentes são pulados).

**Importante — flag `--no-verify-jwt`**: cada `supabase functions deploy` no workflow inclui esse flag. Sem ele, o CLI define `verify_jwt=true` por padrão, fazendo o Supabase platform retornar HTTP 401 **antes** de chegar no código da função (porque AgeKey usa autenticação própria via `X-AgeKey-API-Key` em `_shared/auth.ts`, não JWT do Supabase Auth). Este flag foi adicionado após a regressão observada no deploy CLI local em 2026-05-08 ~13:23 UTC e mitigada às 13:33 UTC. Ver PR #63 §0.4–0.6 para detalhes da regressão e validação pós-mitigação.

## 8. O que o workflow NÃO faz

- ❌ **Não toca em PROD.** O project ref está hardcoded como `wljedzqgprkpqhuazdzv` (HML) e há um step defensivo que aborta se `SUPABASE_PROJECT_REF` for diferente.
- ❌ **Não roda migrations.** Sem `supabase db push`, sem `migration repair`, sem `migration up`.
- ❌ **Não altera schema.** Apenas deploy de Edge Functions.
- ❌ **Não altera feature flags.** Não toca em `Project settings`, `secrets`, `vault`, ou `app.settings.*`.
- ❌ **Não roda `supabase db push`.**
- ❌ **Não roda `supabase migration repair`.**
- ❌ **Não roda `supabase db reset`.**
- ❌ **Não roda `supabase db pull`.**
- ❌ **Não faz link do CLI** ao projeto (não é necessário com `--project-ref` explícito em cada deploy).
- ❌ **Não roda smoke tests.** Smoke tests requerem tenant API key e ficam separados (ver §9 e PR #63 para o plano de smoke).
- ❌ **Não tem trigger automático.** Apenas `workflow_dispatch`. Push e pull_request **não disparam** este workflow.

## 9. Como verificar após o deploy

### 9.1. Via MCP (Claude executa)

Após você disparar o workflow e ele concluir, peça para eu rodar:

```python
mcp__list_edge_functions(project_id="wljedzqgprkpqhuazdzv")
```

Esperado vs estado BEFORE (capturado em PR #63):

| Function | BEFORE versão | AFTER esperado | BEFORE hash | AFTER esperado |
|---|---|---|---|---|
| `parental-consent-session` | v19 | v20+ | `72ea25c9` | diferente |
| `parental-consent-guardian-start` | v18 | v19+ | `71756cfa` | diferente |
| `parental-consent-confirm` | v18 | v19+ | `643ec99b` | diferente |
| `parental-consent-session-get` | v18 | v19+ | `0edc9108` | diferente |
| `parental-consent-text-get` | v18 | v19+ | `86d23580` | diferente |
| `parental-consent-token-verify` | v18 | v19+ | `260e75c2` | diferente |
| `parental-consent-revoke` | v18 | v19+ | `e316c231` | diferente |
| `safety-event-ingest` | v18 | v19+ | `6777cf1e` | diferente |
| `safety-rule-evaluate` | v18 | v19+ | `7541c262` | diferente |
| `safety-rules-write` | v18 | v19+ | `8ceafd02` | diferente |
| `safety-alert-dispatch` | v18 | v19+ | `7066db26` | diferente |
| `safety-step-up` | v18 | v19+ | `577338ca` | diferente |
| `safety-aggregates-refresh` | v18 | v19+ | `b954b72b` | diferente |
| `safety-retention-cleanup` | v18 | v19+ | `28d000da` | diferente |

Se alguma function não tiver `version` incrementada, **o deploy daquela function falhou** ou foi pulado.

### 9.2. Via smoke tests (operador executa)

Os scripts já estão em `main` (PR #57 mergeado): `scripts/smoke/{consent,safety,core}-smoke.sh`.

Comandos exatos com placeholders e descrição completa estão em PR #63 (`docs/audit/hml-edge-functions-redeploy-and-smoke-report.md`, §5.2).

### 9.3. Via PR #63

PR #63 contém:
- Estado BEFORE detalhado das 14 functions (versões, hashes, timestamps).
- Lista de smoke tests Consent/Safety/Core com comportamentos esperados.
- Lista de UI smoke tests para o painel admin.
- Status final que será atualizado quando este workflow for executado e validado.

## 10. Falha no meio do deploy

GitHub Actions executa steps sequencialmente. Se um step falha:

1. Workflow **para** automaticamente (`set -e` implícito).
2. Steps subsequentes são pulados.
3. Functions **anteriores** já estão deployadas (não há rollback automático).

### Recuperação

Opções:

- **Re-disparar o workflow inteiro**: as functions já-deployadas serão re-deployadas com o mesmo conteúdo (idempotente; gera nova versão sem efeito prático).
- **Editar o workflow** removendo as functions já deployadas e re-disparar (mais cirúrgico; requer commit temporário).
- **Investigar o erro**: GitHub Actions log mostra stderr completo do CLI; geralmente é problema de rede ou de parse do bundle.

Recomendação: re-disparar (mais simples; idempotência do CLI é confiável para deploy).

## 11. Pré-requisitos antes de disparar

| # | Pré-requisito | Como verificar |
|---|---|---|
| 1 | `main` em `c868312` ou descendente | Aba "Code" na branch `main`; ver último commit |
| 2 | PR #63 mergeado (opcional, mas recomendado para coerência de relatório) | https://github.com/seusdados/ecadigital360-age-assurance/pull/63 |
| 3 | Secret `SUPABASE_ACCESS_TOKEN` configurado | Settings → Secrets → Actions → vê se aparece "SUPABASE_ACCESS_TOKEN" |
| 4 | Janela de manutenção opcional (operação leva 1–2 minutos por function = ~15–30 minutos total) | Decisão do operador |
| 5 | Backup recente em HML (snapshot Supabase) | Dashboard Supabase → Database → Backups (não obrigatório porque deploy é não-destrutivo) |

## 12. Confirmação de princípios

Esta abordagem **respeita**:

- ✅ Manual-only.
- ✅ Confirmação por input string explícita.
- ✅ HML hardcoded com guard defensivo contra PROD.
- ✅ Function-by-function (14 steps explícitos).
- ✅ Fail-fast.
- ✅ Single secret (`SUPABASE_ACCESS_TOKEN`), sem service_role / DB password / tenant key / Vercel.
- ✅ Sem migrations, sem schema, sem flags, sem cron.
- ✅ Sem `db push`/`repair`/`reset`/`pull`.
- ✅ Sem trigger automático em push/PR.

## 13. Próximos passos

1. **Operador**: configurar `SUPABASE_ACCESS_TOKEN` no GitHub Secrets (§4).
2. **Operador**: aguardar merge de PR deste workflow (e idealmente do PR #63 com o report completo).
3. **Operador**: disparar workflow manualmente (§5).
4. **Claude**: validar resultado via MCP `list_edge_functions` quando avisado.
5. **Operador**: rodar smoke tests cURL com tenant API key (PR #63 §5.2).
6. **Operador**: validar UI HML em browser (PR #63 §5.3).
7. **Claude**: atualizar relatório final em PR #63 (`hml-edge-functions-redeploy-and-smoke-report.md`) com status pós-deploy.

## 14. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | Operador disparar com input errado | Média | Workflow checa string exata; aborta se diferente |
| 2 | Alguém alterar `SUPABASE_PROJECT_REF` para PROD | Crítica | Step de validação defensivo aborta com `exit 1` |
| 3 | Token vazado em log | Média | CLI nunca imprime o token; só leu via env var |
| 4 | Deploy parcial (falha no meio) | Baixa | Re-disparo é idempotente |
| 5 | Bundle quebrar por motivo de versão de Deno | Média | `supabase/setup-cli@v1` instala versão `latest`; se quebrar, fixar versão específica |
| 6 | Trigger acidental | Baixa | `workflow_dispatch` exige acesso de write no repo + clique manual |
| 7 | Race com cron de retention que tenta usar a function durante deploy | Baixa | Deploy substitui sem downtime; chamadas durante a transição podem usar versão antiga ou nova |

Plano para risco 2 (alteração de project ref): se for necessário um workflow para PROD no futuro, **será arquivo separado** (`.github/workflows/deploy-prod-edge-functions.yml`) com requisitos extras (review review obrigatória, environment protection, etc.). **NUNCA** ajustar este workflow para PROD sem reescrever do zero.
