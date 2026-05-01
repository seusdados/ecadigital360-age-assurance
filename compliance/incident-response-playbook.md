# Incident Response Playbook — AgeKey

Documento operacional. Mudanças exigem revisão de Tech Lead + DPO.

> Cobertura: severidades, on-call/escalation, SLAs, fluxo de resposta, runbooks específicos, comms templates, post-mortem template e registro de tabletops SEV-1.

---

## 1. Severidades

### SEV-1 — Crítico (impacto direto à integridade do produto)

- service role key exposta
- private signing key exposta
- tenant breakout / RLS bypass confirmado
- PII em token público
- storage público com artefatos
- token forgery
- vazamento confirmado de dados pessoais (LGPD Art. 48 dispara)

**Resposta**: conter imediatamente, revogar chaves, pausar funções afetadas, comunicar clientes impactados, preservar evidências.

### SEV-2 — Alto

- webhook spoofing
- falha de nonce
- logs com PII
- provider gateway comprometido
- indisponibilidade parcial (subset de tenants)
- DDOS atingindo rate-limit
- escalation de privilégio dentro de tenant (sem cross-tenant)

### SEV-3 — Médio

- erro de documentação que pode induzir cliente a uso inseguro
- falha pontual sem exposição (uma sessão quebra, sem replicar)
- degradação de performance > 30% sustentada

### SEV-4 — Baixo

- bug cosmético no painel
- typo em mensagem de erro
- spike isolado de latência (< 30%)

---

## 2. On-call / Escalation matrix

> A ferramenta de paging (PagerDuty / OpsGenie / equivalente) é **TBD** — contratar antes de GA.

### Roles

| Role | Responsabilidade durante incidente ativo |
|---|---|
| `on-call-primary` | Recebe paging, classifica severidade, abre war-room (canal Slack/Discord `#incident-{date}-{slug}`), inicia timeline |
| `on-call-secondary` | Backup do primary; assume se primary não acknowledge em 5min |
| `incident-commander` | Coordena resposta; toma decisões de contenção/mitigation; aprova comms externas |
| `tech-lead` | Decisão técnica final; aprova rollbacks/migrations destrutivas em fire-fighting |
| `dpo` | Avalia exposição de dados pessoais; decide acionamento ANPD; aprova comms regulatórias |
| `comms-lead` | Redige comms externas; atualiza status page; coordena com clientes |
| `scribe` | Mantém timeline em UTC com fonte de cada evento |

### Rotação

- Cadência: weekly (segunda 09:00 BRT → segunda 09:00 BRT)
- Source of truth: ferramenta de paging (TBD)
- Calendar fallback: planilha compartilhada `compliance/oncall/rotation-2026.csv`

### Escalation timeline

| Tempo desde paging | Ação automática |
|---|---|
| 0–5 min | `on-call-primary` ack obrigatório |
| 5 min sem ack | paging escala para `on-call-secondary` |
| 15 min sem ack | paging escala para `tech-lead` direto |
| 30 min sem ack | acionamento manual do `incident-commander` por qualquer role com permissão de paging |

### Contatos fallback (manuais)

Lista mantida em `compliance/oncall/contacts.private.md` (gitignored — só nomes de role + telefone fixo do owner). Atualizada trimestralmente.

---

## 3. SLAs por severidade

| Sev | Detection | Acknowledge | First-update interno | Mitigation | Comms-customer | Post-mortem |
|---|---|---|---|---|---|---|
| 1 | ≤ 15 min | ≤ 15 min | 30 min | ≤ 4 h | ≤ 2 h | ≤ 5 dias úteis |
| 2 | ≤ 1 h | ≤ 30 min | 1 h | ≤ 24 h | ≤ 24 h | ≤ 10 dias úteis |
| 3 | ≤ 24 h | ≤ 4 h | 4 h | ≤ 7 dias | ≤ 72 h | opcional |
| 4 | ≤ 72 h | ≤ 24 h | daily | próximo ciclo | N/A | N/A |

Notas:

