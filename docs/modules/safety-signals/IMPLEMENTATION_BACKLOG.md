# Backlog — AgeKey Safety Signals

## P1 — Hardening do MVP em produção

- Particionamento mensal de `safety_events` (mirror de `audit_events`).
- Job `safety-aggregates-refresh` com upsert real per-bucket (24h/7d/30d).
- Re-emit explícito de webhook delivery em `safety-alert-dispatch`.
- Elevation: rate-limit progressivo no ingest por `actor_ref_hmac`.
- Métricas Prometheus / OpenTelemetry: `safety.events.ingested`,
  `safety.events.rejected`, `safety.alerts.by_severity`,
  `safety.webhooks.failed`, etc.

## P2 — Painel completo

- `/safety/alerts/[id]` com ações de status.
- `/safety/rules` CRUD + simulator (chama `rule-evaluate`).
- `/safety/events` filtros por canal, relação, faixa etária, intervalo.
- Mapa de cards por severity/status (estado de fila para revisão humana).

## P2 — Aggregates refinados

- Buckets adicionais (`6m`, `12m`).
- Aggregates por categoria (não apenas por actor).
- Recompute on-demand quando regra adicionada referenciar aggregate
  novo.

## P3 — Retention enforcement

- Plug das categorias `safety_*` no `retention-job`.
- Partition DETACH automatizado conforme `retention_until` em massa.
- Legal hold: coluna + UI para marcar manualmente.

## P3 — Step-up automático para risco crítico

- Consent interlock: quando rule retornar
  `parental_consent_required`, edge function chama
  `parental-consent-session-create` automaticamente e devolve o
  `consent_request_id` na decisão (P3 porque exige decisão de produto
  sobre quem paga o evento de Consent gerado por Safety).

## P3 — Pre-send guard v2 (transient content analysis)

Gated por `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED`. Hashing client-side
por imagem; matching contra hashlist de conteúdo conhecido (CSAM
hashlist via parceiro). NUNCA armazena conteúdo. Requer DPA, processo
de denúncia ao NCMEC/SaferNet, e compliance review.

## P3 — Evidence vault enterprise

Gated. Storage criptografado para snapshots de mídia em casos
escalados, com cadeia de custódia e exports formalizados.

## P4 — Governança de modelo

Quando uma camada de modelo for habilitada (não no MVP), `safety_model_runs`
recebe linhas; pipeline de drift; revisão humana obrigatória; relatórios
de bias.

## P4 — SIEM/SOAR integration

Sink de webhook adicional (Splunk, Datadog, ServiceNow, Tines, etc.)
com batches assinados. Ainda metadata-only.

## P4 — Relatórios regulatórios

Export filtrado para autoridades (LGPD ANPD, GDPR DPA, regulatórios
nacionais de plataformas digitais). Anchor de cada export em
`audit_events`.

## Itens explicitamente fora do roadmap

- Reconhecimento facial.
- Biometria comportamental.
- Emotion recognition.
- Score universal cross-tenant.
- Captura de tráfego TLS.
- Detector automático de crimes.
- Análise de dispositivo fora da aplicação cliente.
- Consultar LLM externa sobre conteúdo de menor.
