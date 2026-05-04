# Branch `homologacao` — painel admin operacional na nuvem

Esta branch é **fixa**. Não é mesclada em `main`; existe só para o Vercel manter um Preview estável apontando para o backend de homologação (`wljedzqgprkpqhuazdzv`).

## URL operacional

```
https://ecadigital360-age-assurance-git-homologacao-seusdados.vercel.app
```

Esse URL é a porta de entrada do painel administrativo enquanto o backend de produção (`tpdiccnmsnjtjwhardij`) ainda não tem suas Edge Functions deployadas.

## Manutenção

- **Sincronizar com `main`**: rode `git checkout homologacao && git merge --ff-only main && git push` periodicamente para receber as últimas mudanças.
- **Não fazer commits direto**: toda mudança entra via `main` (PR + merge); esta branch só consome.
- **Apagar quando produção estiver pronta**: quando o deploy do backend `tpdiccnmsnjtjwhardij` estiver completo e o domínio definitivo (`app.agekey.com.br`) estiver configurado, esta branch pode ser removida.

## Variáveis de ambiente no Vercel (escopo Preview)

Conforme registrado em `infrastructure/secrets.md`:

- `NEXT_PUBLIC_SUPABASE_URL=https://wljedzqgprkpqhuazdzv.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anônima do projeto AgeKey-hml>`
- `NEXT_PUBLIC_AGEKEY_API_BASE=https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1`
- `NEXT_PUBLIC_AGEKEY_ISSUER=https://staging.agekey.com.br`
- `NEXT_PUBLIC_APP_URL=https://ecadigital360-age-assurance-git-homologacao-seusdados.vercel.app`
