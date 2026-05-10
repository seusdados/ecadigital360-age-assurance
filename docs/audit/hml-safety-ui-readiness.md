# HML Safety UI — Readiness

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Escopo:** auditoria das rotas admin `apps/admin/app/(app)/safety/*`. Sem PROD; sem mudanças de código nesta sessão.

---

## 1. Rotas auditadas

| Rota | Arquivo | Status |
| --- | --- | --- |
| `/safety` | `page.tsx` (47) | ✅ |
| `/safety/events` | `events/page.tsx` (63) | ✅ |
| `/safety/alerts` | `alerts/page.tsx` (100) | ✅ |
| `/safety/alerts/[id]` | `alerts/[id]/page.tsx` (151) | ✅ |
| `/safety/rules` | `rules/page.tsx` (65) | ✅ |
| `/safety/rules/new` | `rules/new/page.tsx` (34) | ⚠ placeholder, ver UI3 |
| `/safety/rules/[id]` | `rules/[id]/page.tsx` (64) | ✅ |
| `/safety/subjects` | `subjects/page.tsx` (59) | ✅ |
| `/safety/interactions` | `interactions/page.tsx` (62) | ✅ |
| `/safety/evidence` | `evidence/page.tsx` (73) | ✅ |
| `/safety/retention` | `retention/page.tsx` (64) | ✅ |
| `/safety/integration` | `integration/page.tsx` (55) | ✅ |
| `/safety/settings` | `settings/page.tsx` (40) | ✅ |
| `/safety/reports` | `reports/page.tsx` (56) | ✅ |
| Layout / subnav | `layout.tsx` (47) | ✅ |

## 2. Verificações exigidas (do prompt)

| Verificação | Status | Detalhes |
| --- | --- | --- |
| não exibe PII | ✅ | nenhuma rota seleciona `email`, `phone`, `birthdate`, `name`, `cpf`, `rg`, `passport` ou `ip_address` |
| não exibe IP bruto | ✅ | nenhum `select('… ip_address …')` em queries Safety |
| não exibe conteúdo bruto | ✅ | apenas `payload_hash`, `content_hash`, `artifact_hash`; nunca `raw_text`/`message`/`image`/`audio`/`video` |
| linguagem correta | ✅ | "alerta", "evento", "sinal", "interação", "sujeito"; **nunca** "crime", "vigilância", "espionagem", "detecção infalível", "spyware" |
| alertas proporcionais | ✅ | severity tem 5 níveis (info/low/medium/high/critical); cada um com tom de cor distinto e não-alarmista |
| labels seguros | ✅ | `risk_category`, `reason_codes`, `actions_taken` exibidos como código; sem juízo moral inline |

## 3. Identificadores e privacidade — verificação por rota

### 3.1 `/safety` (visão geral)
- 4 KPIs numéricos: `events`, `alerts`, `open_alerts`, `subjects`. ✅
- Sem labels de risco moralizantes; descrição factual no layout: "Sinais de risco proporcionais e auditáveis. Metadata-only no MVP — sem conteúdo bruto, sem reconhecimento facial, sem score universal cross-tenant." ✅

### 3.2 `/safety/events`
- Colunas: `id` (encurtado), `event_type` (codificado), `occurred_at`, `retention_class`, `legal_hold` (🔒 ou —), `payload_hash` (encurtado).
- ✅ não exibe `metadata_jsonb` cru. Bom — metadata pode conter campos de bucket que o operador não precisa ver na lista.
- ✅ não exibe `interaction_id`, `tenant_id`.

### 3.3 `/safety/alerts` (lista)
- Colunas: `id`, `status`, `severity`, `rule_code`, `risk_category`, `reason_codes` (joined), `created_at`.
- ✅ severity tonalizada com cores neutras (rose para critical, amber para medium, etc.).
- ✅ status tonalizado (open=rose, ack=amber, escalated=orange, resolved=emerald, dismissed=stone).

