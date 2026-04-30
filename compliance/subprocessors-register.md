# Registro de Subprocessadores - AgeKey

| Subprocessador | Função | Dados envolvidos | Região | Status | Observações |
|---|---|---|---|---|---|
| Supabase | Banco, Auth, Storage, Edge Functions | dados técnicos minimizados | a definir | ativo | separar staging/production |
| Vercel | Hosting painel/site/docs | logs técnicos, assets | a definir | ativo | revisar env vars |
| GitHub | Código e CI | código, issues, logs de build | EUA/global | ativo | não armazenar segredos |
| Gateway a definir | age verification provider | depende do provider | a definir | pendente | exigir DPA e minimização |
| E-mail transacional a definir | notificações | e-mail de usuários internos/admin | a definir | pendente | não usuário final salvo regra específica |
