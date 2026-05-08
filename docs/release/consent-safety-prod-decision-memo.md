# Consent + Safety — Memorando de Decisão para PROD

> Versão: 2026-05-07.
> Audiência: Liderança de produto, DPO, engenharia de plataforma.
> Decisão pendente de aprovação formal.

## 1. Contexto

O AgeKey concluiu, em homologação (`agekey-hml`), o ciclo P0 contendo as 11 rodadas funcionais (R1–R11) e os fixes pós-merge consolidados em `main`. Em PROD, está habilitado apenas o subconjunto Core e a migration `017_fix_tenant_self_access`. Os módulos **Parental Consent** (R3/R5/R6) e **Safety Signals** (R4/R9) **não estão habilitados em PROD**.

Este memorando organiza o estado atual, lista as opções e recomenda um caminho de promoção.

## 2. Estado HML

| Componente | HML | PROD |
|---|---|---|
| Core (verificação, JWKS, key rotation) | ✓ | ✓ |
| `017_fix_tenant_self_access` | ✓ | ✓ |
| Parental Consent (R3) | ✓ — 6 Edge Functions ACTIVE | ✗ |
| OTP real (R5) | ✓ código + flag desligada | ✗ |
| Texto integral da policy parental (R6) | ✓ | ✗ |
| Safety Signals metadata-only (R4) | ✓ — 6 Edge Functions ACTIVE | ✗ |
| Override de regras de Safety (R9) | ✓ | ✗ |
| Retention cron (R7) | ✓ — `dry_run=true` por padrão | ✗ |
| Cross-tenant tests (R8) | ✓ executável manualmente em HML | n/a |
| Credential SD-JWT VC stub (R10) | ✓ stub honesto | ✗ |
| Proof BBS+ ZKP stub (R11) | ✓ stub honesto | ✗ |
| Migrations 020–030 | ✓ | ✗ |

Detalhes operacionais: registrados na branch `agekey/production-readiness-20260429`, arquivo `docs/audit/agekey-production-readiness-20260429-session-log.md` (não publicado em `main`).

## 3. O que falta para promover Consent + Safety a PROD

1. **Separação física PROD / HML** — projeto Supabase distinto para PROD com chaves dedicadas.
2. **Sequência de migrations** — aplicar 020–030 em PROD respeitando a ordem documentada e em janela de manutenção declarada.
3. **Edge Functions** — deploy das 14 funções do ciclo R1–R11 em PROD.
4. **GUCs operacionais** —
   - `agekey.retention_job_url`, `agekey.cron_secret`, `agekey.retention_dry_run='true'`;
   - `agekey.otp_relay_url`, `agekey.otp_relay_token` (se OTP real for habilitado);
5. **Feature flags** — começar desligadas; rollout por tenant.
6. **Provider OTP real** — DPA, escolha do provider, limites de uso, logging minimizado.
7. **Auditoria do fluxo de Parental Consent end-to-end** — revisão jurídica e de UX da apresentação de policy ao guardian.
8. **RIPD revisada** — reflexão sobre Consent/Safety em PROD (já alinhada nesta versão de [`../../compliance/ripd-agekey.md`](../../compliance/ripd-agekey.md)).
9. **Privacy Notice atualizada** — pelo controlador (cada tenant).
10. **Pentest** — escopo cross-tenant + Privacy Guard + webhooks + fluxo Consent.

## 4. Opções

### Opção A — Promoção integral (Consent + Safety + Retention) em uma janela única

**Vantagens:** menor número de janelas de manutenção; encerra o ciclo P0.
**Riscos:** maior superfície de mudança simultânea em PROD; rollback mais complexo; tenants podem precisar de mais tempo para adequar Privacy Notice.

### Opção B — Promoção faseada (recomendada)

Fase 1 — **Retention cron em modo `dry_run`** + telemetria.
Fase 2 — **Parental Consent (R3 + R6)** com OTP em modo *eager-fail* (sem provider real). Permite que tenants integrem o fluxo, com fallback documentado.
Fase 3 — **Habilitar OTP real (R5)** após DPA com provider e pentest no fluxo.
Fase 4 — **Safety Signals (R4 + R9)** metadata-only.
Fase 5 — Liberar `retention-job` para modo efetivo (sair do `dry_run`) quando a telemetria estiver estável.
Fases 6+ — Credential e Proof permanecem em stub até auditoria criptográfica externa formal.

**Vantagens:** rollback isolado por fase; cada fase tem critério de sucesso; tenants têm tempo de integrar.
**Riscos:** mais janelas de manutenção; comunicação contínua a stakeholders.

