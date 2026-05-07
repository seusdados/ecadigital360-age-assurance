# AgeKey Safety Signals — Visão geral

> Módulo MVP entregue na Rodada 4.
> Base canônica: `packages/shared/src/safety/`.
> Migration: `supabase/migrations/019_safety_signals.sql`.
> Edge Functions: `supabase/functions/safety-*`.

## O que este módulo é

AgeKey Safety Signals é uma **camada de sinais de risco apenas em
metadados**, voltada para sinalizar interações sensíveis envolvendo
menores numa plataforma cliente. Cada evento traz **só metadados**
(faixa etária, tipo de canal, frequência, hashes opacos) e o motor de
regras canônico devolve uma decisão proporcional: aprovado, exigir
re-verificação etária, exigir consentimento parental, soft block, hard
block, revisão humana.

## O que este módulo NÃO é

- ❌ Não é interceptação de comunicações.
- ❌ Não é vigilância parental.
- ❌ Não é spyware.
- ❌ Não é KYC.
- ❌ Não é detector automático de crimes.
- ❌ Não é moderador autônomo.
- ❌ Não é reconhecimento facial nem biometria.
- ❌ Não é emotion recognition.
- ❌ Não é captura de tráfego TLS.
- ❌ Não é análise de dispositivo fora da aplicação cliente.
- ❌ Não cria score universal cross-tenant.

## Anatomia rápida

| Camada | Localização |
|---|---|
| Schemas Zod / engine puro | `packages/shared/src/safety/` |
| Tabelas Postgres + RLS + triggers | `supabase/migrations/019_safety_signals.sql` |
| Edge Functions (Deno) | `supabase/functions/safety-*/` |
| Painel administrativo | `apps/admin/app/(app)/safety/page.tsx` |
| SDK helper (server-side) | `packages/sdk-js/src/safety.ts` |
| Reason codes promovidos | `packages/shared/src/reason-codes.ts` |
| Eventos de webhook | `packages/shared/src/webhooks/webhook-types.ts` |
| Testes vitest | `packages/shared/src/safety/*.test.ts` |
| Testes Deno | `supabase/functions/_tests/safety-envelope.test.ts` |

## Garantias

1. **METADATA-ONLY**: a borda de ingest (Zod literal +
   `rejectForbiddenIngestKeys` + CHECK SQL) bloqueia `message`,
   `raw_text`, `image`, `video`, `audio`, etc.
2. **Sem PII**: privacy guard canônico em toda saída pública.
3. **Sem score universal**: `safety_subjects.risk_score` é por-tenant +
   por-aplicação; nunca cross-tenant.
4. **Hash discipline**: actor / counterparty / ip / device viram HMAC
   por-tenant (mesmo helper do Consent).
5. **Append-only em `safety_events`**: UPDATE/DELETE bloqueados por
   trigger; revogação efetiva via partição em P3.
6. **Step-up via Core**: `safety-step-up` cria
   `verification_session` canônica; sem fluxo paralelo de KYC.
7. **Consent interlock**: quando uma regra exigir consentimento
   parental, a edge function emite `safety.parental_consent_check_required`
   e a relying party encaminha via módulo Consent existente.

## Arquivos relacionados

- [PRD](./PRD.md)
- [Modelo de dados](./DATA_MODEL.md)
- [Contrato de API](./API_CONTRACT.md)
- [Taxonomia](./TAXONOMY.md)
- [Privacy guard](./PRIVACY_GUARD.md)
- [RLS e segurança](./RLS_AND_SECURITY.md)
- [Retention](./RETENTION.md)
- [Governança de IA / modelos](./AI_GOVERNANCE.md)
- [Frontend spec](./FRONTEND_SPEC.md)
- [Edge Functions](./EDGE_FUNCTIONS.md)
- [Backlog](./IMPLEMENTATION_BACKLOG.md)
- [Conformidade](./COMPLIANCE_NOTES.md)