- **Detection**: tempo desde o evento até alguém saber que existe. Métrica de qualidade do monitoring, não da resposta.
- **Acknowledge**: tempo desde o paging até o primary assumir.
- **First-update interno**: primeira atualização na war-room com hipótese, contenção em curso e ETA da próxima atualização.
- **Comms-customer**: notificação proativa ao cliente direto impactado (não a status page geral).
- **Post-mortem**: prazo para circular o doc completo (ver template § 7).

---

## 4. Fluxo de resposta (9 passos)

1. **Detectar**
   Origem: alert do monitoring (Sentry, Vercel logs, pg_cron failure, customer report). Quem detecta abre o paging.

2. **Classificar**
   Primary aplica a tabela § 1. Em dúvida, sobe um nível (preferimos SEV-1 falso a SEV-2 verdadeiro perdido).

3. **Conter**
   Pausar a superfície afetada antes de investigar. Exemplos: `supabase functions delete <function>` (revertível por redeploy), revogar API key suspeita, ativar Vercel Firewall, marcar `application.status = suspended`.

4. **Preservar logs**
   Antes de qualquer rollback: snapshot dos logs relevantes (Vercel, Supabase, pg_audit). Salvar com timestamps em UTC e source citado.
   ```bash
   supabase functions logs <fn> --project-ref $REF > /tmp/incident-{id}-{fn}.log
   ```
   Storage: bucket S3 dedicado a incidentes (não no repositório).

5. **Revogar chaves/tokens** (se aplicável)
   Ver Runbook A (chave de assinatura) ou Runbook B (service role) ou Runbook C (tenant breakout).

6. **Corrigir**
   Patch na branch `hotfix/incident-{id}`; PR review por `tech-lead` (em SEV-1 review pode ser síncrono na war-room). Migration destrutiva: ver `infrastructure/environments.md` § "Política de migrations destrutivas".

7. **Retestar**
   Smoke-tests em staging (`security/pentest/manual-smoke-tests.md`). Em SEV-1 com risco de regressão, retestar em prod sob janela controlada.

8. **Comunicar**
   `comms-lead` envia comms externas usando templates § 6. `dpo` decide acionamento ANPD em ≤ 48h se houver dados pessoais expostos. Status page atualizada a cada 30min durante incidente ativo.

9. **Registrar pós-incidente**
   Post-mortem usando template § 7 dentro do SLA. Action items vão para issues do GitHub com label `incident-{id}` e owner.

---

## 5. Runbooks específicos

### Runbook A — Chave de assinatura comprometida

1. Marcar `crypto_keys.status = retired` na chave comprometida (NUNCA `compromised` como string livre — usar enum existente; status compromised pode virar via fix migration depois).
2. Rodar `key-rotation` Edge Function:
   ```bash
   curl -X POST https://api.agekey.com.br/v1/key-rotation \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
3. JWKS atualiza automaticamente no próximo cache miss (TTL 5min).
4. Revogar JTIs emitidos pela chave se a janela permite:
   ```sql
   INSERT INTO revocations (tenant_id, jti, reason)
   SELECT rt.tenant_id, rt.jti, 'incident-{id}: signing key compromised'
   FROM result_tokens rt
   WHERE rt.kid = '<compromised-kid>' AND rt.revoked_at IS NULL;
   ```
5. Notificar clientes impactados (template § 6.1) que tokens emitidos antes do timestamp X devem ser re-validados online.
6. Post-mortem (§ 7).

### Runbook B — Service role exposta

1. Rotacionar imediatamente no Supabase Dashboard › Settings › API › Reset service-role key.
2. Atualizar env vars:
   - Vercel Production: `SUPABASE_SERVICE_ROLE_KEY` (`vercel env rm` + `vercel env add`)
   - Supabase Edge Functions secrets: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref $REF`
   - GitHub Actions secrets (se aplicável)
3. Invalidar deployments antigos: `vercel rollback` para o último deploy *antes* da exposição não é o caminho (esse continua usando a chave vazada). Em vez disso, fazer `vercel --prod` *depois* da rotação para forçar redeploy com a nova chave.
4. Revisar logs de acesso ao Supabase (Dashboard › Logs › API). Procurar:
   - IPs de origem desconhecidos
   - Operações privilegiadas (`auth.*`, `storage.objects`, `crypto_keys`)
