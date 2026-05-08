# Incident Response Playbook — AgeKey

> Versão: 2026-05-07.
> Aplicável a todos os ambientes; PROD recebe prioridade máxima.
> Revisão mínima anual ou após cada incidente SEV-1/SEV-2.

## 1. Objetivo

Definir fases, responsabilidades e prazos para resposta a incidentes de segurança e privacidade, em conformidade com LGPD art. 48 (comunicação à ANPD em prazo razoável — alvo operacional: **até 72 horas** após constatação de incidente com risco/dano relevante).

## 2. Fases (modelo NIST adaptado)

```
Detect → Contain → Eradicate → Recover → Notify → Post-mortem
```

### 2.1 Detect (Detectar)

- **Fontes:** alertas de monitoramento, suíte cross-tenant em CI, advisors do Supabase, relatos de clientes/integradores, Privacy Guard em runtime, scanners externos, comunicação de subprocessador, *bug bounty*.
- **Triagem inicial:** plantão on-call confirma o sinal e abre ticket interno com classificação preliminar de severidade (§3).

### 2.2 Contain (Conter)

- Ações imediatas para limitar o blast radius:
  - revogação de chaves;
  - desabilitação de feature flag;
  - bloqueio de endpoint via WAF/Cloudflare;
  - pausar Edge Function afetada;
  - suspensão de tenant/aplicação se indício de comprometimento.
- **Sem destruir evidências.**

### 2.3 Eradicate (Erradicar)

- Identificar causa raiz.
- Aplicar fix ou mitigação permanente.
- Validar com testes (unit + cross-tenant + Privacy Guard).
- Re-deploy com versão corrigida.

### 2.4 Recover (Recuperar)

- Restaurar serviço normal.
- Reverter feature flags se aplicável.
- Monitoramento intensivo nas primeiras 24 h.

### 2.5 Notify (Comunicar)

- **Internamente:** liderança técnica + DPO em SEV-1 imediatamente; demais conforme severidade.
- **Controlador(es) afetado(s):** prazo proporcional à severidade (ver §4).
- **ANPD:** quando houver risco/dano relevante a titulares, em até **72 horas** após a constatação do incidente, conforme LGPD art. 48. O DPO conduz a comunicação.
- **Titulares:** quando exigido pela ANPD ou por avaliação proporcional do controlador.
- **Subprocessadores:** se relevantes.

### 2.6 Post-mortem

- Relatório com:
  - linha do tempo;
  - causa raiz;
  - controles que falharam;
  - controles que funcionaram;
  - ações corretivas (com responsável e prazo);
  - lições aprendidas.
- Compartilhado internamente; resumo público quando exigido legal/contratualmente.
- Atualização desta política, do RIPD e da PbD se decisões arquiteturais foram afetadas.

## 3. Matriz de severidade

### 3.1 SEV-1 — Crítico

| Exemplo | Resposta |
|---|---|
| `service_role` Supabase exposta | Rotação imediata; invalidar deployments antigos. |
| Chave privada de assinatura (JWS ES256) exposta | Rotação imediata; revogar JTIs ativos; notificar consumidores de token. |
| Tenant breakout / RLS bypass confirmado | Suspensão das tabelas afetadas; auditoria full; comunicação prioritária. |
| PII presente em token público ou webhook | Cancelar entrega; gerar tokens novos; notificar controlador. |
| Storage privado tornado público acidentalmente | Re-aplicar bucket policy; auditoria de acesso; notificar. |
| Token forgery (assinatura aceita indevidamente) | Revogar chave; investigar lib/algoritmo; comunicar. |
| Vazamento de banco completo | Resposta full + notificação ANPD em até 72 h. |

**SLO de contenção:** ≤ 1 hora.
**SLO de notificação ao controlador afetado:** ≤ 24 horas após confirmação.
**Notificação ANPD:** em até 72 horas se risco/dano relevante.

### 3.2 SEV-2 — Alto

| Exemplo | Resposta |
|---|---|
| Spoofing de webhook (fora do tenant) | Bloquear origem; rotacionar secret de webhook; revisar logs. |
| Falha de uniqueness de nonce | Patch + re-deploy; auditar sessões afetadas. |
| Logs com PII parcial detectados em ambiente | Purga de logs; revisão do redator/Privacy Guard. |
| Provider externo (issuer/gateway) reporta comprometimento | Pausar integração; notificar tenants que usam o provider. |
| Indisponibilidade parcial sustentada (>30 min) | Failover ou degradação anunciada. |
| OTP de guardian entregue ao destinatário errado | Pausar provider; notificar guardian/controlador; auditoria. |

