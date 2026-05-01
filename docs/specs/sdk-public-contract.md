# Contrato público dos SDKs AgeKey

## Princípio

SDKs AgeKey são clientes finos. Eles não processam identidade civil, não guardam documento e não calculam idade. Eles abrem sessão, conduzem o fluxo e devolvem decisão/token.

## Operações mínimas

### createSession

Cria sessão AgeKey. Recebe apenas:

- `application_slug`
- `policy_slug`
- `client_capabilities` (opcional)
- `external_user_ref` (opcional, **deve ser opaca / hash HMAC**)
- `redirect_url` (opcional)

#### Contrato de `external_user_ref`

`external_user_ref` é uma referência opaca controlada pelo cliente para
correlacionar a sessão com seu próprio usuário. **Nunca pode conter PII.**

O servidor (Edge Function `verifications-session-create`) e o schema Zod
em `packages/shared/src/schemas/sessions.ts` rejeitam, antes de qualquer
operação de banco:

- E-mails (`alice@example.com`)
- CPF (`123.456.789-09`, `12345678909`)
- CNPJ (`12.345.678/0001-95`)
- Telefones BR (`+55 11 9 9999-8888`)
- RG (`12.345.678-9`)
- Strings triviais / placeholders (`admin`, `test`, `1234`, `password`,
  `anonymous`, etc.)
- Valores com menos de 8 caracteres ou whitespace antes/depois

Rejeições retornam HTTP 400 com `reason_code:
'EXTERNAL_USER_REF_PII_DETECTED'`.

Recomendação ao integrador: gerar `external_user_ref` como
`HMAC_SHA256(tenant_secret, internal_user_id)` truncado para 32 bytes
hex, ou usar UUID v4. A lógica canônica de detecção está em
`packages/shared/src/external-user-ref.ts` e é re-exportada do pacote
`@agekey/shared` (`detectPiiInRef`).

### completeSession

Completa sessão com método aceito. O método é um dos `'zkp' | 'vc' | 'gateway' | 'fallback'`. O payload de cada método é definido em `packages/shared/src/schemas/sessions.ts`.

### verifyToken

Valida token online. Retorna `{ valid, reason_code, claims, revoked }`.

### buildVerificationUrl

Monta URL para fluxo web seguro a partir de `session_id` + tenant verifier domain.

## Dados proibidos no SDK e em qualquer payload público

A lista canônica vive em `packages/shared/src/privacy-guard.ts`
(`FORBIDDEN_PUBLIC_KEYS`) e é re-exportada como
`AgeKeyForbiddenPublicClaimKeys` em `packages/shared/src/schemas/agekey-token.ts`.
A função `assertPublicPayloadHasNoPii(payload, options?)` é o ponto único
de enforcement.

Categorias proibidas:

- **Idade do usuário:** `birthdate`, `date_of_birth`, `dob`, `birthday`,
  `nascimento`, `data_nascimento`, `idade`, `age`, `exact_age`, `birth_date`.
- **Identificadores civis:** `document`, `cpf`, `cnh`, `rg`, `passport`,
  `passport_number`, `id_number`, `civil_id`, `social_security`, `ssn`.
- **Nome pessoal:** `name`, `full_name`, `nome`, `nome_completo`,
  `first_name`, `last_name`.
- **Contato direto:** `email`, `phone`, `mobile`, `telefone`.
- **Endereço:** `address`, `endereco`, `street`, `postcode`, `zipcode`.
- **Biometria / artefatos brutos:** `selfie`, `face`, `face_image`,
  `biometric`, `biometrics`, `raw_id`.

Observação: `age_threshold`, `age_band_min`, `age_band_max` são
**permitidos** porque descrevem a política, não o titular.

## Matching e canonicalização

A comparação é feita após canonicalização de cada chave: lowercase,
remoção de `-` e `_`, e descarte de sufixo numérico. Assim,
`DateOfBirth`, `date-of-birth`, `DATE_OF_BIRTH`, `birthDate2` colapsam
para a mesma chave canônica e são bloqueados.

## Integração no backend

O privacy guard é chamado nas seguintes Edge Functions antes de qualquer
resposta cruzar a fronteira:

- `verifications-session-complete`: antes de assinar o token e antes de
  retornar o response body.
- `verifications-token-verify`: antes de retornar o response com claims.
- `verifications-session-get`: antes de retornar o response do painel
  (com exceção controlada de `name`, que é nome de policy/application,
  não de usuário).

Isso é defesa em profundidade — adapters e o signer já minimizam por
contrato; o guard é a última fronteira.

## Web

Prioridade comercial: SDK Web e widget, pois viabilizam integração rápida e demo.

## Mobile

SDKs nativos devem usar Custom Tabs/Safari/ASWebAuthenticationSession ou
mecanismo equivalente. Evitar WebView opaca sempre que possível. Os SDKs
mobile no repositório são reference implementation — ver
`sdk-mobile/ios/AgeKeySwift/README.md` e
`sdk-mobile/android/agekey-android/README.md` para limitações.
