# AgeKeySwift

Swift Package nativo para clientes iOS/macOS integrarem o AgeKey.

## Escopo

Este SDK não coleta documento, data de nascimento, selfie, nome civil ou idade exata. Ele apenas cria sessão, completa fallback quando permitido, monta URL de verificação e verifica token via API.

## Uso

```swift
let client = AgeKeyClient(
    config: AgeKeyConfig(
        apiKey: "ak_live_...",
        environment: .production
    )
)

let session = try await client.createSession(
    AgeKeyCreateSessionRequest(policySlug: "br-18-plus")
)

let verifyURL = AgeKeyVerificationURLBuilder().url(sessionId: session.sessionId)
```

## Validação

Antes de release, validar com:

```bash
cd sdk-mobile/ios/AgeKeySwift
swift test
```