**SLO de contenção:** ≤ 4 horas.
**Notificação ao controlador afetado:** ≤ 48 horas.

### 3.3 SEV-3 — Médio/Baixo

| Exemplo | Resposta |
|---|---|
| Erro de documentação | Patch via PR. |
| Falha pontual sem exposição de dados | Investigar; backlog. |
| Degradação de performance contornada por retry | Investigar; backlog. |
| Vulnerabilidade reportada com mitigação configurada | Backlog priorizado. |

**SLO:** próxima janela de manutenção.

## 4. Comunicação à ANPD (LGPD art. 48)

Quando configurado risco/dano relevante a titulares:

1. **Prazo alvo:** até **72 horas** da constatação.
2. **Conteúdo mínimo:**
   - descrição da natureza do incidente;
   - dados afetados (categorias, volume estimado);
   - titulares envolvidos (categorias, volume estimado);
   - medidas técnicas e de segurança usadas para proteção dos dados;
   - riscos relacionados ao incidente;
   - motivo do atraso, se aplicável;
   - medidas adotadas ou que serão adotadas para reverter ou mitigar efeitos.
3. **Canal:** o DPO formaliza via canal oficial da ANPD.
4. **Atualizações:** complementar quando novas informações se tornarem disponíveis.

## 5. Runbooks específicos

### 5.1 Chave de assinatura (JWS ES256) comprometida

1. Marcar `crypto_keys.status = 'compromised'` (audit log).
2. Rodar `key-rotation` (Edge Function).
3. Atualizar `jwks` público.
4. Avisar consumidores de token para validação online (não confiar em cache).
5. Revogar JTIs emitidos pela chave comprometida (`result_tokens`).
6. Relatório pós-incidente.

### 5.2 `service_role` Supabase exposta

1. Rotacionar imediatamente no painel Supabase do projeto afetado.
2. Atualizar variáveis de ambiente em Vercel/Edge Functions.
3. Invalidar deployments antigos (Vercel: `Promote latest`; Supabase: re-deploy).
4. Auditar logs de acesso (`get_logs`) das últimas 72 h.
5. Verificar alterações em tabelas sensíveis.
6. Rodar suíte cross-tenant (`packages/integration-tests/`).
7. Relatório.

### 5.3 PII detectada em payload público

1. Bloquear endpoint via flag/WAF.
2. Reproduzir e identificar caminho de inserção.
3. Reforçar Privacy Guard com novo vetor de teste.
4. Notificar controlador(es) afetado(s).
5. Avaliar comunicação ANPD.
6. Re-deploy e fechamento.

### 5.4 RLS bypass / tenant breakout suspeito

1. Pausar feature ou função afetada.
2. Coletar query plans e logs.
3. Validar políticas RLS por tabela (e partições — migrations 030).
4. Aplicar fix; rodar suíte cross-tenant.
5. Notificação proporcional.

### 5.5 Vazamento via subprocessador

1. Confirmar comunicação oficial do subprocessador.
2. Mapear tenants impactados.
3. Aplicar mitigação no nosso lado (rotação de credenciais, troca de provider, *fallback*).
4. Comunicar tenants e, se aplicável, ANPD.

## 6. Papéis

| Papel | Responsabilidade primária |
|---|---|
| On-call de plantão | Detecção, triagem inicial, contenção. |
| Líder de incidente | Coordenação técnica e decisões de mitigação. |
| DPO/Encarregado | Comunicação ANPD e a controladores; consultor de risco. |
| Liderança de produto | Decisão sobre comunicação a titulares e ao mercado. |
| Eng. de plataforma | Erradicação, recovery, post-mortem técnico. |

## 7. Ferramentas

- Supabase Logs / Advisors (`get_logs`, `get_advisors`).
- Vercel Logs.
- GitHub Audit Log.
- Suíte cross-tenant: `packages/integration-tests/`.
- Privacy Guard tests: `packages/shared/__tests__/privacy-guard*.test.ts`.

## 8. Histórico

| Data | Mudança |
|---|---|
| 2026-04-29 | Versão inicial (severidade + runbook básico). |
| 2026-05-06 | Expansão SEV-1 tabletop (PR #25). |
| 2026-05-07 | Estrutura por fases NIST + matriz consolidada + comunicação ANPD em até 72 h + runbook adicional para vazamento via subprocessador. |

## 9. Referências

- [`ripd-agekey.md`](./ripd-agekey.md).
- [`data-retention-policy.md`](./data-retention-policy.md).
- [`subprocessors-register.md`](./subprocessors-register.md).
- [`privacy-by-design-record.md`](./privacy-by-design-record.md).
- LGPD art. 48 (comunicação de incidentes).