### 3.4 `/safety/alerts/[id]` (detalhe)
- Mostra: rule_code, status, severity, risk_category, reason_codes, actions_taken, legal_hold, created/resolved timestamps.
- Sujeitos exibidos como **HMAC encurtado** (`shortId(subject_ref_hmac)`), não como subject_id raw nem dados pessoais.
- step_up_session_id e parental_consent_request_id são UUIDs opacos.
- triggering_event_ids como UUIDs encurtados.
- resolved_note exibido como texto livre. ⚠ **Este é o único lugar onde o operador pode escrever texto livre. Ver UI5.**

### 3.5 `/safety/subjects`
- Colunas: id, ref_hmac (encurtado), age_state, reports_count, alerts_count, last_seen_at.
- ✅ sem PII. age_state pode ser `unknown`/`minor`/`adult` — categórico, não numérico (não revela idade exata).

### 3.6 `/safety/interactions`
- Colunas: relationship, ator (id encurtado), contraparte (id encurtado), events_count, reports_count, last_seen_at.
- ✅ relationship é categórico (`adult_to_minor`, `unknown_to_minor`, `same_age_band`, etc.).

### 3.7 `/safety/evidence`
- Colunas: id, alert_id, artifact_hash, mime_type, size_bytes, retention_class, legal_hold, created_at.
- Texto explicativo no topo: "Conteúdo bruto NÃO é armazenado em V1. Apenas referência via hash + path opcional."
- ✅ correto.

### 3.8 `/safety/retention`
- Tabela com eventos por classe + caixa amarela "🔒 Legal hold ativo: N eventos protegidos contra cleanup automático".
- ✅ correto.

### 3.9 `/safety/integration`
- Snippets de SDK e proxy server-side.
- ✅ snippet usa `hmacSubject('user-internal-id')` — correto.
- ✅ snippet **não** envia `raw_text`, `message`, etc. — apenas metadata.

### 3.10 `/safety/settings`
- Lista 4 feature flags read-only com descrição. Edição via infra (Edge Functions secrets).
- ✅ correto. Não permite edição direta — apenas documentação.

### 3.11 `/safety/reports`
- Tabelas pivot: alertas por severidade e por regra.
- ✅ apenas counters, nenhum dado individual.

### 3.12 `/safety/rules` (lista) e `[id]` (detalhe)
- Mostra rule_code, escopo (global ou tenant), enabled, severity, actions, config_json.
- ✅ correto.

### 3.13 `/safety/rules/new`
- ⚠ placeholder com SQL inline para criar override via banco.
- ⚠ Não usa ainda o `actions.ts` que **já existe** (`createRuleOverride`). Ver UI3.

### 3.14 `/safety/rules/actions.ts`
- Server actions: createRuleOverride, patchRuleOverride, deleteRuleOverride, toggleRuleOverride.
- Chamam `safety-rules-write` Edge Function via `agekeyEnv.adminApiKey()`. ✅
- `revalidatePath` correto. ✅

## 4. Vocabulário — varredura por termos proibidos

Buscas em `apps/admin/app/(app)/safety/` por termos que poderiam dar tom impróprio à UI:

| Termo proibido | Ocorrências |
| --- | --- |
| `crime` | 0 |
| `criminal` | 0 |
| `vigilancia` / `vigilância` | 0 |
| `surveillance` | 0 |
| `espionagem` | 0 |
| `spy` / `spyware` | 0 |
| `detecção infalível` / `infallible` | 0 |
| `predador` / `predator` | 0 |
| `culpa` / `culpado` | 0 |
| `condena` / `condena` | 0 |

Termos canônicos usados:

- `Alerta`, `alerts`, `alertas` — neutro.
- `Sinais de risco proporcionais` — frase explicitamente proporcionalista.
- `Sujeito`, `subjects` — neutro, despessoalizado (e o subject ref é HMAC).
- `Interação`, `interactions` — neutro.
- `Severidade` (5 níveis) — proporcional.
- `Reason codes`, `actions_taken` — descritivo, não acusatório.
- `Legal hold` — termo jurídico canônico.

