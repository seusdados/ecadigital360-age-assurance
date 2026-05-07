# Frontend spec — AgeKey Safety Signals

## Rotas no admin

MVP entrega:

- `/safety` — dashboard com alertas abertos + eventos recentes.

Reservadas (skeleton ou criar na rodada P2):

```
/safety/events            — listagem paginada + filtros
/safety/alerts            — listagem por status + severity
/safety/alerts/[id]       — detalhe + ações (acknowledge, resolve)
/safety/rules             — CRUD de regras tenant
/safety/rules/new         — wizard de regra
/safety/rules/[id]        — editor + simulator (chama rule-evaluate)
/safety/subjects          — listagem por subject_ref_hmac (sem PII)
/safety/interactions      — listagem por interaction_id
/safety/evidence          — apenas hash + metadata
/safety/retention         — dashboard de retention (dry-run vs real)
/safety/settings          — feature flags + tenant overrides
/safety/integration       — docs API + sample requests
/safety/reports           — export filtrado de audit_events
```

## Não exibir nunca

- IP bruto.
- `actor_ref_hmac` cru (mostrar apenas truncado: primeiros 12 chars).
- Conteúdo bruto.
- email, telefone, nome, documento, data de nascimento, idade exata.

## Linguagem permitida

- "sinais de risco"
- "evidência minimizada"
- "relação etária"
- "faixa/estado etário"
- "reverificação etária"
- "alerta"
- "ação proporcional"
- "conteúdo bruto não armazenado por padrão"

## Linguagem proibida

- "espionar"
- "interceptar"
- "vigiar crianças"
- "detectar criminosos"
- "provar crime"
- "monitorar tudo"
- "identidade verificada"
- "idade real"
- "documento validado"

## Estado vazio

"Ainda não há eventos. Eles aparecem aqui quando uma aplicação chama
POST /v1/safety/event-ingest."

## Detalhe de alerta (P2)

- header: severity badge + risk_category badge + status pill
- body: reason_codes em chips, lista de event_ids (cada um abrindo
  modal com diff_json minimizado)
- footer: ações `Acknowledge`, `Resolve`, `Dismiss`, `Escalar para
  revisão humana`
- nunca mostrar `metadata` cru — render por chave conhecida; chave
  desconhecida vira "—"
