-- Migration: 007_security
-- Tabelas de segurança: rate_limit_buckets, ip_reputation

-- ============================================================
-- RATE_LIMIT_BUCKETS — token bucket por api_key + rota
-- A key é sha256(api_key_hash || ':' || route_slug).
-- Edge Functions leem/escrevem via UPDATE ... RETURNING.
-- ============================================================
CREATE TABLE rate_limit_buckets (
  -- Chave composta: SHA-256(api_key_hash || ':' || route)
  key              text        NOT NULL,
  tenant_id        uuid        REFERENCES tenants (id) ON DELETE CASCADE,

  -- Token bucket state
  tokens           integer     NOT NULL DEFAULT 60,
  capacity         integer     NOT NULL DEFAULT 60,   -- burst máximo
  refill_rate      integer     NOT NULL DEFAULT 1,    -- tokens por segundo
  last_refill_at   timestamptz NOT NULL DEFAULT now(),

  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rate_limit_buckets_pkey  PRIMARY KEY (key)
);

COMMENT ON TABLE  rate_limit_buckets            IS 'Token bucket por api_key + rota para rate limiting.';
COMMENT ON COLUMN rate_limit_buckets.key        IS 'SHA-256(api_key_hash + ":" + route). Nunca expõe a api_key.';
COMMENT ON COLUMN rate_limit_buckets.tokens     IS 'Tokens disponíveis no momento.';
COMMENT ON COLUMN rate_limit_buckets.capacity   IS 'Máximo de tokens (burst). Configurável por plano do tenant.';
COMMENT ON COLUMN rate_limit_buckets.refill_rate IS 'Tokens adicionados por segundo.';

CREATE INDEX idx_rlb_tenant     ON rate_limit_buckets (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_rlb_last_refill ON rate_limit_buckets (last_refill_at);

-- ============================================================
-- IP_REPUTATION — cache de sinais de risco por IP
-- TTL curto (padrão 1 hora). Atualizado pelos Edge Functions.
-- ============================================================
CREATE TABLE ip_reputation (
  ip              inet        NOT NULL,
  risk_score      numeric(4,3) NOT NULL DEFAULT 0.0
                              CHECK (risk_score BETWEEN 0 AND 1),
  signals_json    jsonb       NOT NULL DEFAULT '{}',
  request_count   integer     NOT NULL DEFAULT 1,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),

  CONSTRAINT ip_reputation_pkey  PRIMARY KEY (ip)
);

COMMENT ON TABLE  ip_reputation          IS 'Cache de reputação de IP para risk scoring no adapter fallback.';
COMMENT ON COLUMN ip_reputation.risk_score IS '0 = sem risco conhecido; 1 = alto risco. Threshold para fricção: > 0.7.';
COMMENT ON COLUMN ip_reputation.signals_json IS 'Sinais: vpn_detected, tor_exit, known_fraud, bot_score, etc.';

CREATE INDEX idx_ip_rep_expires ON ip_reputation (expires_at);
CREATE INDEX idx_ip_rep_risk    ON ip_reputation (risk_score DESC) WHERE risk_score > 0.5;