## 5. Lacunas identificadas

### UI1 — Sem ação UI para escalonar/resolver alert
A página de detalhe `/safety/alerts/[id]` mostra status, mas não tem botões para `acknowledge`, `escalate`, `resolve`, `dismiss`. O endpoint `safety-alert-dispatch` existe; a UI ainda não o consome. **Severidade**: média (admin precisa hoje fazer via API). **Ação**: PR futuro.

### UI2 — Sem ação UI para alternar `legal_hold`
Listagens mostram 🔒 mas não permitem ativar/desativar. **Severidade**: média (operação rara, mas crítica em compliance). **Ação**: PR futuro com endpoint dedicado e botão protegido.

### UI3 — `/safety/rules/new` é placeholder com SQL
Formulário não plugado nas server actions. Operador atual cria override via SQL ou via API direta. **Severidade**: baixa em HML, média em PROD. **Ação**: substituir placeholder por formulário plugado em `createRuleOverride`. PR pequeno candidato.

### UI4 — Listas estão limitadas a 100 sem paginação
`/safety/events`, `/safety/alerts`, `/safety/subjects`, `/safety/interactions`, `/safety/evidence` todas usam `.limit(100)` sem cursor/paginação. **Severidade**: baixa em HML, média em PROD com volume. **Ação**: adicionar paginação cursor-based em rodada futura.

### UI5 — `resolved_note` é texto livre
`/safety/alerts/[id]` exibe `resolved_note` que é livre. Hoje o operador insere via `safety-alert-dispatch` (`note` no body). **Risco**: operador pode inserir PII inadvertidamente no note. **Mitigação atual**: privacy guard `admin_minimized_view` é aplicado no body do dispatch (linha 62 do alert-dispatch); ele rejeita campos canônicos proibidos mas **não rejeita PII livre dentro do `note`**. **Ação**: aplicar regex de "looks like email/phone/cpf" no note no Edge Function antes de gravar. PR futuro.

### UI6 — Sem indicador de ambiente HML/PROD
Todos os layouts e páginas Safety são iguais em qualquer ambiente. Para PROD, recomendar banner contextual amarelo "Você está em PRODUÇÃO" no header de Safety (e idealmente em todas as rotas admin). **Severidade**: baixa, mas evita erros operacionais. **Ação**: PR futuro.

### UI7 — `/safety/integration` não menciona política de quotas
Snippets mostram a chamada mas não falam de rate limits ou quotas por tenant. **Severidade**: baixa.

## 6. Acessibilidade

- Tabelas semanticas (`<table>` com `<thead>`/`<tbody>`/`<tr>`).
- ⚠ Faltam labels ARIA nas células de severity/status (apenas spans coloridos com texto). Em screen-readers, o tom de cor não é lido. **Ação**: adicionar `aria-label` aos badges. Não nesta sessão.
- Links com `hover:underline` e tom de cor `text-primary` — contraste OK.

## 7. Risco operacional

| Cenário | Mitigação atual |
| --- | --- |
| Operador admin clica em alert e vê dado pessoal | Não acontece — só HMAC encurtado, severity, rule_code, etc. ✅ |
| Operador admin extrai lista para Excel e expõe externamente | UI mostra apenas counters e ids opacos; risco baixo |
| Operador admin cria override de regra que abre brechas | `safety-rules-write` força `tenant_id`, audita, e severity↔action invariant é validada server-side ✅ |
| UI exibe alert de outro tenant via URL fuzzing | RLS no Supabase + `requireTenantContext` no `app/(app)/safety/*/page.tsx` ✅ |

## 8. Veredito

- UI Safety está **operacionalmente segura** para HML.
- Antes de PROD: UI1, UI2, UI5 e UI6 endereçados.
- UI3, UI4, UI7 podem ser tratados em sprints subsequentes.
- **Sem ações executadas nesta sessão.**
