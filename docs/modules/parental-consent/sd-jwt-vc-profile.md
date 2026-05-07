# Perfil futuro — SD-JWT VC para AgeKey Parental Consent

> **Estado: RESERVADO. NÃO implementado em produção.**
> Feature flag: `AGEKEY_CONSENT_SD_JWT_VC_ENABLED=false`.

Este documento esboça como um **SD-JWT VC** ([draft-ietf-oauth-sd-jwt-vc])
poderá ser usado como evolução futura do `parental_consent_token`. Ele
NÃO descreve nada que esteja implementado — qualquer ativação prematura é
um anti-padrão técnico e regulatório.

## Por que reservar agora

1. Cliente que armazena o `jti` hoje continuará funcionando: o módulo
   guarda o `token_type='sd_jwt_vc'` numa coluna paralela e o verifier
   sabe lidar com os dois formatos.
2. Os campos do recibo (`consent_text_hash`, `proof_hash`, `purpose_codes`,
   `data_categories`) são naturalmente "selectively disclosable", o que
   casa com o modelo de SD-JWT.
3. Permite que o responsável apresente apenas o que for necessário em
   cada cenário (ex.: provar que consentiu para `platform_use` sem
   revelar que também consentiu para `analytics_aggregated`).

## O que falta para virar produção

### Biblioteca

Nenhuma das bibliotecas TypeScript/Deno de SD-JWT VC tem hoje:
- API estável,
- test vectors do draft -08 ou superior,
- suporte a JSON-LD ou JOSE com curve P-256,
- testes de revogação via Status List V2.

A produção exige uma das seguintes:
- Adoção de uma lib comprovada (ex.: `@openid/sd-jwt`) com cobertura ≥ 90%.
- Implementação interna validada contra os test vectors do draft.

### Issuer

- AgeKey Core já emite ES256. SD-JWT VC pode reusar a mesma chave, mas
  precisa expor `iss` e `kid` em formato compatível com a draft.
- O `vct` (Verifiable Credential Type) precisa ser um URI estável, ex.:
  `https://schemas.agekey.com.br/credentials/parental-consent/v1`.

### Status / revogação

- Hoje a revogação é por `parental_consent_tokens.status`. Para SD-JWT VC,
  o draft usa `Status List V2` com bitmask comprimido publicada num URL
  público. A AgeKey precisa hospedar esse endpoint, atualizá-lo
  on-revocation e garantir SLA.

### Test vectors

- Cada release do draft muda detalhes de canonicalização. Antes de
  habilitar, importar o test vector oficial e verificar que
  `parseSdJwt + verifyJws` produz exatamente os digests esperados.

### Receptor (relying party)

- A RP precisa de uma lib compatível para validar disclosures + status.
- O endpoint público `/v1/parental-consent/token/verify` continua valendo
  para receptores que não querem implementar SD-JWT do lado deles —
  o AgeKey faz a verificação e devolve o subset minimizado.

## Mapeamento esboçado

```
SD-JWT VC payload:
{
  "iss": "https://agekey.com.br",
  "sub": "<external_user_ref opcional>",
  "iat": <iat>,
  "exp": <exp>,
  "vct": "https://schemas.agekey.com.br/credentials/parental-consent/v1",
  "_sd": [
    "<digest of consent_token_id>",
    "<digest of parental_consent_id>",
    "<digest of resource>",
    "<digest of purpose_codes>",
    "<digest of data_categories>",
    "<digest of method>",
    "<digest of assurance_level>",
    "<digest of consent_text_hash>",
    "<digest of proof_hash>"
  ],
  "agekey": {
    "decision": "approved",
    "decision_domain": "parental_consent",
    "tenant_id": "<...>",
    "application_id": "<...>"
  }
}
```

Disclosures correspondem aos campos hoje presentes em `agekey.*` no
`agekey_jws`. A relying party seleciona quais disclosures incluir na
apresentação para o backend conforme a finalidade.

## Decisão atual

A coluna `parental_consent_tokens.token_type` já aceita o valor
`sd_jwt_vc` mas o INSERT é gated pela feature flag. Tentar emitir hoje:

- A migration aceita o INSERT (não há CHECK proibindo).
- O código em `parental-consent-confirm` recusa (caminho `agekey_jws`
  hard-coded enquanto `AGEKEY_CONSENT_SD_JWT_VC_ENABLED=false`).

Quando a flag virar `true` em produção, este documento precisa ganhar
uma seção "Implementação" detalhada, listando a biblioteca escolhida, o
hash da revisão dos test vectors validados, o endpoint de Status List
publicado e o teste E2E executado em staging.

[draft-ietf-oauth-sd-jwt-vc]: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-sd-jwt-vc
