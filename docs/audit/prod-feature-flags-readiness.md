# PROD — Feature flags readiness (Consent / Safety / Credential / Proof)

> Documento companheiro de
> `docs/audit/prod-consent-safety-release-options.md`.
> Define **exatamente** quais env vars setar, com quais valores, em
> qual location (Vercel / Supabase Edge secrets / Postgres GUCs /
> tenant `applications`), antes/durante/depois de cada release.
> Data: 2026-05-07.
> Projeto-alvo: PROD `tpdiccnmsnjtjwhardij`.

## 0. Convenções

- **Default canônico**: o valor que `packages/shared/src/feature-
  flags/feature-flags.ts` retorna se a env var estiver ausente. Para
  todas as 6 flags conhecidas pelo runtime do shared, default = `false`.
- **Onde a flag é lida**:
  - **Edge runtime (Deno)**: lida via `Deno.env.get('AGEKEY_*')` no
    `feature-flags.ts` de `_shared/parental-consent` ou
    `_shared/safety`. Configurada via Supabase Edge Function secrets
    (`supabase secrets set --project-ref tpdiccnmsnjtjwhardij ...`).
  - **Next.js admin (Vercel)**: lida via `process.env.AGEKEY_*` em
    routes/server components. Configurada via Vercel
    `Environment Variables` (PROD env).
  - **Cron job (Postgres)**: a migration 028 lê `current_setting(
    'agekey.cron_secret', true)` — não é uma flag de produto, é um
    GUC do banco; configurar via `ALTER DATABASE postgres SET ...` ou
    Supabase Vault.
- **`isFlagOn(value)`** aceita: `'true'`, `'1'`, `true`. Tudo o resto
  conta como OFF.

## 1. Inventário das 10 flags pedidas

| # | Flag | Default | Lida em | Tipo |
|---|---|---|---|---|
| 1 | `AGEKEY_PARENTAL_CONSENT_ENABLED` | `false` | Edge + admin | gate de módulo Consent |
| 2 | `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED` | `false` (não declarada no shared; tratada como OFF) | Edge | gate sub-feature OTP guardian |
| 3 | `AGEKEY_SAFETY_SIGNALS_ENABLED` | `false` | Edge + admin | gate de módulo Safety |
| 4 | `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED` | `false` (sub-feature; não no shared) | Edge | classifier de conteúdo (não implementado no MVP) |
| 5 | `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED` | `false` (sub-feature; não no shared) | Edge | guarda de mídia (não implementado no MVP) |
| 6 | `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED` | `false` (sub-feature; não no shared) | Edge | Vault para evidence (MVP usa storage path) |
| 7 | `AGEKEY_CREDENTIAL_MODE_ENABLED` | `false` | Shared/Edge | gate de credential mode |
| 8 | `AGEKEY_SD_JWT_VC_ENABLED` | `false` | Shared | gate de SD-JWT VC real |
| 9 | `AGEKEY_PROOF_MODE_ENABLED` | `false` | Shared | gate de proof mode |
| 10 | `AGEKEY_ZKP_BBS_ENABLED` | `false` | Shared | gate de ZKP/BBS+ real |

> Flags 2, 4, 5, 6 não estão na lista canônica do
> `packages/shared/src/feature-flags/feature-flags.ts`
> (linhas 19–32). São sub-features ainda não implementadas/declaradas.
> Documento as inclui porque o prompt as nomeia explicitamente; tratar
> como **strings reservadas** que o runtime ignora hoje, mas que
> futuramente devem ser added ao shared antes de qualquer uso real.

## 2. Estado-alvo por opção

### 2.1. Opção A — Manter PROD como está

| Flag | Vercel (PROD) | Supabase Edge secrets | Justificativa |
|---|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `false` | `false` | Schema Consent ausente; ON quebraria runtime |
| `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED` | `false` | `false` | Sub-feature; permanece reservada |
| `AGEKEY_SAFETY_SIGNALS_ENABLED` | `false` | `false` | Schema Safety ausente |
| `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED` | `false` | `false` | Não implementado |
| `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED` | `false` | `false` | Não implementado |
| `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED` | `false` | `false` | Não implementado |
| `AGEKEY_CREDENTIAL_MODE_ENABLED` | `false` | `false` | Sem provider real |
| `AGEKEY_SD_JWT_VC_ENABLED` | `false` | `false` | Proibido — sem lib real |
| `AGEKEY_PROOF_MODE_ENABLED` | `false` | `false` | Sem provider |
| `AGEKEY_ZKP_BBS_ENABLED` | `false` | `false` | Proibido — sem lib real |