5. Verificar alterações em tabelas sensíveis:
   ```sql
   SELECT tenant_id, action, resource_type, created_at
   FROM audit_events
   WHERE created_at >= '<window-start>'
     AND actor_type = 'system'
     AND action ~ '\.(insert|update|delete)$'
   ORDER BY created_at DESC;
   ```
6. Rodar suíte RLS (`pnpm test:rls`) para confirmar isolamento.
7. Decisão DPO: vazamento de dados pessoais? → ANPD em 48h.
8. Post-mortem (§ 7).

### Runbook C — Tenant breakout / RLS bypass suspeito

1. Identificar tenant comprometido e tenant fonte do bypass nos logs.
2. Suspender o `application` suspeito:
   ```sql
   UPDATE applications SET status = 'suspended'
   WHERE id = '<suspect-app-id>';
   ```
3. Revisar `audit_events` cross-tenant:
   ```sql
   SELECT actor_id, action, resource_type, resource_id, created_at, diff_json
   FROM audit_events
   WHERE actor_id IN (
     SELECT user_id FROM tenant_users WHERE tenant_id = '<source-tenant>'
   )
     AND tenant_id != '<source-tenant>'
   ORDER BY created_at DESC;
   ```
4. Se RLS bypass confirmado: **rotacionar service-role** (Runbook B) e revisar políticas RLS em `008_rls.sql`.
5. Comms ao tenant-vítima usando template § 6.1.
6. DPO acionado.
7. Post-mortem (§ 7).

### Runbook D — DDOS / abuso de rate-limit

1. Identificar fonte:
   ```sql
   SELECT key, tokens, capacity, last_refill_at
   FROM rate_limit_buckets
   WHERE last_refill_at >= now() - interval '15 minutes'
     AND tokens < capacity * 0.1
   ORDER BY last_refill_at DESC LIMIT 50;
   ```
2. Ativar Vercel Firewall (Dashboard › Project › Firewall) para bloquear IPs de origem.
3. Se abuso de API key específica: revogar via `applications-rotate-key`.
4. Tunar `rate_limit_consume` se necessário (ver `010_edge_support.sql`).
5. Status page: SEV-2 público se afetar > 10% dos tenants.
6. Post-mortem opcional (§ 7).

---

## 6. Comms templates

> Placeholders: `{{var}}`. Substituir antes de enviar.

### 6.1 Customer notification (impacto direto) — pt-BR

```
Assunto: Incidente AgeKey — {{incident_id}} ({{severity}})

Olá {{tenant_name}},

Detectamos um incidente que afeta {{impact_summary}}.

Status atual: {{mitigation_status}}.
ETA da próxima atualização: {{next_update_at}} (UTC).

O que você deve fazer agora: {{customer_action}}.

Estamos investigando ativamente. Próxima atualização em {{eta}}.

Equipe AgeKey
incident@agekey.com.br
```

### 6.1.en — Customer notification (English)

```
Subject: AgeKey incident — {{incident_id}} ({{severity}})

Hello {{tenant_name}},

We detected an incident affecting {{impact_summary}}.

Current status: {{mitigation_status}}.
Next update ETA: {{next_update_at}} (UTC).

What you should do now: {{customer_action}}.

We are actively investigating. Next update in {{eta}}.

AgeKey team
incident@agekey.com.br
```

### 6.2 Status page — 4 níveis

- **investigating**: "We are investigating reports of {{impact}}. Updates in 30min."
- **identified**: "We identified the cause of {{impact}}: {{summary}}. Working on mitigation."
- **monitoring**: "Mitigation deployed at {{time_utc}}. Monitoring for stability."
- **resolved**: "Incident {{id}} resolved at {{time_utc}}. Post-mortem in {{post_mortem_eta}}."

### 6.3 Notificação ANPD (LGPD Art. 48)

Acionado pelo DPO em ≤ 48h após confirmação de vazamento de dados pessoais.

```
Para: comunicacao@anpd.gov.br
Assunto: Comunicação de incidente de segurança — AgeKey ({{incident_id}})

Conforme LGPD Art. 48, comunicamos:

1. Natureza do incidente: {{incident_nature}}
2. Categorias de dados afetadas: {{data_categories}}
3. Número aproximado de titulares afetados: {{subject_count}}
4. Janela de exposição: {{exposure_window_utc}}
5. Mitigações implementadas: {{mitigations}}
6. Medidas de comunicação aos titulares: {{notification_plan}}

Contato DPO:
{{dpo_name}}
{{dpo_email}}
{{dpo_phone}}

Documentos anexos: relatório técnico preliminar, plano de remediação.
```

