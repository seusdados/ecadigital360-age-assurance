# AgeKey — Feature Flags (canônicas)

> Status: contrato canônico introduzido na rodada Core readiness alignment.
> Implementação: `packages/shared/src/feature-flags/feature-flags.ts`.

## 1. Princípio

Toda capacidade que **ainda não existe na infraestrutura real** (biblioteca criptográfica validada, issuer real, test vectors, módulo completo) deve ficar atrás de uma feature flag canônica desligada por padrão.

Quando uma flag está desligada, o caminho correspondente **deve responder com reason code honesto** — nunca aprovar por simulação.

Lista canônica:

| Flag | Default | Reason code de fallback |
|---|---|---|
| `AGEKEY_CREDENTIAL_MODE_ENABLED` | `false` | `CREDENTIAL_FEATURE_DISABLED` |
| `AGEKEY_SD_JWT_VC_ENABLED` | `false` | `CREDENTIAL_FEATURE_DISABLED` |
| `AGEKEY_PROOF_MODE_ENABLED` | `false` | `ZKP_FEATURE_DISABLED` |
| `AGEKEY_ZKP_BBS_ENABLED` | `false` | `ZKP_FEATURE_DISABLED` |
| `AGEKEY_SAFETY_SIGNALS_ENABLED` | `false` | `SYSTEM_INVALID_REQUEST` |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `false` | `SYSTEM_INVALID_REQUEST` |

## 2. Leitura

Edge Functions, admin server-side e workers leem flags por:

```ts
import { readFeatureFlags, AGEKEY_FEATURE_DISABLED_REASON_CODES } from '@agekey/shared';

const flags = readFeatureFlags((name) => Deno.env.get(name));
if (!flags.AGEKEY_ZKP_BBS_ENABLED) {
  throw new AgeKeyError(
    400,
    AGEKEY_FEATURE_DISABLED_REASON_CODES.AGEKEY_ZKP_BBS_ENABLED,
    'ZKP/BBS+ feature disabled',
  );
}
```

Cliente browser (`@agekey/sdk-js`) **não** lê flags — todas as decisões de habilitação ficam server-side.

## 3. Convenções de ativação

Para ativar uma flag em produção:

1. A capacidade real deve estar implementada e revisada (biblioteca, issuer, test vectors, suíte de testes, revisão criptográfica externa quando aplicável).
2. PR específico deve registrar a ativação com link para a revisão de segurança.
3. Variável de ambiente é definida apenas na infra de produção; staging permanece com a flag desligada até a passagem.
4. Cada ativação requer atualização correspondente do roadmap (`docs/implementation/agekey-modular-implementation-roadmap.md`).

Valores aceitos como "ativada" (case-insensitive):

```
true | TRUE | True | 1 | on | yes
```

Qualquer outro valor (vazio, ausente, "maybe", "0", "false") é tratado como **desligado**.

## 4. Não-objetivos

- **Não substituem rate limiting nem RLS.** Feature flags só bloqueiam capacidades não implementadas.
- **Não devem ser usadas para A/B testing**. AgeKey é infraestrutura crítica de privacidade — comportamento variável sem trilha de auditoria não é aceitável.
- **Não devem ser ativadas via header HTTP**. Apenas via variável de ambiente do servidor.