**Comandos de inspeção (read-only)**:

```bash
# Vercel
vercel env ls production

# Supabase Edge secrets
supabase secrets list --project-ref tpdiccnmsnjtjwhardij
```

**Comandos de configuração (não executar sem janela)**:

```bash
# Vercel
vercel env add AGEKEY_PARENTAL_CONSENT_ENABLED production  # responde: false
# (repetir para todas as 10)

# Supabase Edge secrets
supabase secrets set AGEKEY_PARENTAL_CONSENT_ENABLED=false \
  --project-ref tpdiccnmsnjtjwhardij
# (repetir para todas as 10)
```

### 2.2. Opção C — Aplicar Fase 2 (Consent: 020–023)

Antes da aplicação:

| Flag | Vercel | Edge secrets | Notas |
|---|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `false` | `false` | **Mantém OFF.** Será ON apenas dias após smoke verde + tenant piloto. |
| `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED` | `false` | `false` | OTP delivery é stub `noop`; nunca ON em PROD sem provider real. |

Demais flags inalteradas relativamente à Opção A.

Após aplicação + 7 dias de observação + tenant piloto contratualmente
ativo + provider OTP real configurado, **considerar**:

- `AGEKEY_PARENTAL_CONSENT_ENABLED=true` apenas se:
  - tenant piloto tem consent flow desejado;
  - provider OTP (Twilio/SMTP/Auth) configurado e testado em HML;
  - rollback plan reafirmado (basta voltar a flag para `false`).
- `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED=true` somente após teste real
  do provider em HML com entrega confirmada.

> **Nunca** ativar `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED=true` enquanto
> o provider for o stub `noop` (que retorna OTP em log de dev).

### 2.3. Opção D — Aplicar Fase 3 (Safety: 024–027)

Antes da aplicação:

| Flag | Vercel | Edge secrets | Notas |
|---|---|---|---|
| `AGEKEY_SAFETY_SIGNALS_ENABLED` | `false` | `false` | Mantém OFF; ON após smoke + tenant piloto Safety. |
| `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED` | `false` | `false` | **Não ativar.** Não há classifier no MVP. |
| `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED` | `false` | `false` | **Não ativar.** Não implementado. |
| `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED` | `false` | `false` | **Não ativar.** Vault para evidence virá em rodada futura. |

Após aplicação + observação + tenant piloto:

- `AGEKEY_SAFETY_SIGNALS_ENABLED=true` quando tenant piloto contratado
  e SDK do tenant integrado.
- Demais sub-features Safety **permanecem OFF** até implementação real
  em rodadas futuras.

### 2.4. Opção E — Aplicar Fase 4 (Retention: 028–030)

Fase 4 não muda flags de produto. **Mantém todas as 10 flags como em
C+D.** Adiciona, porém, **GUCs de banco** para o cron:

| GUC | Localização | Valor |
|---|---|---|
| `agekey.retention_job_url` | `ALTER DATABASE postgres SET ...` | `https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/retention-job` |
| `agekey.cron_secret` | idem | valor secreto que casa com Bearer aceito pelo edge function |

**Comandos (planejados, não executar)**:

```sql
-- Como superuser/postgres no SQL Editor:
ALTER DATABASE postgres SET agekey.retention_job_url
  = 'https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/retention-job';
ALTER DATABASE postgres SET agekey.cron_secret
  = '<obtido de supabase secrets list>';
-- Sessões novas pegam essas GUCs; o cron job inicia sessão própria.
```

> **Hardening posterior**: migrar para `vault.secrets.cron_secret` +
> `vault.decrypted_secrets` em vez de GUC pura. Fora de escopo desta
> opção; documentado como rodada futura.

## 3. Flags em outros lugares (referência)

### 3.1. Default canônico (build-time)

`packages/shared/src/feature-flags/feature-flags.ts`:

```ts
export const FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  AGEKEY_CREDENTIAL_MODE_ENABLED: false,
  AGEKEY_SD_JWT_VC_ENABLED: false,
  AGEKEY_PROOF_MODE_ENABLED: false,
  AGEKEY_ZKP_BBS_ENABLED: false,
  AGEKEY_SAFETY_SIGNALS_ENABLED: false,
  AGEKEY_PARENTAL_CONSENT_ENABLED: false,
};
```

### 3.2. Mapeamento para reason codes (curto-circuito)