### 6.4 Internal Slack/Discord war-room

Header padronizado quando o canal é criado:

```
🚨 INCIDENT — #incident-{{date}}-{{slug}} 🚨
Severidade: {{sev}}
Comandante: @{{commander}}
War-room link: <link-deste-canal>
Status page: <link>
Roles assigned:
  - on-call-primary: @{{primary}}
  - tech-lead: @{{tech_lead}}
  - dpo: @{{dpo}} (somente se SEV-1 ou dados pessoais)
  - comms-lead: @{{comms}}
  - scribe: @{{scribe}}
Timeline (UTC) — append-only:
```

---

## 7. Post-mortem template

Salvar em `compliance/post-mortems/<YYYY-MM-DD>-<slug>.md`. Blameless — sem culpa pessoal.

```markdown
# Post-mortem — {{incident_id}}

**Date**: {{YYYY-MM-DD}}
**Severity**: {{sev}}
**Duration**: {{HH:MM}} (from {{start_utc}} to {{end_utc}})
**Impact**: {{impact_one_liner}}
**Authors**: {{authors}}
**Status**: draft | review | published

## TL;DR

{{2-3 sentences}}

## Timeline (UTC)

| Time | Event | Source |
|---|---|---|
| {{T-1}} | {{event}} | {{log/log-link/observation}} |
| ... | ... | ... |

## Root cause

{{5-whys analysis. Stop at the first systemic cause.}}

## Detection

- Como descobrimos: {{source}}
- Tempo até detection: {{minutes}}
- O que retardou (se aplicável): {{cause}}

## Response

- O que funcionou: {{wins}}
- O que não funcionou: {{misses}}
- Onde perdemos tempo: {{slowness}}

## Action items

| # | Item | Owner | Due | Issue |
|---|---|---|---|---|
| 1 | {{action}} | @{{owner}} | {{date}} | #{{n}} |

## Lessons learned

- {{lesson1}}
- {{lesson2}}

## Customer impact

- Tenants afetados: {{count}}
- Sessões afetadas: {{count}}
- Tokens com integridade questionável: {{count}}
- Comms enviadas: {{customer_emails_count}}

## Comms artifacts

- [ ] Customer notification: {{link}}
- [ ] Status page updates: {{link}}
- [ ] ANPD notification: {{link or "N/A"}}
- [ ] Internal war-room transcript: {{link}}
```

---

## 8. Tabletop SEV-1 — registro de execuções

Cadência mínima: **1 tabletop SEV-1 por trimestre**. Cenários sugeridos (rotacionar):

- Chave de assinatura comprometida (Runbook A)
- Service role vazada via env Preview do Vercel (Runbook B)
- Tenant breakout via prompt-injection no painel (Runbook C)
- DDOS coordenado contra `api.agekey.com.br` (Runbook D)
- Provider gateway com endpoint comprometido (degradação confiança issuers)

Após cada execução: registrar em `compliance/tabletops/<YYYY-MM-DD>-<slug>.md` (formato livre, mas incluir: cenário, participantes, duração, decisões tomadas, falhas do playbook descobertas, action items).

### Tabela de execuções

| Data | Cenário | Comandante | Participantes | Duração | Lições aprendidas |
|---|---|---|---|---|---|
| _vazia — agendar primeiro tabletop_ | | | | | |

---

## 9. Cross-links

- `infrastructure/secrets.md` — rotação de secrets (Runbook B passo 2)
- `infrastructure/environments.md` — promote staging→prod, rollback/DR
- `compliance/ripd-agekey.md` — RIPD/DPIA (input para decisão de comms ANPD)
- `compliance/data-retention-policy.md` — tempos de retenção (input para preservação de logs no incident)
- `compliance/privacy-by-design-record.md` — princípios que guiam decisões de comms
- `security/pentest/scope.md` — findings críticos do pentest viram incidentes via este playbook
- `security/pentest/remediation-tracker.md` — tracker dos action items pós-incident
