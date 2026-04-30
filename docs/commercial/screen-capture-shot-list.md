# AgeKey — Screen capture shot list

This file is the master list of screen captures the operator should
collect from a **real, running** AgeKey instance for use in
commercial decks, sales calls, public docs and onboarding material.

> **Hard rules**
>
> - Capture from a real environment (staging or a dedicated demo
>   tenant). Never invent a screen or paste a Figma mockup as if it
>   were the product.
> - If a screen does not exist yet, mark it as "tela indisponível"
>   in the deck and skip — do not fabricate.
> - Use a demo tenant with synthetic, clearly-non-PII data only
>   (`Tenant Demo AgeKey`, `external_user_ref = demo_<n>`,
>   `policy_slug = demo-18-plus`).
> - Do **NOT** capture screens that contain real customer or real
>   end-user data even by accident. Use a fresh demo tenant.
> - Gemini / image-touch-up pipeline (see
>   `docs/commercial/gemini-screen-capture-instructions.md`) is
>   permitted to: crop, dehighlight cursor, blur trace_ids, add
>   subtle drop-shadow. It is **NOT** permitted to: invent UI,
>   change labels, change values, fabricate decisions, replace
>   logos, or generate fictitious tenants.

---

## How to use this file

1. Spin up a demo tenant in staging.
2. Seed: 1 application, 1-3 policies, 5-10 sessions across
   `approved | denied | needs_review`, 1 issuer, sample webhook
   endpoint.
3. Take screenshots in order below.
4. Run them through the Gemini pipeline (only the operations above).
5. Paste captioned screenshots into the deck.

---

## Shot list

### S-01 — Login

- **Objetivo comercial:** mostrar entrada limpa e profissional.
- **Preparação de dados:** logout state da SUA conta admin de demo.
- **Tela:** `https://app.agekey.com.br/login` (ou preview Vercel
  staging).
- **Prompt para Gemini:** "Crop a 16:9 ratio, keep the AgeKey
  wordmark visible, blur any background console output if visible.
  Do not change the form labels."
- **Legenda sugerida:** "Painel AgeKey — entrada via SSO Supabase
  Auth, sem exposição de credenciais."

### S-02 — Onboarding (primeiros passos do tenant)