```ts
export const FLAG_DENY_REASON_CODES: Record<FeatureFlagKey, string> = {
  AGEKEY_CREDENTIAL_MODE_ENABLED: 'CREDENTIAL_FEATURE_DISABLED',
  AGEKEY_SD_JWT_VC_ENABLED: 'CREDENTIAL_FEATURE_DISABLED',
  AGEKEY_PROOF_MODE_ENABLED: 'ZKP_FEATURE_DISABLED',
  AGEKEY_ZKP_BBS_ENABLED: 'ZKP_FEATURE_DISABLED',
  AGEKEY_SAFETY_SIGNALS_ENABLED: 'SYSTEM_INVALID_REQUEST',
  AGEKEY_PARENTAL_CONSENT_ENABLED: 'SYSTEM_INVALID_REQUEST',
};
```

### 3.3. Tenant-level overrides (futuro)

`policies` (criada em 002) tem `policy_versions` JSONB com bloco
`feature_flags` planejado para overrides per-tenant. **Não implementado
no MVP.** Hoje, toda decisão de flag é global, controlada por env var.

## 4. Estado-alvo final, agregado

A tabela abaixo é o **target absoluto após Opções A → C → D → E,
sem ainda ativar nada para tráfego real** (i.e., todos os módulos
deployados, todas as flags OFF, smoke tests verdes):

| Flag | Vercel PROD | Edge secrets PROD | Default canônico |
|---|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `false` | `false` | `false` |
| `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED` | `false` | `false` | (não declarada) |
| `AGEKEY_SAFETY_SIGNALS_ENABLED` | `false` | `false` | `false` |
| `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED` | `false` | `false` | (não declarada) |
| `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED` | `false` | `false` | (não declarada) |
| `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED` | `false` | `false` | (não declarada) |
| `AGEKEY_CREDENTIAL_MODE_ENABLED` | `false` | `false` | `false` |
| `AGEKEY_SD_JWT_VC_ENABLED` | `false` | `false` | `false` |
| `AGEKEY_PROOF_MODE_ENABLED` | `false` | `false` | `false` |
| `AGEKEY_ZKP_BBS_ENABLED` | `false` | `false` | `false` |

E as GUCs de banco (apenas após Opção E):

| GUC | Valor |
|---|---|
| `agekey.retention_job_url` | URL do edge function `retention-job` |
| `agekey.cron_secret` | Bearer secret que casa com edge function |

## 5. Como ativar (futuro, fora deste documento)

1. Smoke tests pós-aplicação verdes em PROD por ≥ 7 dias.
2. Tenant piloto contratualmente liberado para o módulo (Consent
   e/ou Safety).
3. Provider real configurado:
   - Consent: provider OTP real (não `noop`).
   - Safety: SDK do tenant integrado.
4. Mudar **uma** flag por vez:
   - Vercel `AGEKEY_PARENTAL_CONSENT_ENABLED=true` → redeploy.
   - Edge secrets `supabase secrets set AGEKEY_PARENTAL_CONSENT_
     ENABLED=true --project-ref tpdiccnmsnjtjwhardij` → reload de
     edge functions automático.
5. Smoke tests funcionais em PROD com tenant piloto.
6. Repetir para Safety quando aplicável.
7. **Nunca** ativar SD-JWT VC, ZKP/BBS+, content analysis, media
   guard, evidence vault sem implementação real e validação dedicada.

## 6. Pendências e armadilhas

- `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED`, `AGEKEY_SAFETY_CONTENT_
  ANALYSIS_ENABLED`, `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED`,
  `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED` ainda não estão na lista
  canônica do `packages/shared/src/feature-flags/feature-flags.ts`.
  Antes de qualquer ativação real, **adicionar à lista canônica** com
  default `false` e respectivo reason code, e cobrir com tests.
- Discrepância entre Vercel env e Edge secrets é silenciosa — ambos
  precisam estar consistentes. Recomenda-se script/script de
  verificação em runbook.
- O caminho de hot-reload de Edge Function em Supabase é
  observado: ao mudar secret, redeploy não é estritamente necessário,
  mas testar imediatamente após mudança.

## 7. Anexos cruzados

- `packages/shared/src/feature-flags/feature-flags.ts` — lista
  canônica + defaults + reason codes.
- `supabase/functions/_shared/parental-consent/feature-flags.ts` —
  leitura no Edge runtime (Consent).
- `supabase/functions/_shared/safety/feature-flags.ts` — leitura no
  Edge runtime (Safety).
- `docs/audit/prod-consent-safety-release-options.md`.
- `docs/audit/prod-release-go-no-go-checklist.md`.
- `docs/audit/prod-rollback-playbook-consent-safety.md`.
