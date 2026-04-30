# agekey-android

SDK Android nativo para integração com AgeKey.

## Escopo

O SDK cria sessão, completa fallback quando permitido, verifica token e abre o fluxo web seguro por Custom Tabs. Ele não coleta documento, selfie, data de nascimento, nome civil ou idade exata.

## Uso

```kotlin
val client = AgeKeyClient(
    AgeKeyConfig(
        apiKey = "ak_live_...",
        environment = AgeKeyEnvironment.Production
    )
)

val session = client.createSession(
    AgeKeyCreateSessionRequest(policySlug = "br-18-plus")
)

AgeKeyFlowLauncher().launch(context, session.sessionId)
```

## Validação

```bash
cd sdk-mobile/android/agekey-android
./gradlew test
```
