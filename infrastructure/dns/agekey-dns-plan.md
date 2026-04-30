# Plano DNS - agekey.com.br

## Domínio

Domínio adquirido: `agekey.com.br`.

## Subdomínios recomendados

| Host | Uso | Destino sugerido |
|---|---|---|
| agekey.com.br | site institucional | Vercel |
| www.agekey.com.br | alias site | Vercel |
| app.agekey.com.br | painel admin | Vercel |
| api.agekey.com.br | API pública/proxy Edge Functions | Vercel/Edge proxy |
| verify.agekey.com.br | fluxo de verificação | Vercel |
| docs.agekey.com.br | documentação | Vercel/Docusaurus |
| status.agekey.com.br | status page | provider de status |
| staging.agekey.com.br | ambiente staging | Vercel |

## Registros

### CNAME

```txt
www      CNAME cname.vercel-dns.com.
app      CNAME cname.vercel-dns.com.
verify   CNAME cname.vercel-dns.com.
docs     CNAME cname.vercel-dns.com.
staging  CNAME cname.vercel-dns.com.
```

### API

Opção 1: `api` via Vercel proxy para Supabase Functions.  
Opção 2: `api` CNAME para gateway/API dedicado futuro.

### E-mail

Configurar conforme provider:

```txt
TXT @ "v=spf1 include:<provider> -all"
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@agekey.com.br"
```

### CAA

```txt
CAA @ 0 issue "letsencrypt.org"
CAA @ 0 issue "pki.goog"
```

## HSTS

Ativar após validar HTTPS em todos os hosts.

## Observações

- Não apontar `api.agekey.com.br` diretamente para Supabase se o contrato público precisar ser estável.
- Usar proxy permite trocar infraestrutura sem quebrar clientes.
