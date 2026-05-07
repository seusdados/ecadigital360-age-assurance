# Contrato público dos SDKs AgeKey

## Princípio

SDKs AgeKey são clientes finos. Eles não processam identidade civil, não guardam documento e não calculam idade. Eles abrem sessão, conduzem o fluxo e devolvem decisão/token.

## Operações mínimas

### createSession

Cria sessão AgeKey.

### completeSession

Completa sessão com método aceito.

### verifyToken

Valida token online.

### buildVerificationUrl

Monta URL para fluxo web seguro.

## Dados proibidos no SDK

- DOB;
- documento;
- selfie;
- nome;
- CPF/RG/passaporte;
- idade exata.

## Web

Prioridade comercial: SDK Web e widget, pois viabilizam integração rápida e demo.

## Mobile

SDKs nativos devem usar Custom Tabs/Safari/ASWebAuthenticationSession ou mecanismo equivalente. Evitar WebView opaca sempre que possível.

## Headers de webhook recebidos pelo SDK

A partir da rodada Core readiness alignment, entregas de webhook do AgeKey passam a incluir, **em paralelo** aos headers legados:

| Header | Significado |
|---|---|
| `X-AgeKey-Signature` (legado) | HMAC SHA-256 do raw body usando `sha256(raw_secret)` como chave. Continua sendo a assinatura **primária** validada por `registerWebhookHandler`. |
| `X-AgeKey-Webhook-Timestamp` | Epoch UTC em segundos no momento do envio. Receivers podem rejeitar fora da janela canônica de 5 minutos. |
| `X-AgeKey-Payload-Hash` | SHA-256 hex lowercase do raw body. Útil para idempotência e dedup de logs. |
| `X-AgeKey-Event-Id`, `X-AgeKey-Idempotency-Key` | Espelho do `X-AgeKey-Delivery-Id` legado, com nomes alinhados ao contrato canônico. |

A versão canônica completa do signer (`HMAC(${ts}.${nonce}.${body})`) está disponível em `@agekey/shared/webhooks` (`signWebhookPayload`, `verifyWebhookSignature`) — recomendada para receivers de Consent e Safety, e para futura migração do Core.

## Schemas opcionais alinhados ao Decision Envelope

`@agekey/shared` exporta:

- `ResultTokenClaimsCanonicalSchema` — schema do JWT com `decision_id`, `decision_domain`, `reason_codes` opcionais. Compatível com tokens existentes (que não carregam essas claims).
- `toCanonicalEnvelope(legacy)` — converte resposta legada de `session-complete`/`session-get` em `AgeKeyDecisionEnvelope` canônico para dashboards e integrações novas.
