# Backlog profissional de pendências - AgeKey

## P0 - Bloqueadores de produção

1. Separar staging e production Supabase.
2. Configurar DNS `agekey.com.br`.
3. Garantir que `api.agekey.com.br` exponha API/JWKS de forma estável.
4. Executar testes de RLS cross-tenant.
5. Executar privacy tests de payload.
6. Verificar que `external_user_ref` não recebe PII.
7. Revisar env vars Vercel e Supabase.
8. Confirmar key rotation e JWKS.
9. Criar política de incident response.
10. Realizar pentest antes de GA.

## P1 - Produto comercial

1. SDK Web/widget.
2. Documentação pública de integração.
3. Painel com onboarding completo.
4. Criação de applications e rotação de API key pelo painel.
5. Webhook endpoint management.
6. Token verify dashboard/tester.
7. Logs de auditoria compreensíveis.
8. Billing/usage counters.

## P2 - Integrações

1. Provider gateway Yoti.
2. Provider gateway Veriff.
3. Provider gateway iDwall/Serpro para Brasil.
4. VC/SD-JWT wallet compatible adapter.
5. OpenID4VP request builder.
6. ZKP BBS+ real somente com test vectors e lib validada.

## P3 - SDKs nativos

1. Swift Package.
2. Android Kotlin library.
3. Exemplo iOS.
4. Exemplo Android.
5. Publicação interna antes de distribuição pública.

## P4 - Diferenciais

1. Risk signals sem PII.
2. Dashboard de conversão.
3. Trust registry gerenciado.
4. Multi-region.
5. SLA enterprise.
