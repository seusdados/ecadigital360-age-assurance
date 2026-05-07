# AgeKey Credential Mode (SD-JWT VC) — Specification

> **Status: NOT IMPLEMENTED.** Este documento descreve o contrato e os pré-requisitos. O código atual entrega apenas tipos + verifier desabilitado honesto.

## 1. Princípio

AgeKey Credential Mode é o caminho de verificação por **Verifiable Credentials** (W3C VC-JWT ou IETF SD-JWT VC) emitidas por issuers de confiança (ex.: governos, EUDI Wallet, carteiras corporativas).

Ativar este modo em produção exige todos os pré-requisitos da §3 satisfeitos. Sem isso, o `selectCredentialVerifier` lança `CredentialModeNotImplementedError`.

## 2. Contrato (estável)

```ts
import {
  CredentialPresentation,
  CredentialPredicates,
  CredentialVerificationResult,
  selectCredentialVerifier,
} from '@agekey/shared/credential';

const verifier = selectCredentialVerifier({
  AGEKEY_SD_JWT_VC_ENABLED: process.env.AGEKEY_SD_JWT_VC_ENABLED,
});

const result: CredentialVerificationResult = await verifier.verify(
  presentation,
  predicates,
);
```

Tipos:
- `CredentialFormat`: `'sd_jwt_vc' | 'w3c_vc_jwt'`.
- `DisclosureClaim`: `{ path, value }` — value sem PII.
- `CredentialPredicate`: `{ path, comparator: 'gte'|'lte'|'eq'|'over'|'under', value }`.

## 3. Pré-requisitos para ativação

### 3.1 Biblioteca criptográfica

Candidatas a avaliar (atualizado May/2026):

| Lib | Linguagem | Manutenção | Notas |
|---|---|---|---|
| `@hopae/sd-jwt-vc` | TS | ativa | Implementação SD-JWT VC compliance ietf-oauth-sd-jwt-vc |
| `@sd-jwt/core` | TS | ativa | Core building blocks SD-JWT |
| `@sphereon/ssi-sdk.sd-jwt-vc` | TS | ativa | Parte do Sphereon SSI SDK |
| `@digitalcredentials/vc` | TS | ativa | W3C VC-JWT |

Critérios obrigatórios:
- Licença compatível (MIT/Apache).
- Test vectors da spec (IETF SD-JWT VC) reproduzíveis.
- Suporte a key binding (holder binding).
- Estabilidade da API.

### 3.2 Issuer real

- Trust list: registro de issuers confiáveis (`issuers` table do Core).
- JWKS publicado em URL estável.
- DID document resolvable (did:web ou did:key).
- Acordo legal de cooperação (ex.: EUDI Wallet trust framework).

### 3.3 Test vectors oficiais

- IETF draft `draft-ietf-oauth-sd-jwt-vc` test vectors.
- Vetor de happy path (signature válida, disclosure correta).
- Vetores de falha (signature inválida, expired, revoked).
- Armazenar em `test-vectors/sd-jwt-vc/` com origem documentada.

### 3.4 Status / revogação

- StatusList2021 implementado conforme W3C.
- URL de status list por issuer.
- Cache + refresh policy.

### 3.5 Key binding

- Holder binding via WebAuthn (preferencial) ou DID-bound key.
- Verificação de presentation_nonce contra replay.

### 3.6 Revisão criptográfica externa

- Pentest com escopo Credential Mode.
- Auditoria criptográfica de terceiro reconhecido.
- Antes de habilitar `AGEKEY_SD_JWT_VC_ENABLED=true` em produção.

## 4. Gates de aprovação para produção

Checklist obrigatório:

- [ ] Biblioteca escolhida (entre §3.1) e bound em `verifier-real.ts`.
- [ ] Test vectors em `test-vectors/sd-jwt-vc/` passando.
- [ ] Pelo menos 1 issuer configurado em `issuers.trust_status='trusted'`.
- [ ] StatusList2021 endpoint configurado.
- [ ] Pentest concluído sem high/critical findings.
- [ ] Auditoria criptográfica externa concluída.
- [ ] DPIA atualizado (LGPD/GDPR) cobrindo VC com dados de menor.
- [ ] Documentação para integradores publicada.

## 5. Riscos específicos

- **VC com dados de menor**: DPIA precisa cobrir scenario de child holder (criança como holder de VC pode exigir consent parental adicional).
- **Selective disclosure incompleta**: implementação pode revelar mais claims que o solicitado se a lib tiver bugs.
- **Issuer comprometido**: revogação rápida obrigatória (StatusList2021 + override em `issuers.trust_status='suspended'`).
- **Replay**: nonce + key binding obrigatórios.

## 6. Não-objetivos

- ZKP/BBS+ NÃO é Credential Mode. Vai em `agekey-proof-mode.md` (R11).
- Predicate attestation JWS (legado em `_shared/adapters/zkp.ts` e `vc.ts`) NÃO é Credential Mode — é attestation simples.

## 7. Implementação atual (R10)

Apenas:
- Tipos públicos em `packages/shared/src/credential/`.
- `disabledCredentialVerifier` que sempre nega.
- `selectCredentialVerifier` que falha eager se flag ON sem provider.
- Tests de contrato (não de cripto).

Para ativar de verdade, criar `verifier-real.ts` que respeite todos os pré-requisitos da §3 e §4.
