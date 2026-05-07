-- Migration: 025_safety_signals_rls
--
-- RLS para todas as tabelas Safety.
-- Princípio: SELECT por current_tenant_id(); INSERT/UPDATE bloqueados
-- exceto via service_role.

-- ============================================================
-- safety_subjects
-- ============================================================
ALTER TABLE safety_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY ssub_select ON safety_subjects
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY ssub_insert ON safety_subjects
  FOR INSERT WITH CHECK (false);

CREATE POLICY ssub_update ON safety_subjects
  FOR UPDATE USING (false);

CREATE POLICY ssub_delete ON safety_subjects
  FOR DELETE USING (false);

-- ============================================================
-- safety_interactions
-- ============================================================
ALTER TABLE safety_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sint_select ON safety_interactions
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY sint_insert ON safety_interactions
  FOR INSERT WITH CHECK (false);

CREATE POLICY sint_update ON safety_interactions
  FOR UPDATE USING (false);

-- ============================================================
-- safety_events — APPEND-ONLY (UPDATE/DELETE bloqueados)
-- ============================================================
ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY sevt_select ON safety_events
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY sevt_insert ON safety_events
  FOR INSERT WITH CHECK (false);

CREATE POLICY sevt_update ON safety_events
  FOR UPDATE USING (false);

CREATE POLICY sevt_delete ON safety_events
  FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION safety_events_no_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    -- Permite DELETE apenas via retention cleanup quando legal_hold = false.
    -- O cleanup roda como service_role e seta um GUC para sinalizar.
    IF current_setting('agekey.retention_cleanup', true) = 'on'
       AND TG_OP = 'DELETE'
       AND OLD.legal_hold = false
    THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'safety_events é append-only fora do retention cleanup (legal_hold=% op=%)', OLD.legal_hold, TG_OP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_safety_events_no_mutation ON safety_events;
CREATE TRIGGER trg_safety_events_no_mutation
  BEFORE UPDATE OR DELETE ON safety_events
  FOR EACH ROW EXECUTE FUNCTION safety_events_no_mutation();

-- ============================================================
-- safety_rules — admin pode INSERT/UPDATE override per-tenant
-- ============================================================
ALTER TABLE safety_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY srul_select ON safety_rules
  FOR SELECT USING (
    tenant_id IS NULL OR tenant_id = current_tenant_id()
  );

-- Inserts apenas via service_role (Edge Function valida role).
CREATE POLICY srul_insert ON safety_rules
  FOR INSERT WITH CHECK (false);

CREATE POLICY srul_update ON safety_rules
  FOR UPDATE USING (false);

-- ============================================================
-- safety_alerts
-- ============================================================
ALTER TABLE safety_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_select ON safety_alerts
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY sale_insert ON safety_alerts
  FOR INSERT WITH CHECK (false);

CREATE POLICY sale_update ON safety_alerts
  FOR UPDATE USING (false);

-- ============================================================
-- safety_aggregates
-- ============================================================
ALTER TABLE safety_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY sagg_select ON safety_aggregates
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY sagg_insert ON safety_aggregates
  FOR INSERT WITH CHECK (false);

CREATE POLICY sagg_update ON safety_aggregates
  FOR UPDATE USING (false);

-- ============================================================
-- safety_evidence_artifacts
-- ============================================================
ALTER TABLE safety_evidence_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY sea_select ON safety_evidence_artifacts
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY sea_insert ON safety_evidence_artifacts
  FOR INSERT WITH CHECK (false);

CREATE POLICY sea_update ON safety_evidence_artifacts
  FOR UPDATE USING (false);

CREATE POLICY sea_delete ON safety_evidence_artifacts
  FOR DELETE USING (false);

-- Trigger: evidence com legal_hold não pode ser apagada nem ter
-- legal_hold=true reduzido sem aprovação explícita.
CREATE OR REPLACE FUNCTION safety_evidence_no_legal_hold_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.legal_hold = true THEN
      RAISE EXCEPTION 'safety_evidence_artifacts com legal_hold=true não pode ser apagada (RETENTION_LEGAL_HOLD_ACTIVE)';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Não permite remover legal_hold via UPDATE — exige procedimento explícito.
    IF OLD.legal_hold = true AND NEW.legal_hold = false THEN
      RAISE EXCEPTION 'legal_hold só pode ser removido via procedure dedicada';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sea_legal_hold ON safety_evidence_artifacts;
CREATE TRIGGER trg_sea_legal_hold
  BEFORE UPDATE OR DELETE ON safety_evidence_artifacts
  FOR EACH ROW EXECUTE FUNCTION safety_evidence_no_legal_hold_mutation();

-- ============================================================
-- safety_model_runs
-- ============================================================
ALTER TABLE safety_model_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY smr_select ON safety_model_runs
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY smr_insert ON safety_model_runs
  FOR INSERT WITH CHECK (false);

CREATE POLICY smr_update ON safety_model_runs
  FOR UPDATE USING (false);
