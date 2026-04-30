# Fundação open source e limites prudentes de implementação

## Objetivo

Este documento orienta o desenvolvimento do AgeKey com base em ferramentas abertas e padrões amplamente utilizados, sem criar promessas inviáveis ou dependências frágeis. Ele serve para o Claude Code implementar o que é útil agora e deixar claramente marcado o que depende de fornecedores, wallets, issuers ou bibliotecas criptográficas externas.

## Stack observada no repositório

O projeto já usa:

- PostgreSQL/Supabase para banco, Auth, Storage e Edge Functions;
- Deno nas Edge Functions;
- Next.js 14 no painel admin;
- pnpm workspaces e Turborepo;
- TypeScript;
- Zod;
- Web Crypto para JWS/JWT ES256;
- Supabase Vault para chaves privadas;
- Supabase migrations versionadas;
- RLS para multi-tenancy;
- Storage para artefatos de prova.

Essa combinação é adequada para MVP e para versão licenciável B2B, desde que o produto não prometa criptografia ZKP production-ready sem validação especializada.

## Princípios técnicos

### 1. Open core, não open everything

SDKs, widget, schemas públicos e documentação podem ser MIT/Apache. Painel, policy engine avançada, trust registry gerenciado, billing e relatórios podem permanecer proprietários.

### 2. Adapter contracts antes de integrações definitivas

Para gateways e ZKP, o contrato deve existir antes da implementação real. Isso permite o core funcionar e evita reescrever API pública.

### 3. Sem falsa criptografia

Quando não houver test vectors, issuer real, wallet compatível e biblioteca validada, o código deve falhar explicitamente com reason code adequado, e não retornar "approved" por simulação.

### 4. Minimização acima de conveniência

Todo provider adapter deve normalizar sua resposta para uma decisão mínima. Mesmo que o provider retorne nome, documento, data de nascimento ou selfie, o core AgeKey não deve persistir nem repassar esses dados.

## Camadas open source úteis

### Supabase

Uso adequado:

- Postgres com migrations;
- RLS;
- Auth para painel;
- Edge Functions;
- Storage com policies;
- Vault para private keys;
- pg_cron/pg_net para jobs.

Riscos:

- service role key em ambiente errado;
- RLS mal testado;
- Storage com bucket público;
- migrations com permissões incompatíveis em managed Supabase.

Mitigação:

- funções server-side apenas;
- testes cross-tenant;
- hardening Supabase documentado;
- separação de projeto staging/production.

### Next.js

Uso adequado:

- painel admin;
- docs ou páginas comerciais;
- proxy para API pública se necessário;
- deploy Vercel.

Riscos:

- secrets expostos via `NEXT_PUBLIC_`;
- server actions sem validação;
- cache indevido de dados de tenant.

Mitigação:

- separar env pública e server-only;
- revisar headers e caching;
- usar Supabase server client com contexto.

### Deno Edge Functions

Uso adequado:

- API de verificação;
- emissão de token;
- webhooks;
- trust registry;
- rotação de chaves.

Riscos:

- dependência remota sem pin;
- runtime differences;
- ausência de observabilidade.

Mitigação:

- pin de versão;
- logs com trace_id;
- testes locais quando possível;
- CI de typecheck.

### JWS/JWT ES256 via Web Crypto

Uso adequado:

- token AgeKey;
- gateway/predicate attestations quando issuer fornece JWS.

Riscos:

- formato de assinatura ECDSA WebCrypto pode variar em DER/raw em libs externas;
- kid desconhecido;
- rotação de chave sem JWKS claro.

Mitigação:

- testes com vetores;
- endpoint JWKS estável;
- validação online para revogação.

### Verifiable Credentials / SD-JWT VC

Uso adequado:

- credential mode;
- selective disclosure;
- integração futura com wallets.

Riscos:

- fragmentação de formatos;
- wallet compatibility;
- revogação;
- issuer trust registry.

Mitigação:

- contrato de adapter;
- formatos aceitos por issuer;
- reason codes específicos;
- não guardar payload completo.

### BBS+ / BLS12-381

Uso adequado:

- selective disclosure e ZKP forte no futuro.

Riscos:

- pareamento criptográfico complexo;
- dependência WASM;
- test vectors;
- issuer real;
- validação externa.

Mitigação:

- `ZKP_CURVE_UNSUPPORTED` até readiness;
- arquivo `test-vectors/README.md`;
- checklist de produção;
- revisão criptográfica externa.

## Decisão recomendada

O AgeKey deve ir a mercado com:

1. fallback controlado;
2. gateway attestation JWS;
3. credential/VC quando issuer e wallet existirem;
4. BBS+ como adapter ready, não como promessa production-ready.

Isso mantém o produto viável, comercial e defensável.

## Checklist de production-readiness para BBS+ / ZKP

Nenhum desbloqueio de BBS+ / BLS12-381 acontece sem TODOS os itens abaixo
auditáveis no repositório:

- [ ] **Biblioteca criptográfica escolhida e justificada** (ex.:
      `pairing-crypto`, `noble-bbs`, `mattrglobal/bbs-signatures`,
      `digitalbazaar/bbs-signatures`). Decisão registrada em ADR.
- [ ] **Bindings Deno + Web Crypto** validados. WASM build pinned por
      hash, com tamanho e tempo de inicialização documentados em
      `docs/architecture/open-source-foundation.md`.
- [ ] **Test vectors RFC-9508 (BBS) e draft IRTF para BLS12-381**
      commitados em `packages/adapter-contracts/test-vectors/` e
      `supabase/functions/_shared/adapters/test-vectors/`. Cada vetor com
      provenance (URL, commit), proof, public key, expected predicate
      result, e CI rodando-os.
- [ ] **Issuer real homologado** com DID resolvable, JWKS publicado e
      wallet compatível (EUDI ARF / OpenID4VP). Issuer registrado na
      `issuers` com `trust_status='trusted'`.
- [ ] **Suite criptográfica documentada**: hash-to-curve, ciphersuite
      `BLS12-381-SHA-256` ou equivalente, formato de pairing.
- [ ] **Auditoria criptográfica externa** assinada antes de habilitar
      `decision=approved` em modo BBS+.
- [ ] **Compatibilidade de wallet** testada com pelo menos uma wallet
      EUDI-ARF de referência e log de telemetria que diferencia
      `predicate-attestation-jws` de `bls12381-bbs+` para conversão.
- [ ] `requireBbsProductionReadiness({libraryName, testVectorSet,
      issuerDid, walletProfile})` chamado no boot do adapter para
      falhar fast se qualquer item faltar.

Enquanto qualquer item permanece aberto, o adapter `zkp.ts` deve
retornar `reason_code = ZKP_CURVE_UNSUPPORTED` para qualquer
`proof_format` BBS+. O teste
`packages/adapter-contracts/src/zkp-bbs-contract.test.ts` reforça
esse contrato. **Isso não é uma limitação a esconder, é uma posição
defensável.** Falsa cripto é risco regulatório, comercial e
reputacional.

## Interface crypto-core futura

Quando os itens acima estiverem prontos, o adapter ZKP deve delegar
para uma interface `ZkpVerifierAdapter` (já definida em
`packages/adapter-contracts/src/zkp-bbs-contract.ts`). Nenhuma lib WASM
deve ser carregada antes dessa decisão. Não introduzir dependência
WASM "para o caso de" — o custo de bundle e a superfície de auditoria
não se justificam sem decisão tomada.
