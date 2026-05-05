# AgeKey Proof Mode (ZKP/BBS+) — Specification

> **Status: NOT IMPLEMENTED.** Este documento descreve o contrato e os pré-requisitos. O código atual entrega apenas tipos + verifier desabilitado honesto. Predicate attestation JWS legado (em `_shared/adapters/zkp.ts`) NÃO é Proof Mode — é attestation simples assinada.

## 1. Princípio

AgeKey Proof Mode é o caminho de verificação por **Zero-Knowledge Proofs** sobre credenciais BBS+ assinadas pelo issuer. Permite ao holder provar predicados (ex.: `age >= 18`) **sem revelar a idade real**.

Curva canônica: BLS12-381 com pareamento criptográfico. Schemes aceitos: `bls12381-bbs+`, `bbs-2023`, `bls12-381-g1`.

Ativar este modo em produção exige todos os pré-requisitos da §3 satisfeitos. Sem isso, o `selectProofVerifier` lança `ProofModeNotImplementedError`.

## 2. Contrato (estável)

```ts
import {
  ProofPresentation,
  ProofVerificationResult,
  selectProofVerifier,
} from '@agekey/shared/proof';

const verifier = selectProofVerifier({
  AGEKEY_ZKP_BBS_ENABLED: process.env.AGEKEY_ZKP_BBS_ENABLED,
});

const result: ProofVerificationResult = await verifier.verify(presentation);
```

Tipos:
- `ProofScheme`: `'bls12381-bbs+' | 'bbs-2023' | 'bls12-381-g1'`.
- `ProofPredicate`: `{ path, comparator: 'gte'|'lte'|'eq'|'over'|'under', value }`.
- `ProofPresentation`: `{ scheme, issuerDid, proof, nonce, predicates }`.

## 3. Pré-requisitos para ativação

### 3.1 Biblioteca BBS+

Candidatas (atualizado May/2026):

| Lib | Linguagem | Status | Notas |
|---|---|---|---|
| `@mattrglobal/bbs-signatures` | Node + WASM | Manutenção em dúvida — verificar antes |
| `@hyperledger/aries-askar-shared` | Rust + WASM | Hyperledger Aries, ativo |
| `bbs-signatures-rs` (via wasm-pack) | Rust + WASM | Implementação oficial CFRG-aligned |
| `pairing-bls12_381` em zkrypto-js | TS puro + WASM | Mais nova, em consolidação |

Critérios obrigatórios:
- Implementação CFRG-aligned (draft-irtf-cfrg-bbs-signatures).
- Suporte a BLS12-381 com pareamento.
- Test vectors oficiais reproduzíveis.
- Manutenção ativa (commits últimos 6 meses).
- Licença compatível (MIT/Apache).

### 3.2 Test vectors oficiais

- IRTF CFRG `draft-irtf-cfrg-bbs-signatures` test vectors.
- W3C Data Integrity BBS Cryptosuite test vectors.
- Armazenar em `test-vectors/bbs-2023/` com origem documentada (commit hash do draft).
- Vetor de happy path + vetores de falha (signature inválida, predicate não satisfeito, nonce_mismatch).

### 3.3 Issuer real

- Issuer emitindo credentials assinadas com BBS+.
- Trust list em `issuers.trust_status='trusted'`.
- DID document resolvable + JWKS.

### 3.4 Status / revogação

- StatusList2021 ou registry equivalente.
- Cache + refresh.

### 3.5 Predicate paths suportados

Por segurança, range proofs hard-coded em V1:

- `over_13`
- `over_16`
- `over_18`
- `over_21`

Predicate paths arbitrários NÃO são aceitos (limitar superfície de ataque + reduzir risco de revelação por canal lateral).

### 3.6 Revisão criptográfica externa

- Pentest com escopo Proof Mode.
- Auditoria de cripto BBS+ por terceiro reconhecido.
- Antes de habilitar `AGEKEY_ZKP_BBS_ENABLED=true` em produção.

## 4. Gates de aprovação para produção

Checklist obrigatório:

- [ ] Biblioteca BBS+ escolhida (entre §3.1) e bound em `verifier-real.ts`.
- [ ] Test vectors em `test-vectors/bbs-2023/` passando 100%.
- [ ] Pelo menos 1 issuer BBS+ configurado em `issuers.trust_status='trusted'`.
- [ ] StatusList2021 endpoint configurado.
- [ ] Pentest concluído sem high/critical findings.
- [ ] Auditoria criptográfica BBS+ externa concluída.
- [ ] DPIA atualizado cobrindo ZKP com dados de menor.
- [ ] Documentação para integradores publicada.

## 5. Não-objetivos

- ZKP de identidade civil — proibido.
- ZKP que revele nome — proibido.
- ZKP que revele data de nascimento — proibido.
- Predicate attestation JWS (caminho legado em `zkp.ts`) **NÃO é** Proof Mode — é attestation assinada simples; não tem propriedade zero-knowledge.
- Implementar BBS+ "do zero" — sempre usar lib auditada.

## 6. Riscos específicos

- **Pareamento criptográfico**: implementação de BLS12-381 incorreta vaza chave privada. Usar SOMENTE bibliotecas auditadas externamente.
- **WASM**: bibliotecas BBS+ em WASM têm overhead de bytes; cuidado com cold-start em Edge Functions.
- **Nonce reuse**: sem nonce único por verification, replay é possível.
- **Holder collusion**: vários holders podem combinar disclosures — modelo de ameaça precisa cobrir.
- **ZKP com menores**: DPIA precisa cobrir cenário; consent parental pode ser exigido.

## 7. Implementação atual (R11)

Apenas:
- Tipos públicos em `packages/shared/src/proof/`.
- `disabledProofVerifier` que sempre nega.
- `selectProofVerifier` falha eager se flag ON sem provider.
- Tests de contrato (não de cripto).
- Diretório `test-vectors/bbs-2023/README.md` placeholder.

Para ativar de verdade, criar `verifier-real.ts` que respeite todos os pré-requisitos da §3 e §4.
