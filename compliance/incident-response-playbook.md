# Incident Response Playbook - AgeKey

## Severidades

### SEV-1

- service role key exposta;
- private signing key exposta;
- tenant breakout;
- PII em token público;
- storage público com artefatos;
- token forgery.

Resposta: conter imediatamente, revogar chaves, pausar funções afetadas, comunicar clientes impactados, preservar evidências.

### SEV-2

- webhook spoofing;
- falha de nonce;
- logs com PII;
- provider comprometido;
- indisponibilidade parcial.

### SEV-3

- erro de documentação;
- falha pontual sem exposição;
- degradação de performance.

## Fluxo

1. Detectar.
2. Classificar.
3. Conter.
4. Preservar logs.
5. Revogar chaves/tokens se necessário.
6. Corrigir.
7. Retestar.
8. Comunicar.
9. Registrar pós-incidente.

## Runbook para chave de assinatura comprometida

1. Marcar `crypto_keys.status = retired/compromised`.
2. Rodar key rotation.
3. Atualizar JWKS.
4. Revogar JTIs emitidos pela chave se necessário.
5. Avisar clientes para validação online.
6. Criar relatório.

## Runbook para service role exposta

1. Rotacionar imediatamente no Supabase.
2. Atualizar env vars Vercel/Supabase.
3. Invalidar deployments antigos.
4. Revisar logs de acesso.
5. Verificar alterações em tabelas sensíveis.
6. Rodar testes RLS e integridade.
