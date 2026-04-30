# agekey-android — Reference Implementation

SDK Android nativo para integração com AgeKey, em Kotlin.

> ⚠️ **Status: Reference Implementation, ainda não validada.**
> Esta biblioteca foi escrita para servir de referência de contrato e
> tipos. Ela **não** foi compilada em Android Studio real, **não** foi
> testada em emulador ou device, **não** foi publicada no Maven
> Central nem em JitPack, e **não** foi auditada quanto a segurança
> (Network Security Config, certificate pinning, R8/ProGuard rules).
> Antes de qualquer go-live, o engenheiro Android responsável precisa:
>
> 1. Abrir o projeto em Android Studio Hedgehog+ e validar build/test.
> 2. Rodar `./gradlew :agekey:test :agekey:lint`.
> 3. Validar em emulador (API 26+) e device físico.
> 4. Decidir entre `Custom Tabs` (recomendado) ou `WebView` para o
>    fluxo web.
> 5. Documentar limitações conhecidas em
>    `docs/implementation/pending-work-backlog.md`.

---

## Escopo de privacidade

O SDK não coleta documento, selfie, data de nascimento, nome civil ou
idade exata. Ele apenas:

- monta a URL de verificação web,
- abre Custom Tabs / Browser,
- recebe `AgeKeyResult` via deep link (Activity Intent Filter),
- valida token via API quando solicitado.

Conforme `docs/specs/sdk-public-contract.md`, qualquer payload do SDK
está sujeito ao mesmo contrato de privacidade que o backend
AgeKey — nenhum claim PII pode trafegar ou ser persistido.

---

## ⚠️ Modelo de segurança — IMPORTANTE

Igual ao SDK Web, a `apiKey` do AgeKey (`ak_*`) **é segredo do tenant**
e **não pode** ser embutida no APK/AAB. Strings em apps Android são
trivialmente extraídas com `apktool` ou class-dump. O fluxo seguro:

```
┌─────────────┐  1. /verify/start  ┌────────────────┐
│ App Android │ ──────────────────▶│  Seu Backend   │
│ (SDK)       │                    │ (AgeKeyServer) │
└──────┬──────┘                    └────────┬───────┘
       │                                     │
       │  2. SessionCreateResponse           │
       │ ◀───────────────────────────────────┘
       │
       │  3. Abre web flow via Custom Tabs:
       │     verify.agekey.com.br/<sessionId>
       │
       │  4. Web flow → deep link de retorno:
       │     myapp://agekey/return?session_id=...&token=...
       │
       │  5. POST /verify/finalize  com token
       ▶  ──▶ Seu backend valida via AgeKeyServer.verifyToken
```

A versão atual de `AgeKeyClient.kt` aceita `apiKey` em `AgeKeyConfig` —
isso é parte da **reference implementation insegura** e deve ser
removido em v0.1, substituído por `sessionToken` curto.

---

## Instalação (planejado)

Via Gradle, em `settings.gradle.kts` ou no module:

```kotlin
// settings.gradle.kts (planejado)
dependencyResolutionManagement {
    repositories {
        // Maven Central — ainda não publicado
        mavenCentral()
    }
}

// app/build.gradle.kts (planejado)
dependencies {
    implementation("com.ecadigital.agekey:agekey:0.1.0")
}
```

> **Nota:** ainda não há artefato publicado. Por enquanto o módulo
> vive em `sdk-mobile/android/agekey-android` no monorepo AgeKey e
> deve ser linkado como `includeBuild` ou copiado para o app.

---

## Uso de referência (insecure — somente exemplo)

```kotlin
import com.ecadigital.agekey.AgeKeyClient
import com.ecadigital.agekey.AgeKeyConfig
import com.ecadigital.agekey.AgeKeyEnvironment
import com.ecadigital.agekey.AgeKeyFlowLauncher

val client = AgeKeyClient(
    AgeKeyConfig(
        apiKey = "ak_live_...",          // ⚠️ apenas reference;
                                         //    não use em produção mobile
        environment = AgeKeyEnvironment.Production
    )
)

val session = client.createSession(
    AgeKeyCreateSessionRequest(policySlug = "br-18-plus")
)

AgeKeyFlowLauncher().launch(context, session.sessionId)
```

Receber o resultado via deep link (planejado): registrar uma Activity
em `AndroidManifest.xml` com intent filter para o esquema `myapp://`,
ler `session_id` e `token` da URI e devolver para o backend do app.

## Uso seguro (planejado, v0.1)

```kotlin
import com.ecadigital.agekey.AgeKeyWebFlow

// 1) App pede ao SEU backend para criar a sessão.
val session = myBackend.startAgeKeySession()

// 2) Abre Custom Tabs.
val result = AgeKeyWebFlow.start(
    activity = this,
    sessionId = session.sessionId,
    redirectUri = "myapp://agekey/return"
)

// 3) Manda o token ao SEU backend para validação server-side.
myBackend.finalizeAgeKey(token = result.token)
```

---

## Validação local (após instalar Android Studio)

```bash
cd sdk-mobile/android/agekey-android
./gradlew :agekey:test
./gradlew :agekey:lint
./gradlew :agekey:assembleRelease
```

Antes de CI ou release, validar em Android Studio:

- compilar com `-Werror` Kotlin,
- rodar Detekt e Android Lint,
- testar API 26 / 30 / 34,
- validar deep link em device físico,
- adicionar regras R8/ProGuard.

---

## Limitações conhecidas

- API key embutida em `AgeKeyConfig` (anti-pattern; a remover em v0.1).
- Sem certificate pinning / Network Security Config customizada.
- Sem publicação Maven Central / JitPack.
- Não validado em Android Studio nem em CI.
- Sem regras R8/ProGuard.
- Sem suporte oficial a Custom Tabs ainda — ver
  `AgeKeyFlowLauncher.kt` para o esqueleto atual.

---

## Licença

Apache-2.0 (planejado, ainda não publicado).
