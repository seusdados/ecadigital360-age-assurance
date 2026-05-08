# Política de Retenção de Dados — AgeKey

> Versão: 2026-05-07.
> Aplicável a todos os ambientes (DEV/HML/PROD), com janelas concretas configuradas por ambiente.
> Referência técnica: `docs/specs/agekey-retention-classes.md`, `docs/specs/agekey-retention-job.md`.

## 1. Objetivo

Definir por quanto tempo dados técnicos e evidências mínimas são mantidos, com base legal por classe e procedimento de exceção (`legal_hold`).

A política aplica princípios LGPD de **necessidade**, **finalidade** e **prevenção** (art. 6º).

## 2. Classes de retenção

O AgeKey adota três classes canônicas:

### 2.1 `event_90d` — dados operacionais de curto prazo

| Tabela / artefato | Janela padrão | Base legal |
|---|---|---|
| `verification_sessions` (pendentes/expiradas) | 24 h | Necessidade (art. 6º, III) — sessões abandonadas não têm utilidade após expiração. |
| `verification_challenges` | TTL + 24 h | Idem. Nonce não pode ser reutilizado. |
| `safety_events` (raw events) | 90 dias | Necessidade — agregados (`safety_aggregates`) cobrem análise histórica. |
| `rate_limit_buckets` | 24 h – 30 dias | Necessidade — segurança. |
| `ip_reputation` | 1 h – 30 dias | Legítimo interesse — antiabuso. |
| `webhook_deliveries` (sucesso) | 30 dias | Necessidade — diagnóstico curto. |

### 2.2 `audit_5y` — evidência auditável

| Tabela / artefato | Janela padrão | Base legal |
|---|---|---|
| `verification_results` | 30–365 dias (configurável por contrato) | Execução de contrato + cumprimento de obrigação legal/regulatória. |
| `audit_events` | 5 anos (padrão; configurável) | Cumprimento de obrigação regulatória (LGPD art. 37 — registro de operações). |
| `result_tokens` (já expirados) | 90 dias após `exp` | Auditabilidade de validações posteriores. |
| `parental_consents` | 5 anos após revogação ou término do uso | Comprovação de consentimento (LGPD art. 8º, §6º). |
| `parental_consent_events` | 5 anos | Idem. |
| `billing_events` | conforme prazo fiscal/contratual (até 5 anos) | Cumprimento de obrigação legal/contratual. |
| `proof_artifacts` (apenas hash + path) | até 365 dias | Auditabilidade da decisão. |

### 2.3 `legal_hold` — preservação por exceção

- Preservação de qualquer dado pelo prazo necessário ao cumprimento de:
  - ordem judicial;
  - requisição de autoridade competente;
  - obrigação regulatória específica;
  - exercício regular de direito em processo administrativo, judicial ou arbitral.
- A flag `legal_hold` suspende o expurgo automático para os registros marcados.

## 3. Dados proibidos em qualquer classe

Os seguintes dados **não devem existir** em nenhum momento; portanto, não há classe de retenção para eles:

- Data de nascimento ou idade exata.
- Documento civil bruto.
- Selfie / vídeo / biometria.
- Nome, e-mail, endereço ou telefone do **usuário final** (menor ou adulto).
- Conteúdo bruto de mensagens (Safety v1 é metadata-only).
- Payload bruto de credencial além do estritamente necessário.

O Privacy Guard reforça essa proibição em runtime.

## 4. Mecanismo de expurgo

- **Cron unificado** (R7): edge function `retention-job` executa expurgo por classe conforme schedule definido em `028_retention_cron_schedule.sql`.
- **Modo dry-run**: padrão `agekey.retention_dry_run = 'true'` em PROD até validação operacional.
- **Idempotência**: o job usa janela determinística (`now() - interval '<class window>'`) e marca registros expurgados.
- **Auditoria**: cada execução registra contagem por classe em `audit_events`.

## 5. Configuração por ambiente

| GUC | DEV | HML | PROD |
|---|---|---|---|
| `agekey.retention_job_url` | local | edge function HML | edge function PROD |
| `agekey.cron_secret` | dev-secret | secret HML | secret PROD |
| `agekey.retention_dry_run` | `true` | `true`/`false` | `true` até autorização explícita |

Configuração inicial em PROD permanece em `dry_run` até checklist HML→PROD ser concluído.

## 6. Retenção por tenant (configurável)

Cada controlador (tenant) pode reduzir as janelas padrão via contrato. **Não é permitido** estender a retenção além do limite legal sem justificativa documentada.

## 7. Procedimento de exceção (`legal_hold`)

1. **Solicitação formal** — recebida pelo DPO/Encarregado da AgeKey.
2. **Validação de competência** — confirmar autoridade legal/regulatória do solicitante.
3. **Escopo mínimo** — marcar apenas os registros estritamente necessários.
4. **Aplicação técnica** — atualizar coluna `legal_hold = true` (ou inserção em `legal_holds` quando a tabela suporte) com `reason`, `reference_id`, `expires_at` (se conhecido), `applied_by`, `applied_at`.
5. **Auditoria** — entrada em `audit_events` com classe `legal_hold:applied`.
6. **Revisão periódica** — checagem trimestral para liberação quando o motivo cessar.
7. **Liberação** — `legal_hold = false` + entrada de auditoria `legal_hold:released`.
8. **Notificação ao controlador afetado** — quando juridicamente possível.

## 8. Direito ao apagamento (LGPD art. 18, VI)

- Solicitações são endereçadas pelo controlador (tenant) ao DPO da AgeKey.
- Chave de busca: `session_id` / `jti` / `external_user_ref` opaco.
- Apagamento aplica-se a registros **sem** `legal_hold` ativo e **sem** retenção legal/contratual vigente.
- Apagamento gera evento `audit_events` classe `subject_request:erasure`.

## 9. Revisão

- Revisão **anual** desta política ou a cada mudança material de tratamento.
- Última revisão: 2026-05-07.

## 10. Referências

- LGPD (Lei 13.709/2018) — art. 6º, art. 16, art. 37.
- [`ripd-agekey.md`](./ripd-agekey.md) — RIPD/DPIA.
- [`incident-response-playbook.md`](./incident-response-playbook.md) — IR.
- `docs/specs/agekey-retention-classes.md` — especificação técnica das classes.
- `docs/specs/agekey-retention-job.md` — desenho do cron.
