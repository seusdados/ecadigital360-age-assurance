-- Migration: 008_rls
-- Habilita RLS em todas as tabelas de negócio e define políticas
-- baseadas em current_tenant_id() e has_role().
--
-- Regra geral:
--   - tenant_id = current_tenant_id()  para SELECT/INSERT/UPDATE
--   - service_role bypassa RLS (usado pelas Edge Functions com service_key)
--   - Tabelas globais (issuers, crypto_keys, jurisdictions) usam políticas específicas

-- ============================================================
-- HELPER: predicado de acesso ao tenant corrente
-- ============================================================
-- (current_tenant_id() já definido em 000_bootstrap.sql)

-- ============================================================
-- TENANTS
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_select ON tenants
  FOR SELECT USING (
    id = current_tenant_id()
  );

CREATE POLICY tenants_insert ON tenants
  FOR INSERT WITH CHECK (false);  -- apenas service_role pode criar tenants

CREATE POLICY tenants_update ON tenants
  FOR UPDATE USING (
    id = current_tenant_id() AND has_role('admin')
  );

-- Sem DELETE via RLS; soft delete apenas via service_role

-- ============================================================
-- TENANT_USERS
-- ============================================================
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_users_select ON tenant_users
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_users_insert ON tenant_users
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY tenant_users_update ON tenant_users
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY tenant_users_delete ON tenant_users
  FOR DELETE USING (
    tenant_id = current_tenant_id() AND has_role('owner')
  );

-- ============================================================
-- APPLICATIONS
-- ============================================================
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY applications_select ON applications
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND deleted_at IS NULL
  );

CREATE POLICY applications_insert ON applications
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY applications_update ON applications
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin') AND deleted_at IS NULL
  );

-- ============================================================
-- POLICIES
-- ============================================================
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY policies_select ON policies
  FOR SELECT USING (
    (tenant_id = current_tenant_id() OR is_template = true) AND deleted_at IS NULL
  );

CREATE POLICY policies_insert ON policies
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY policies_update ON policies
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin') AND deleted_at IS NULL
  );

-- ============================================================
-- POLICY_VERSIONS (read-only via RLS; escrita apenas via trigger/service_role)
-- ============================================================
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_versions_select ON policy_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM policies p
      WHERE p.id = policy_versions.policy_id
        AND (p.tenant_id = current_tenant_id() OR p.is_template = true)
    )
  );

CREATE POLICY policy_versions_insert ON policy_versions
  FOR INSERT WITH CHECK (false);  -- apenas via trigger

-- ============================================================
-- JURISDICTIONS (leitura pública, escrita apenas service_role)
-- ============================================================
ALTER TABLE jurisdictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY jurisdictions_select ON jurisdictions
  FOR SELECT USING (true);

CREATE POLICY jurisdictions_insert ON jurisdictions
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- VERIFICATION_SESSIONS
-- ============================================================
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY vsessions_select ON verification_sessions
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY vsessions_insert ON verification_sessions
  FOR INSERT WITH CHECK (false);  -- apenas Edge Functions via service_role

CREATE POLICY vsessions_update ON verification_sessions
  FOR UPDATE USING (false);       -- apenas Edge Functions via service_role

-- ============================================================
-- VERIFICATION_CHALLENGES (apenas service_role)
-- ============================================================
ALTER TABLE verification_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY vchallenges_select ON verification_challenges
  FOR SELECT USING (false);  -- serviço interno apenas

CREATE POLICY vchallenges_insert ON verification_challenges
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- PROOF_ARTIFACTS
-- ============================================================
ALTER TABLE proof_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY partifacts_select ON proof_artifacts
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('auditor')
  );

CREATE POLICY partifacts_insert ON proof_artifacts
  FOR INSERT WITH CHECK (false);  -- Edge Functions via service_role

-- ============================================================
-- VERIFICATION_RESULTS
-- ============================================================
ALTER TABLE verification_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY vresults_select ON verification_results
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY vresults_insert ON verification_results
  FOR INSERT WITH CHECK (false);  -- append-only via Edge Functions