### Opção C — Manter PROD apenas no Core; Consent + Safety só em HML

**Vantagens:** zero risco adicional em PROD.
**Desvantagens:** clientes de PROD que dependam de Consent/Safety ficam sem solução fora do Core.

> Observação: caso exista um documento prévio chamado `prod-consent-safety-release-options.md` (em `docs/release/`), este memorando deve ser lido como **resumo executivo e atualização** dele. Se não existir, este documento é canônico.

## 5. Recomendação

**Opção B — promoção faseada**, na ordem indicada.

Justificativas:

- Cada módulo tem superfície de risco distinta; o faseamento permite isolar incidentes.
- O modo `dry_run` do retention-job e o modo eager-fail do OTP são salvaguardas already wired — usá-las.
- Safety v1 é metadata-only por design, mas a primeira aplicação em PROD merece observação isolada.
- Credential e Proof devem permanecer em stub até auditoria criptográfica externa documentada — isso protege o produto de declaração indevida de garantia criptográfica.

## 6. Requisitos para autorização final

A promoção em PROD para cada fase exige:

1. **Aprovação técnica** — engenharia de plataforma confirma checklist em [`hml-to-prod-release-checklist.md`](./hml-to-prod-release-checklist.md).
2. **Aprovação DPO** — confirmação de que RIPD e Subprocessadores estão alinhados ao escopo da fase.
3. **Aprovação de produto** — janela, comunicação a tenants, tolerância a rollback.
4. **Pentest atualizado** — para fases que introduzem novos endpoints públicos (ex.: R6 texto integral, R5 OTP).
5. **Privacy Notice** — controladores de tenants em rollout têm Privacy Notice atualizada antes do go-live.
6. **GUCs e segredos** — registrados em vault, com rotação periódica.

## 7. Critérios de sucesso por fase

| Fase | Critério de sucesso (24 h) |
|---|---|
| 1 — Retention `dry_run` | Job executa nas janelas previstas; nenhuma exceção; contagens batem com a expectativa de HML escalada. |
| 2 — Consent eager-fail | Sessões de Parental Consent criadas e revogadas com sucesso; nenhum vazamento de PII no payload público; texto integral da policy disponível. |
| 3 — OTP real | Taxa de entrega ≥ baseline contratado com provider; nenhum vazamento de contato do guardian fora do canal contratado. |
| 4 — Safety v1 | Eventos ingeridos sem conteúdo bruto; agregados consistentes; alertas dispatch funcionais; sem ruído. |
| 5 — Retention efetivo | Expurgo respeita classes; `audit_events` de retention íntegros; sem deleção indevida. |

## 8. Riscos residuais

- **Configuração incorreta de GUCs em PROD** — mitigado por checklist e por cron começar em `dry_run`.
- **Provider OTP comprometido** — mitigado por flag e DPA; resposta via [`../../compliance/incident-response-playbook.md`](../../compliance/incident-response-playbook.md) §5.5.
- **Tenant não comunicado** — mitigado por janela ≥ 24 h e rollout por tenant autorizado.
- **Auditoria criptográfica de R10/R11 indefinida** — manter stub; comunicar publicamente que o modo real depende de auditoria externa.

## 9. Decisão e próximos passos

> **Decisão:** ☐ Aprovar Opção B (faseada). ☐ Aprovar Opção A (integral). ☐ Manter Opção C (apenas Core em PROD).
>
> Aprovador (produto): ___________________________  Data: ___/___/____
>
> Aprovador (DPO): _______________________________  Data: ___/___/____
>
> Aprovador (engenharia): __________________________  Data: ___/___/____

Após aprovação, abrir card de release para a Fase 1 e iniciar [`hml-to-prod-release-checklist.md`](./hml-to-prod-release-checklist.md).

## 10. Referências

- [`agekey-p0-release-notes.md`](./agekey-p0-release-notes.md).
- [`hml-to-prod-release-checklist.md`](./hml-to-prod-release-checklist.md).
- [`../../compliance/ripd-agekey.md`](../../compliance/ripd-agekey.md).
- [`../../compliance/data-retention-policy.md`](../../compliance/data-retention-policy.md).
- [`../../compliance/subprocessors-register.md`](../../compliance/subprocessors-register.md).
- [`../../compliance/incident-response-playbook.md`](../../compliance/incident-response-playbook.md).
- Registro consolidado da sessão de produção R1–R11 (mantido na branch `agekey/production-readiness-20260429`, arquivo `docs/audit/agekey-production-readiness-20260429-session-log.md`).
