# AgeKeySwift — Reference Implementation

Swift Package nativo para clientes iOS/macOS integrarem o AgeKey.

> ⚠️ **Status: Reference Implementation, ainda não validada.**
> Esta biblioteca foi escrita para servir de referência de contrato e
> tipos. Ela **não** foi compilada em Xcode real, **não** foi validada
> em device físico ou simulador, **não** foi publicada no Swift Package
> Index nem em CocoaPods, e **não** foi auditada quanto a segurança de
> rede (App Transport Security, certificate pinning, etc.). Antes de
> qualquer go-live, o engenheiro iOS responsável precisa:
>
> 1. Abrir o `Package.swift` em Xcode 15+ e validar build/test reais.
> 2. Rodar `swift test` no projeto.
> 3. Validar comportamento em iOS 16+ via simulador e device.
> 4. Decidir entre `ASWebAuthenticationSession` (recomendado) ou
>    `SFSafariViewController` para o fluxo web.
> 5. Documentar limitações conhecidas em
>    `docs/implementation/pending-work-backlog.md`.

---

## Escopo de privacidade

O SDK não coleta documento, data de nascimento, selfie, nome civil ou
idade exata. Ele apenas:

- monta a URL de verificação web (`verify.agekey.com.br/<sessionId>`),
- recebe o `AgeKeyResult` via deep link,
- consulta token via API quando solicitado.

Conforme `docs/specs/sdk-public-contract.md`, qualquer payload do SDK
está sujeito ao mesmo contrato de privacidade que o backend
AgeKey — nenhum claim PII pode trafegar ou ser persistido.

---

## ⚠️ Modelo de segurança — IMPORTANTE

Igual ao SDK Web, a `apiKey` do AgeKey (`ak_*`) **é segredo do tenant**
e **não pode** ser embutida no bundle do app iOS. Apps mobile vazam
strings facilmente via class-dump/Hopper. O fluxo seguro:

```
┌─────────┐   1. /verify/start    ┌────────────────┐
│ App iOS │ ───────────────────▶  │  Seu Backend   │
│ (SDK)   │                       │  (AgeKeyServer)│
└────┬────┘                       └────────┬───────┘
     │                                      │
     │  2. SessionCreateResponse            │
     │ ◀────────────────────────────────────┘
     │
     │  3. Abre web flow via ASWebAuthenticationSession
     │      ─▶ verify.agekey.com.br/<sessionId>
     │
     │  4. Web flow retorna AgeKeyResult via deep link
     │      ─▶ myapp://agekey/return?session_id=...&token=...
     │
     │  5. POST /verify/finalize  com token
     ▶  ──▶ Seu backend valida via AgeKeyServer.verifyToken
```

A versão atual do `AgeKeyClient.swift` aceita um `apiKey` no `config` —
isso é parte da **reference implementation insegura** e deve ser
removido em v0.1, substituído por um `sessionToken` curto recebido do
backend do app.

---

## Instalação (planejado)

Via Swift Package Manager, em `Package.swift` do app:

```swift
dependencies: [
    .package(url: "https://github.com/seusdados/agekey-swift.git", from: "0.1.0"),
],
```

> **Nota:** o repositório `agekey-swift` ainda não existe. Por
> enquanto o pacote vive em `sdk-mobile/ios/AgeKeySwift` no monorepo
> AgeKey e deve ser linkado localmente:
>
> ```swift
> dependencies: [
>     .package(path: "../ecadigital360-age-assurance/sdk-mobile/ios/AgeKeySwift"),
> ],
> ```

---

## Uso de referência (insecure — somente exemplo)

```swift
import AgeKeySwift

let client = AgeKeyClient(
    config: AgeKeyConfig(
        apiKey: "ak_live_...",            // ⚠️ apenas para reference;
                                          //   não use em produção mobile
        environment: .production
    )
)

let session = try await client.createSession(
    AgeKeyCreateSessionRequest(policySlug: "br-18-plus")
)

let verifyURL = AgeKeyVerificationURLBuilder().url(sessionId: session.sessionId)

// Recomendado: ASWebAuthenticationSession com callbackURLScheme = myapp
// e listener no AppDelegate / SceneDelegate para o deep link de retorno.
```

## Uso seguro (planejado, v0.1)

```swift
import AgeKeySwift

// 1) App pede ao SEU backend (não AgeKey direto) para criar a sessão.
let session = try await myBackend.startAgeKeySession()

// 2) Abre o web flow.
let result = try await AgeKeyWebFlow.start(
    sessionId: session.sessionId,
    redirectURI: "myapp://agekey/return"
)

// 3) Manda o token ao SEU backend para validação server-side.
try await myBackend.finalizeAgeKey(token: result.token)
```

---

## Validação local (após instalar Xcode)

```bash
cd sdk-mobile/ios/AgeKeySwift
swift test
```

Antes de CI ou release, abrir em Xcode e:

- compilar com a flag `-warnings-as-errors`,
- rodar SwiftLint,
- verificar simulador iOS 17 e iOS 16,
- testar deep link de retorno em device físico.

---

## Limitações conhecidas

- API key embutida no `AgeKeyConfig` (anti-pattern; a remover em v0.1).
- Sem certificate pinning.
- Sem CocoaPods spec (apenas SwiftPM).
- Não publicado em Swift Package Index nem GitHub público.
- Tests apenas verificando construção de objetos, sem mock de
  `URLSession`.
- Sem suporte a `ASWebAuthenticationSession` ainda — ver
  `AgeKeyWebFlow.swift` para o esqueleto.

---

## Licença

Apache-2.0 (planejado, ainda não publicado).
