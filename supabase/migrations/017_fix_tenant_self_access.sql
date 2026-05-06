-- Migration: 017_fix_tenant_self_access
--
-- Bug: as policies tenant_users_select e tenants_select dependem de
-- current_tenant_id() (lido de app.current_tenant_id setting), que só é
-- setado APÓS a sessão saber em qual tenant atuar. Resultado: o painel
-- nunca consegue descobrir o tenant inicial do usuário recém-logado e
-- redireciona em loop para /onboarding mesmo quando há vínculo válido em
-- tenant_users.
--
-- Repro:
--   1. Criar usuário em auth.users (qualquer email/senha).
--   2. INSERT INTO tenant_users (tenant_id, user_id, role) ...
--   3. Login no painel admin -> /onboarding loop infinito.
--
-- Fix: adiciona policies adicionais que permitem o usuário autenticado
-- ler SUAS PRÓPRIAS linhas em tenant_users e os tenants aos quais ele
-- pertence — sem depender de current_tenant_id(). Não amplia exposição
-- cross-tenant porque o filtro é user_id = auth.uid().
--
-- As policies originais (tenant_users_select, tenants_select) continuam
-- válidas para queries operacionais que setam app.current_tenant_id
-- antes de rodar.

CREATE POLICY tenant_users_select_self
  ON tenant_users
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY tenants_select_for_member
  ON tenants
  FOR SELECT
  USING (
    id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY tenant_users_select_self ON tenant_users IS
  'Permite usuário autenticado ler suas próprias linhas (resolve circularidade com current_tenant_id() durante bootstrap de sessão).';

COMMENT ON POLICY tenants_select_for_member ON tenants IS
  'Permite usuário autenticado ler tenants aos quais pertence (necessário para sidebar e tenant switcher futuro).';
