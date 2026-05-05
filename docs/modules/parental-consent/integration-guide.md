# AgeKey Consent — Integration Guide

> Para integradores (`tenants`) que querem solicitar consentimento parental antes de habilitar um recurso para criança/adolescente.

## 1. Pré-requisitos

- Tenant ativo no AgeKey com `applications` configurada.
- `X-AgeKey-API-Key` server-side disponível.
- `policy_slug` que cobre o domínio `parental_consent` (ver `docs/specs/agekey-policy-engine-canonical.md`).
- Pelo menos uma `consent_text_version` ativa para o par `(policy, locale)` desejado.

## 2. Habilitação

A flag `AGEKEY_PARENTAL_CONSENT_ENABLED=true` deve estar configurada na infraestrutura AgeKey. **Default é `false`** — se a flag não estiver ligada, todas as Edge Functions de Consent rejeitam com `403 Forbidden`.

## 3. Fluxo do integrador

### 3.1 Criar solicitação

```ts
const resp = await fetch(`${AGEKEY_API_BASE}/parental-consent-session`, {
  method: 'POST',
  headers: {
    'X-AgeKey-API-Key': process.env.AGEKEY_API_KEY!,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    policy_slug: 'br-13-plus',
    resource: 'social-feed/post-creation',
    purpose_codes: ['account_creation', 'feed_personalization'],
    data_categories: ['nickname', 'preferences'],
    child_ref_hmac: hmacChildId('user-internal-uuid'), // HMAC interno do tenant
    locale: 'pt-BR',
  }),
});
const { consent_request_id, guardian_panel_url, guardian_panel_token, expires_at } =
  await resp.json();
```

> **`child_ref_hmac`** é uma referência opaca do tenant. Calcule HMAC-SHA256 do identificador interno usando um sal específico. **Nunca** envie e-mail, CPF ou nome civil aqui — o Privacy Guard rejeita.

### 3.2 Entregar o link ao responsável

O AgeKey **não envia** o link automaticamente. O tenant entrega via canal apropriado:

- e-mail próprio do tenant para o responsável já cadastrado no app cliente;
- SMS via provider do tenant;
- QR code exibido em loja física;
- impressão.

O link tem o formato:

```
https://panel.agekey.com.br/parental-consent/<consent_request_id>?token=<guardian_panel_token>
```

O token expira em 24h (configurável via `AGEKEY_PARENTAL_CONSENT_PANEL_TTL_SECONDS`).

### 3.3 Receber webhook

Configurar `webhook_endpoints` para subscrever:

- `parental_consent.approved`
- `parental_consent.denied`
- `parental_consent.revoked`

O payload segue o `AgeKeyWebhookPayload` canônico — ver `docs/specs/agekey-webhook-contract.md`.

### 3.4 Usar o `parental_consent_token`

Quando aprovado, o webhook `parental_consent.approved` carrega o `consent_token_id` (jti). O token JWT em si é entregue ao responsável na resposta de `/confirm`. Para o tenant obter o token, **uma das duas estratégias**:

- **(A)** Tenant requisita o token via `/token/verify` quando a integração precisa apresentar prova ao app;
- **(B)** Tenant guarda apenas o `consent_token_id` e usa-o como referência de prova lógica.

A estratégia (B) é a recomendada para a maioria dos casos — o tenant guarda `consent_token_id`, e quando o usuário (criança/adolescente) tenta acessar o recurso protegido, o tenant verifica que existe um consentimento ativo associado a `child_ref_hmac` no admin AgeKey.

### 3.5 Revogação

```ts
await fetch(`${AGEKEY_API_BASE}/parental-consent-revoke/${consent_id}`, {
  method: 'POST',
  headers: { 'X-AgeKey-API-Key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'tenant_admin_action' }),
});
```

A revogação dispara webhook `parental_consent.revoked` automaticamente.

## 4. Boas práticas

1. **Não persistir o `guardian_panel_token` em log.** Trate-o como segredo de curto prazo — válido apenas para o uso do responsável.
2. **Usar `child_ref_hmac` consistente** entre solicitações para o mesmo usuário. Isso permite ao admin AgeKey ver histórico do mesmo sujeito.
3. **Manter `consent_text_versions` versionadas** — qualquer mudança de finalidade exige nova versão (`policy_version` + `consent_text_version` novos).
4. **Reagir ao `parental_consent.revoked`** removendo acesso imediatamente. Consentimento revogado não tem grace period.

## 5. Limites do MVP

- Delivery de OTP via stub: produção exige integração com provider externo.
- Painel parental único — não suporta multi-responsável (apenas um responsável por solicitação).
- Sem renovação automática — quando consent expira, o tenant precisa criar nova solicitação.
- Sem suporte a SD-JWT VC do responsável (atrás de feature flag desligada).
