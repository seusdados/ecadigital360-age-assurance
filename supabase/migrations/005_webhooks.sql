-- Migration: 005_webhooks
-- Tabelas: webhook_endpoints, webhook_deliveries
--
-- Nota: webhook_deliveries NÃO é particionada em Fase 1.
-- Índice parcial em (status='pending') mantém o hot path pequeno.
-- Partitioning por LIST pode ser introduzido em Fase 2 se necessário.

-- ============================================================
-- WEBHOOK_ENDPOINTS
-- Suporte a múltiplos endpoints por application (além do campo
-- webhook_url em applications para o caso de endpoint único).
-- ============================================================
CREATE TABLE webhook_endpoints (
  id              uuid               NOT NULL DEFAULT uuid_generate_v7(),
  application_id  uuid               NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  tenant_id       uuid               NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name            text               NOT NULL DEFAULT 'default',
  url             text               NOT NULL,
  secret_hash     text               NOT NULL,  -- SHA-256(raw_secret)
  status          application_status NOT NULL DEFAULT 'active',

  -- Eventos subscritos. Array vazio = todos os eventos.
  -- Ex.: ["verification.approved", "proof.revoked"]
  events          text[]             NOT NULL DEFAULT '{}',

  created_at      timestamptz        NOT NULL DEFAULT now(),
  updated_at      timestamptz        NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  CONSTRAINT webhook_endpoints_pkey  PRIMARY KEY (id)
);

COMMENT ON TABLE  webhook_endpoints        IS 'Endpoints de webhook por application. Suporte a múltiplos endpoints.';
COMMENT ON COLUMN webhook_endpoints.events IS 'Array de event types subscritos. Array vazio = subscreve todos.';
COMMENT ON COLUMN webhook_endpoints.secret_hash IS 'SHA-256 do secret raw usado para assinar o payload (HMAC-SHA256).';

CREATE INDEX idx_wendpoints_app    ON webhook_endpoints (application_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wendpoints_tenant ON webhook_endpoints (tenant_id) WHERE deleted_at IS NULL;

-- ============================================================
-- WEBHOOK_DELIVERIES — fila de entregas com retry exponencial
-- Sem particionamento em Fase 1 (revisão em Fase 2).
-- ============================================================
CREATE TABLE webhook_deliveries (
  id                uuid                    NOT NULL DEFAULT uuid_generate_v7(),
  endpoint_id       uuid                    NOT NULL REFERENCES webhook_endpoints (id) ON DELETE CASCADE,
  tenant_id         uuid                    NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  event_type        text                    NOT NULL,
  payload_json      jsonb                   NOT NULL,

  -- Chave de idempotência enviada no header X-AgeKey-Delivery-Id
  idempotency_key   uuid                    NOT NULL DEFAULT uuid_generate_v7(),

  -- Assinatura HMAC-SHA256 do payload (pré-computada)
  signature         text                    NOT NULL,

  status            webhook_delivery_status NOT NULL DEFAULT 'pending',
  attempts          integer                 NOT NULL DEFAULT 0,

  -- Próximo attempt agendado (backoff exponencial)
  next_attempt_at   timestamptz             NOT NULL DEFAULT now(),

  last_response_code integer,
  last_error         text,

  created_at        timestamptz             NOT NULL DEFAULT now(),
  updated_at        timestamptz             NOT NULL DEFAULT now(),

  CONSTRAINT webhook_deliveries_pkey        PRIMARY KEY (id),
  CONSTRAINT webhook_deliveries_idem_uniq   UNIQUE (idempotency_key)
);

COMMENT ON TABLE  webhook_deliveries                 IS 'Fila de entregas de webhook com retry exponencial.';
COMMENT ON COLUMN webhook_deliveries.next_attempt_at IS 'Backoff: 30s, 2m, 10m, 1h, 6h, 24h. Dead-letter após 6 tentativas.';
COMMENT ON COLUMN webhook_deliveries.idempotency_key IS 'Enviado como X-AgeKey-Delivery-Id. Receptor pode deduplicar.';

-- Worker de retry lê por next_attempt_at ASC em status='pending'
CREATE INDEX idx_wdeliveries_pending_next ON webhook_deliveries (next_attempt_at ASC)
  WHERE status = 'pending';
CREATE INDEX idx_wdeliveries_endpoint     ON webhook_deliveries (endpoint_id);
CREATE INDEX idx_wdeliveries_tenant       ON webhook_deliveries (tenant_id, created_at DESC);
CREATE INDEX idx_wdeliveries_status       ON webhook_deliveries (status);