- **Objetivo comercial:** mostrar onboarding atomic flow (PR #15).
- **Preparação:** criar tenant novo ou redefinir flag `onboarded=false`.
- **Tela:** `/(app)/onboarding` em estado inicial.
- **Prompt Gemini:** "Crop, keep step indicator visible. No PII in
  the form fields — replace with `Demo Tenant` string if needed."
- **Legenda:** "Onboarding em fluxo atômico — tenant + application
  + policy criados de uma vez."

### S-03 — Dashboard / overview

- **Objetivo:** mostrar KPIs no estado real.
- **Preparação:** ter ao menos 5 sessions com decisões variadas no
  últimos 7 dias.
- **Tela:** `/(app)/` ou `/(app)/dashboard`.
- **Prompt Gemini:** "Crop. Do NOT alter chart values. Replace any
  tenant id / trace id in the corner with `demo-…` placeholder."
- **Legenda:** "Dashboard AgeKey — métricas de decisão e assurance,
  sem PII por construção."

### S-04 — Applications list

- **Objetivo:** mostrar gestão de applications.
- **Preparação:** 2-3 applications, sendo uma com `Active` e uma
  com `Suspended`.
- **Tela:** `/(app)/applications`.
- **Legenda:** "Cada cliente do tenant gerencia suas applications
  e API keys com revelação única (reveal-once)."
- **Cuidado:** API keys devem aparecer mascaradas (`ak_live_••••`).

### S-05 — Application detail / rotate key

- **Objetivo:** mostrar reveal-once de API key.
- **Preparação:** clicar Rotate, capturar tela com chave nova
  exibida com banner "esta chave aparecerá apenas uma vez".
- **Tela:** `/(app)/applications/[id]` com modal aberto.
- **Cuidado:** chave deve ser de demo (`ak_test_demo_...`); jamais
  vazar uma `ak_live_*` real.
- **Legenda:** "Rotação de API key com revelação única — segredo
  nunca é re-exibido."

### S-06 — Criação / edição de policy

- **Objetivo:** mostrar policy editor com `MethodPriorityEditor`.
- **Preparação:** abrir form de criação (`/policies/new`) ou edit
  de uma policy demo.
- **Tela:** `/(app)/policies/[id]/edit` ou `/policies/new`.
- **Cuidado:** após o fix de a11y desta branch, o
  `MethodPriorityEditor` mostra `data-invalid` apenas em estado
  inválido. Capturar dois estados: válido e inválido.
- **Legenda:** "Policy editor — define `age_threshold`,
  `method_priority`, `assurance_level`, `token_ttl_seconds`."

### S-07 — Verifications list

- **Objetivo:** mostrar feed de sessões.
- **Preparação:** ao menos 10 sessões com mix de decisões.
- **Tela:** `/(app)/verifications`.
- **Cuidado:** colunas devem mostrar `session_id` (curto),
  `decision`, `method`, `assurance_level`, `created_at`,
  `external_user_ref` (mascarado). NUNCA `birthdate`, `document`,
  `name`.
- **Legenda:** "Lista de verificações — auditável por session_id,
  reason_code, jti."

### S-08 — Verification detail

- **Objetivo:** mostrar detalhe sem PII.
- **Preparação:** uma sessão `approved` recente.
- **Tela:** `/(app)/verifications/[id]`.
- **Cuidado:** confirmar que aparecem `decision`, `reason_code`,
  `assurance_level`, `method`, `policy.version`, `issuer_did`,
  `artifact_hash`, `jti`, e NÃO `birthdate`/`document`/`selfie`.
- **Legenda:** "Detalhe de verificação — auditável sem identidade
  civil. `external_user_ref` é referência opaca do cliente."

### S-09 — Issuers list / register

- **Objetivo:** mostrar trust registry.
- **Preparação:** 1-2 issuers cadastrados (ex.: um issuer demo
  Wallet, um gateway demo).
- **Tela:** `/(app)/issuers` e `/(app)/issuers/new`.
- **Legenda:** "Trust registry — issuers/wallets/gateways
  homologados com DID + JWKS."

### S-10 — Audit log

- **Objetivo:** mostrar event timeline.
- **Tela:** `/(app)/audit`.
- **Cuidado:** filtros por `actor_type`, `target`, intervalo. Não
  capturar logs de produção real.
- **Legenda:** "Audit append-only com `trace_id` e `actor`. Sem
  PII do titular."

### S-11 — Billing / usage

- **Objetivo:** mostrar contadores de billing por método.
- **Tela:** `/(app)/billing`.
- **Legenda:** "Billing por evento (`session_completed`) e por
  método. Cobrança previsível."

### S-12 — Settings / API keys / branding

- **Objetivo:** mostrar self-service.
- **Tela:** `/(app)/settings/{team,branding,api}`.
- **Cuidado:** API keys mascaradas; logo demo no preview.
- **Legenda:** "Settings — branding white-label e gestão de API
  keys self-service."

### S-13 — Widget demo (se disponível)

- **Objetivo:** mostrar `<agekey-verify>` em iframe sandboxed.
- **Tela:** `apps/widget-demo` (rota interna) ou
  `verify.agekey.com.br/<sessionId>` em sessão demo.
- **Cuidado:** mostrar todos os 3 estágios (intro, consent,
  método). NUNCA capturar fluxo com PII real.
- **Legenda:** "Widget embed — Web Component sandboxed,
  postMessage com origin allowlist."

### S-14 — JWKS endpoint

- **Objetivo:** mostrar contrato público.
- **Tela:** browser em
  `https://api.agekey.com.br/.well-known/jwks.json` (ou Edge
  Function direto se proxy não estiver montado).
- **Cuidado:** apenas `kid`, `kty`, `crv`, `x`, `y`, `use`, `alg`.
  NUNCA `d` (private). Esse é um teste defensivo: se aparecer
  `d`, a captura mostra um bug, não um feature.
- **Legenda:** "JWKS público — somente chaves públicas, rotação
  cron, kid estável."

### S-15 — Token verify response

- **Objetivo:** mostrar contract público de validação.
- **Tela:** Postman / curl colando um token JWT válido em
  `/verifications-token-verify`.
- **Cuidado:** payload de resposta exibido com `valid`,
  `claims.agekey.{decision, threshold_satisfied, age_threshold,
  method, assurance_level, reason_code, policy, tenant_id,
  application_id}`. NUNCA com `birthdate`/`age`/`name`.
- **Legenda:** "Validação de token — contrato auditável, claims
  minimizadas."

---

## Pós-produção

- Salvar originais em `docs/commercial/screens/originals/` (não
  versionados; gitignore `screens/`).
- Salvar versões pós-Gemini em `docs/commercial/screens/published/`.
- Cada slide cita o ID da captura (S-01..S-15) na legenda em PT-BR
  e EN.
- Atualizar `docs/commercial/screen-capture-shot-list.md`
  (este arquivo) toda vez que uma rota da admin muda nome / layout.
