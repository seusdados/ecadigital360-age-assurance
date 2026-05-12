# AgeKey OneClick — Política No-Fake-Crypto

> Esta PR não cria fluxo produtivo OneClick. Ela prepara contratos, tipos,
> adapters desabilitados e documentação para implementação operacional
> posterior.

## Princípio

Nenhuma camada do OneClick contract-ready pode aprovar uma verificação
criptográfica sem que o algoritmo correspondente esteja efetivamente
plugado, validado externamente e coberto por test vectors oficiais.

## Estado atual (esta PR)

| Algoritmo / Formato | Estado | Ação do adapter contract-ready |
| --- | --- | --- |
| SD-JWT VC | Não implementado (P4) | `feature_disabled` |
| BBS+ (`bls12381-bbs+`) | Não implementado (P4) | `curve_unsupported` |
| BBS+ (`bls12381-bbs+-2024`) | Não implementado (P4) | `curve_unsupported` |
| BBS+ (`bbs-2023`) | Não implementado (P4) | `curve_unsupported` |
| BLS12-381 G1 (`bls12-381-g1`) | Não implementado (P4) | `curve_unsupported` |
| Predicate Attestation JWS | Operacional via `_shared/adapters/zkp.ts` | Reusado, NÃO modificado |
| W3C VC-JWT | Operacional via `_shared/adapters/vc.ts` | Reusado, NÃO modificado |

`ONECLICK_BBS_FORMATS` (em
`packages/shared/src/oneclick/oneclick-proof-adapter.ts`) lista
explicitamente os formatos que exigem crypto-core real. Mantém paridade
com a constante `BBS_FORMATS` em
`supabase/functions/_shared/adapters/zkp.ts`.

## Garantias de teste

- `packages/shared/__tests__/oneclick-proof-adapter-rejects-bbs.test.ts`
  itera sobre cada formato de `ONECLICK_BBS_FORMATS` e verifica que
  tanto `verify()` quanto `prove()` retornam `curve_unsupported`.
- `packages/shared/__tests__/oneclick-credential-adapter-honest-stub.test.ts`
  verifica que `issue()` e `verify()` retornam `feature_disabled`.

## Como ativar criptografia real (P4)

1. Escolher formalmente biblioteca BBS+ (CFRG-aligned: candidatas
   incluem `bbs-signatures-rs` via WASM, `mattrglobal/jsonld-signatures-bbs`).
2. Escolher biblioteca SD-JWT VC com suporte a key binding e
   StatusList2021.
3. Inserir test vectors oficiais em `tests/vectors/bbs-cfrg/`.
4. Habilitar issuer real em `issuers` (trust registry).
5. Configurar StatusList2021.
6. Solicitar revisão criptográfica externa (3–6 semanas).
7. Substituir `disabledOneclickProofAdapter` e
   `disabledOneclickCredentialAdapter` por implementações reais
   delegando para `selectProofVerifier` e `selectCredentialVerifier`
   canônicos.
8. Atualizar `BBS_FORMATS` em `_shared/adapters/zkp.ts` para que o
   adapter de edge function delegue ao crypto-core em vez de retornar
   `ZKP_CURVE_UNSUPPORTED`.

## Garantias fora desta PR

- Não há tabela criada para credenciais ou provas.
- Não há edge function criada para `issue-sdjwt`, `prove-age-zkp` ou
  `verify-age-zkp`.
- O SDK preview (`OneclickClient`) NUNCA fabrica sucesso — devolve
  `OneclickEndpointUnavailableError` quando o orquestrador não está
  acessível.
