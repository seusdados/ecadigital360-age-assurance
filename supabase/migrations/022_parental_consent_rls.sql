-- Migration: 022_parental_consent_rls
--
-- RLS para todas as tabelas do AgeKey Consent.
-- Princípio: SELECT por current_tenant_id(); INSERT/UPDATE bloqueados
-- exceto para service_role (Edge Functions).
--
-- Adicionalmente: triggers de imutabilidade para parental_consents,
-- parental_consent_revocations e consent_text_versions (append-only).

-- ============================================================
-- consent_text_versions
-- ============================================================
ALTER TABLE consent_text_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ctv_select ON consent_text_versions
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY ctv_insert ON consent_text_versions
  FOR INSERT WITH CHECK (false);

CREATE POLICY ctv_update ON consent_text_versions
  FOR UPDATE USING (false);

-- ============================================================
-- parental_consent_requests
-- ============================================================
ALTER TABLE parental_consent_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcr_select ON parental_consent_requests
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY pcr_insert ON parental_consent_requests
  FOR INSERT WITH CHECK (false);

CREATE POLICY pcr_update ON parental_consent_requests
  FOR UPDATE USING (false);

-- ============================================================
-- guardian_contacts
-- Tabela mais sensível do módulo. Service_role only para tudo.
-- Admin do tenant lê apenas via visões minimizadas (contact_masked).
-- ============================================================
ALTER TABLE guardian_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY gc_select ON guardian_contacts
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY gc_insert ON guardian_contacts
  FOR INSERT WITH CHECK (false);

CREATE POLICY gc_update ON guardian_contacts
  FOR UPDATE USING (false);

CREATE POLICY gc_delete ON guardian_contacts
  FOR DELETE USING (false);

-- ============================================================
-- guardian_verifications
-- Sem leitura externa de hash de OTP. Service_role only.
-- ============================================================
ALTER TABLE guardian_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY gv_select ON guardian_verifications
  FOR SELECT USING (false);

CREATE POLICY gv_insert ON guardian_verifications
  FOR INSERT WITH CHECK (false);

CREATE POLICY gv_update ON guardian_verifications
  FOR UPDATE USING (false);

-- ============================================================
-- parental_consents — APPEND-ONLY
-- ============================================================
ALTER TABLE parental_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_select ON parental_consents
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY pc_insert ON parental_consents
  FOR INSERT WITH CHECK (false);

CREATE POLICY pc_update ON parental_consents
  FOR UPDATE USING (false);

CREATE POLICY pc_delete ON parental_consents
  FOR DELETE USING (false);

-- Trigger de imutabilidade: rejeita UPDATE/DELETE em campos críticos.
-- Apenas `revoked_at` pode ser atualizado.
CREATE OR REPLACE FUNCTION parental_consents_no_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'parental_consents é append-only (DELETE bloqueado)';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Permite apenas revogação.
    IF NEW.id <> OLD.id
       OR NEW.tenant_id <> OLD.tenant_id
       OR NEW.consent_request_id <> OLD.consent_request_id
       OR NEW.policy_id <> OLD.policy_id
       OR NEW.policy_version_id <> OLD.policy_version_id
       OR NEW.consent_text_version_id <> OLD.consent_text_version_id
       OR NEW.decision <> OLD.decision
       OR NEW.purpose_codes <> OLD.purpose_codes
       OR NEW.data_categories <> OLD.data_categories
       OR NEW.guardian_contact_hmac <> OLD.guardian_contact_hmac
       OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
       OR NEW.created_at <> OLD.created_at
    THEN
      RAISE EXCEPTION 'parental_consents é append-only (apenas revoked_at pode ser atualizado)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parental_consents_no_mutation ON parental_consents;
CREATE TRIGGER trg_parental_consents_no_mutation
  BEFORE UPDATE OR DELETE ON parental_consents
  FOR EACH ROW EXECUTE FUNCTION parental_consents_no_mutation();

-- ============================================================
-- parental_consent_tokens
-- ============================================================
ALTER TABLE parental_consent_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY pct_select ON parental_consent_tokens
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY pct_insert ON parental_consent_tokens
  FOR INSERT WITH CHECK (false);

CREATE POLICY pct_update ON parental_consent_tokens
  FOR UPDATE USING (false);

-- ============================================================
-- parental_consent_revocations — APPEND-ONLY
-- ============================================================
ALTER TABLE parental_consent_revocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcrev_select ON parental_consent_revocations
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY pcrev_insert ON parental_consent_revocations
  FOR INSERT WITH CHECK (false);

CREATE POLICY pcrev_update ON parental_consent_revocations
  FOR UPDATE USING (false);

CREATE POLICY pcrev_delete ON parental_consent_revocations
  FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION parental_consent_revocations_no_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'parental_consent_revocations é append-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parental_consent_revocations_no_mutation ON parental_consent_revocations;
CREATE TRIGGER trg_parental_consent_revocations_no_mutation
  BEFORE UPDATE OR DELETE ON parental_consent_revocations
  FOR EACH ROW EXECUTE FUNCTION parental_consent_revocations_no_mutation();
