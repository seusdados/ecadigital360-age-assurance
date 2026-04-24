-- Migration: 006_audit_billing
-- Tabelas particionadas mensalmente:
-- audit_events, billing_events, usage_counters
--
-- Particionamento: RANGE(created_at) com partições manuais por mês.
-- Fase 1 cria 12 meses de partições (abril/2026 → março/2027).
-- Fase 2 adotará pg_partman para manutenção automática.

-- ============================================================
-- AUDIT_EVENTS — log de auditoria gerado por triggers
-- APPEND-ONLY: sem UPDATE/DELETE exceto retention job com DETACH PARTITION.
-- ============================================================
CREATE TABLE audit_events (
  id            uuid             NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id     uuid             NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  actor_type    audit_actor_type NOT NULL,
  actor_id      uuid,            -- user_id ou NULL para sistema/cron

  action        text             NOT NULL,  -- ex.: "policy.updated"
  resource_type text             NOT NULL,  -- ex.: "policy"
  resource_id   uuid,

  -- Diff mínimo: apenas campos alterados (sem valores PII)
  diff_json     jsonb            NOT NULL DEFAULT '{}',

  -- Contexto de rede
  client_ip     inet,
  user_agent    text,

  created_at    timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT audit_events_pkey  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE  audit_events           IS 'Log de auditoria de todas as ações relevantes. Append-only, particionado por mês.';
COMMENT ON COLUMN audit_events.diff_json IS 'Campos alterados sem valores PII. Para deleções inclui snapshot antes.';

-- Partições manuais: abril/2026 até março/2027 (12 meses)
CREATE TABLE audit_events_2026_04 PARTITION OF audit_events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_events_2026_05 PARTITION OF audit_events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_events_2026_06 PARTITION OF audit_events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_events_2026_07 PARTITION OF audit_events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_events_2026_08 PARTITION OF audit_events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE audit_events_2026_09 PARTITION OF audit_events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE audit_events_2026_10 PARTITION OF audit_events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE audit_events_2026_11 PARTITION OF audit_events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE audit_events_2026_12 PARTITION OF audit_events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE audit_events_2027_01 PARTITION OF audit_events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE audit_events_2027_02 PARTITION OF audit_events FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE audit_events_2027_03 PARTITION OF audit_events FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- Partição default (catch-all) — protege contra linhas fora do range previsto
CREATE TABLE audit_events_default PARTITION OF audit_events DEFAULT;

CREATE INDEX idx_audit_events_tenant ON audit_events (tenant_id, created_at DESC);
CREATE INDEX idx_audit_events_action ON audit_events (action, created_at DESC);
CREATE INDEX idx_audit_events_resource ON audit_events (resource_type, resource_id) WHERE resource_id IS NOT NULL;

-- ============================================================
-- BILLING_EVENTS — cada verificação processada, para cobrança
-- Particionado por mês. APPEND-ONLY.
-- ============================================================
CREATE TABLE billing_events (
  id             uuid                  NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id      uuid                  NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id uuid                  NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  session_id     uuid                  NOT NULL REFERENCES verification_sessions (id) ON DELETE CASCADE,

  event_type     text                  NOT NULL,  -- "verification.completed"
  method         verification_method   NOT NULL,
  decision       verification_decision NOT NULL,

  billable_units integer               NOT NULL DEFAULT 1 CHECK (billable_units > 0),

  -- Mês de referência, calculado em UTC para ser IMMUTABLE.
  -- Cast para timestamp (sem tz) transforma date_trunc em IMMUTABLE.
  period_month   date                  NOT NULL
                   GENERATED ALWAYS AS (
                     (date_trunc('month', (created_at AT TIME ZONE 'UTC')))::date
                   ) STORED,

  created_at     timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT billing_events_pkey  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE  billing_events              IS 'Uma linha por verificação processada. Base para cobrança e relatórios.';
COMMENT ON COLUMN billing_events.period_month IS 'Gerada automaticamente — primeiro dia do mês da criação, em UTC.';

CREATE TABLE billing_events_2026_04 PARTITION OF billing_events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE billing_events_2026_05 PARTITION OF billing_events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE billing_events_2026_06 PARTITION OF billing_events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE billing_events_2026_07 PARTITION OF billing_events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE billing_events_2026_08 PARTITION OF billing_events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE billing_events_2026_09 PARTITION OF billing_events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE billing_events_2026_10 PARTITION OF billing_events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE billing_events_2026_11 PARTITION OF billing_events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE billing_events_2026_12 PARTITION OF billing_events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE billing_events_2027_01 PARTITION OF billing_events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE billing_events_2027_02 PARTITION OF billing_events FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE billing_events_2027_03 PARTITION OF billing_events FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

CREATE TABLE billing_events_default PARTITION OF billing_events DEFAULT;

CREATE INDEX idx_billing_events_tenant  ON billing_events (tenant_id, period_month);
CREATE INDEX idx_billing_events_app     ON billing_events (application_id, period_month);
CREATE INDEX idx_billing_events_session ON billing_events (session_id);

-- ============================================================
-- USAGE_COUNTERS — agregado diário por (tenant, application, day)
-- Atualizado por trigger em billing_events.
-- Tenant totals: SUM(verifications_*) GROUP BY tenant_id, day.
-- ============================================================
CREATE TABLE usage_counters (
  tenant_id               uuid    NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id          uuid    NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  day                     date    NOT NULL,

  verifications_created   integer NOT NULL DEFAULT 0,
  verifications_approved  integer NOT NULL DEFAULT 0,
  verifications_denied    integer NOT NULL DEFAULT 0,
  tokens_issued           integer NOT NULL DEFAULT 0,
  webhooks_delivered      integer NOT NULL DEFAULT 0,

  CONSTRAINT usage_counters_pkey  PRIMARY KEY (tenant_id, application_id, day)
);

COMMENT ON TABLE usage_counters IS 'Agregado diário (tenant, app, day). Tenant totals via SUM no query time.';

CREATE INDEX idx_usage_counters_tenant ON usage_counters (tenant_id, day DESC);