-- ============================================================
-- RESULT_TOKENS
-- ============================================================
ALTER TABLE result_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY rtokens_select ON result_tokens
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY rtokens_insert ON result_tokens
  FOR INSERT WITH CHECK (false);

CREATE POLICY rtokens_update ON result_tokens
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

-- ============================================================
-- ISSUERS (leitura para todos os membros; escrita service_role)
-- ============================================================
ALTER TABLE issuers ENABLE ROW LEVEL SECURITY;

CREATE POLICY issuers_select ON issuers
  FOR SELECT USING (
    (tenant_id IS NULL OR tenant_id = current_tenant_id()) AND deleted_at IS NULL
  );

CREATE POLICY issuers_insert ON issuers
  FOR INSERT WITH CHECK (false);  -- via Edge Function issuers-register (service_role)

CREATE POLICY issuers_update ON issuers
  FOR UPDATE USING (false);

-- ============================================================
-- TRUST_LISTS
-- ============================================================
ALTER TABLE trust_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY trust_lists_select ON trust_lists
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY trust_lists_insert ON trust_lists
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY trust_lists_update ON trust_lists
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY trust_lists_delete ON trust_lists
  FOR DELETE USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

-- ============================================================
-- ISSUER_REVOCATIONS (leitura pública; escrita service_role)
-- ============================================================
ALTER TABLE issuer_revocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY irevocations_select ON issuer_revocations
  FOR SELECT USING (true);

CREATE POLICY irevocations_insert ON issuer_revocations
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- REVOCATIONS
-- ============================================================
ALTER TABLE revocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY revocations_select ON revocations
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('auditor')
  );

CREATE POLICY revocations_insert ON revocations
  FOR INSERT WITH CHECK (false);  -- via Edge Function token-revoke

-- ============================================================
-- CRYPTO_KEYS (apenas service_role — nunca exposto ao painel)
-- ============================================================
ALTER TABLE crypto_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY crypto_keys_select ON crypto_keys
  FOR SELECT USING (false);

CREATE POLICY crypto_keys_insert ON crypto_keys
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- WEBHOOK_ENDPOINTS
-- ============================================================
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY wendpoints_select ON webhook_endpoints
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND deleted_at IS NULL
  );

CREATE POLICY wendpoints_insert ON webhook_endpoints
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY wendpoints_update ON webhook_endpoints
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin') AND deleted_at IS NULL
  );

-- ============================================================
-- WEBHOOK_DELIVERIES
-- ============================================================
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY wdeliveries_select ON webhook_deliveries
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('operator')
  );

CREATE POLICY wdeliveries_insert ON webhook_deliveries
  FOR INSERT WITH CHECK (false);  -- via Edge Function webhooks-worker

-- ============================================================
-- AUDIT_EVENTS
-- ============================================================
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_events_select ON audit_events
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('auditor')
  );

CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT WITH CHECK (false);  -- via trigger (SECURITY DEFINER)

-- ============================================================
-- BILLING_EVENTS
-- ============================================================
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_events_select ON billing_events
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('billing')
  );

CREATE POLICY billing_events_insert ON billing_events
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- USAGE_COUNTERS
-- ============================================================
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_counters_select ON usage_counters
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY usage_counters_upsert ON usage_counters
  FOR INSERT WITH CHECK (false);  -- apenas trigger

-- ============================================================
-- RATE_LIMIT_BUCKETS (apenas service_role)
-- ============================================================
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY rlb_select ON rate_limit_buckets
  FOR SELECT USING (false);

CREATE POLICY rlb_upsert ON rate_limit_buckets
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- IP_REPUTATION (apenas service_role)
-- ============================================================
ALTER TABLE ip_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY iprep_select ON ip_reputation
  FOR SELECT USING (false);

CREATE POLICY iprep_upsert ON ip_reputation
  FOR INSERT WITH CHECK (false);
