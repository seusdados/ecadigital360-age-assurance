# Backlog — AgeKey Parental Consent

## Ordem proposta de execução pós-MVP

### P1 — Provedor de OTP real

- Integração com provedor de email transacional (SendGrid, Resend, AWS SES).
- Integração com provedor de SMS (Twilio, AWS SNS).
- DPA assinada antes de ligar `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED`.
- Stub honesto removido — o digest persistido vira efetivo, com o OTP
  realmente enviado pelo canal.

### P1 — Rate limit progressivo

- `otp_attempts` >= 5 → bloqueio temporário no consent_request_id.
- Janela exponencial (10min → 1h → 24h).
- Auditoria do bloqueio em `audit_events`.

### P2 — Painel do responsável (`/parental`)

- Login via SSO de identidade (Google/Apple/Microsoft) ou link mágico
  derivado do contato verificado.
- Listar `parental_consents` ativos por `guardian_ref_hmac`.
- Botão de revogação por consentimento.
- Download de recibo minimizado (PDF com `consent_text`, `iat`, `exp`,
  `proof_hash`, `consent_text_hash`).

### P2 — Editor de texto versionado no painel admin

- CRUD em `consent_text_versions`.
- Preview lado a lado de Markdown.
- Diff entre versões.
- Workflow draft → published com aprovação por `admin`.

### P2 — Provider gateway (homologação)

- Adapter para provedores third-party de verificação parental
  (ex.: Veriff KYC for adults, Yoti Age Estimation, AssureID).
- Mapeamento de retornos para `assurance_level` canônico.
- Gate por `AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED`.

### P3 — SD-JWT VC profile

- Implementação real de SD-JWT VC para o consentimento (issuer = AgeKey,
  holder = responsável, verifier = relying party).
- Status list para revogação dinâmica.
- Test vectors do draft IETF correspondente.
- Detalhe em [`sd-jwt-vc-profile.md`](./sd-jwt-vc-profile.md).

### P3 — Step-up automático para risco alto

- Quando `risk_tier='high'` e o método disponível é apenas `otp_email`,
  redirecionar para um fluxo de step-up com prova adicional (ex.: SSO de
  ID provider que ateste responsabilidade).
- Sem KYC infantil — o step-up valida o RESPONSÁVEL, nunca o menor.

### P3 — Retention enforcement automatizado

- Plug das categorias `consent_*` em `supabase/functions/retention-job`.
- Hard delete em `guardian_verifications` após 24h pós-verified.
- Soft expire em `parental_consents` (status='expired') quando
  `expires_at < now()`.
- Trigger SQL `trg_parental_consents_fanout` enfileira
  `parental_consent.expired`.

### P4 — Relatórios regulatórios

- Export filtrado para LGPD ANPD (pedido formal).
- Export filtrado para GDPR DPA.
- Anchor de cada export em `audit_events` (`compliance.export_generated`).

### P4 — Webhook hardening

- Headers explícitos `X-AgeKey-Signature-Algorithm`,
  `X-AgeKey-Timestamp`, `X-AgeKey-Nonce`.
- Janela anti-replay de 5min server-side e cliente.
- Endpoint público de re-emissão de webhook deliveries.

### P4 — Multi-tenant guardian

- Permitir que um único guardian (`guardian_ref_hmac`) tenha
  consentimentos em vários tenants. **NÃO** correlacionar — apenas listar
  por canal verificado quando o login do responsável for federated.

## Itens explicitamente fora do roadmap

- Integração com cartórios brasileiros para "prova de filiação".
- Reconhecimento facial para validar responsável.
- Análise comportamental do responsável.
- Captura de IP geolocalizado preciso.
- Detecção de fraude por LLM cloud-based.
