# AgeKey — Product Taxonomy (canônica)

> Status: contrato canônico da Rodada 1.
> Implementação: `packages/shared/src/taxonomy/age-taxonomy.ts`.

## 1. Predicados de idade (`AgePredicate`)

Apenas predicados de elegibilidade. Nunca idade real do usuário.

```
over_13, over_16, over_18, over_21
```

## 2. Estados do sujeito (`SubjectAgeState`)

```
minor                       — sujeito conhecido como menor
teen                        — adolescente
adult                       — adulto
unknown                     — não verificado
eligible_under_policy       — política reconhece como elegível
not_eligible_under_policy   — política reconhece como não elegível
blocked_under_policy        — política bloqueia o recurso (independente do estado real)
```

## 3. Níveis de assurance

### 3.1 Age assurance (`AgeAssuranceLevel`)

```
AAL-0  — sem prova
AAL-1  — auto-declaração com sinais
AAL-2  — provedor terceirizado de baixo grau
AAL-3  — credencial verificável (VC, gateway de confiança)
AAL-4  — credencial verificável de alta confiança + binding
```

### 3.2 Consent assurance (`ConsentAssuranceLevel`)

```
AAL-C0 — sem verificação de responsável
AAL-C1 — contato verificado por OTP
AAL-C2 — contato verificado + checagem cruzada
AAL-C3 — autenticação forte do responsável
AAL-C4 — credencial verificável do responsável
```

## 4. Compatibilidade com Safety Signals

Notação legada que aparece no PRD do Safety, mapeada para taxonomia canônica:

| Legacy (Safety) | Canônico |
|---|---|
| `minor_verified` | `subject_age_state: minor` + `assurance_level` conhecido |
| `teen_verified` | `subject_age_state: teen` + `assurance_level` conhecido |
| `adult_verified` | `subject_age_state: adult` + `assurance_level` conhecido |
| `unknown` | `subject_age_state: unknown` |
| `eligible_under_policy` | `subject_age_state: eligible_under_policy` |
| `not_eligible_under_policy` | `subject_age_state: not_eligible_under_policy` |
| `blocked_under_policy` | `subject_age_state: blocked_under_policy` |

Helper: `mapSafetyLegacyAgeState(legacy)`.

## 5. Regras de uso

1. **Não armazenar idade exata.** O Core e os módulos não persistem `age` ou `exact_age`.
2. **Não armazenar data de nascimento.** Já bloqueado pelo Privacy Guard e pelo schema.
3. **Não inferir idade real.** Mesmo quando o adapter conseguir computar, descarta-se após avaliar o predicado.
4. **Usar limiar de política e predicados de elegibilidade.** A política diz "16+"; o predicado diz "over_16"; o estado diz "eligible_under_policy".
5. **Expor faixa/estado apenas quando necessário.** Em decision envelope público, `risk_category` ou `actions` podem referenciar `subject_age_state`, mas nunca `age`.
