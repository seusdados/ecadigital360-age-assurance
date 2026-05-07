# AgeKey Parental Consent — Visão geral

> Módulo MVP entregue na Rodada 3.
> Base canônica: `packages/shared/src/consent/`.
> Migration: `supabase/migrations/018_parental_consent.sql`.
> Edge Functions: `supabase/functions/parental-consent-*`.

## O que este módulo é

O AgeKey Parental Consent é uma **camada de consentimento parental
auditável** que se conecta ao núcleo de age assurance. Ele permite que uma
plataforma (relying party):

1. Crie um **pedido de consentimento** vinculado a um recurso, finalidade e
   categoria de dados.
2. **Convide um responsável legal** por canal verificável (e-mail, telefone,
   conta de escola ou conta federada).
3. **Verifique o canal** com código único (OTP) e registre o aceite com
   versão de texto rastreável.
4. **Emita um token de consentimento minimizado** (JWS assinado com a mesma
   chave do AgeKey Core) que a plataforma apresenta ao backend para liberar
   o recurso protegido.
5. **Revogue, expire ou substitua** o consentimento de forma auditável.

## O que este módulo NÃO é

- Não é um sistema de KYC infantil.
- Não armazena documento civil, CPF, RG, passaporte, nome civil, foto,
  selfie, biometria, data de nascimento ou idade exata.
- Não atua como identificador universal entre tenants.
- Não promete prova absoluta de filiação.

O AgeKey Consent declara apenas que **um responsável legalmente declarado
verificou o canal apresentado e aceitou o texto de consentimento na versão
exibida**, mantendo um recibo criptografado mínimo.

## Anatomia rápida

| Camada | Localização |
|---|---|
| Schemas Zod / engine puro | `packages/shared/src/consent/` |
| Tabelas Postgres + RLS + triggers | `supabase/migrations/018_parental_consent.sql` |
| Edge Functions (Deno) | `supabase/functions/parental-consent-*/` |
| Painel administrativo | `apps/admin/app/(app)/consent/page.tsx` |
| Página de aterrissagem do responsável | `apps/admin/app/parental-consent/[id]/page.tsx` |
| Reason codes promovidos | `packages/shared/src/reason-codes.ts` |
| Eventos de webhook | `packages/shared/src/webhooks/webhook-types.ts` |
| Testes vitest | `packages/shared/src/consent/*.test.ts` |
| Testes Deno | `supabase/functions/_tests/consent-envelope.test.ts` |

## Garantias

1. **Privacy guard sempre presente.** Toda saída pública passa por
   `assertPublicPayloadHasNoPii` antes de ser enviada.
2. **Sem PII em token, webhook ou audit_diff.** Apenas hashes HMAC e SHA-256.
3. **Sem chave universal.** Cada `subject_ref_hmac`/`guardian_ref_hmac` é
   derivado da chave HMAC por-tenant; um token vazado de um tenant não
   permite correlação no outro.
4. **Texto versionado.** O token referencia o `body_hash` da versão exata
   que o responsável aceitou.
5. **Revogação imutável.** `parental_consent_revocations` é APPEND-ONLY.
6. **RLS em toda tabela multi-tenant.** Service-role apenas server-side.

## Arquivos relacionados

- [PRD](./prd.md)
- [Arquitetura](./architecture.md)
- [Modelo de dados](./data-model.md)
- [API](./api.md)
- [Segurança](./security.md)
- [Privacidade por design](./privacy-by-design.md)
- [Evidência de auditoria](./audit-evidence.md)
- [Copy de UX (PT-BR)](./ux-copy.md)
- [Backlog](./backlog.md)
- [Perfil SD-JWT VC futuro](./sd-jwt-vc-profile.md)
