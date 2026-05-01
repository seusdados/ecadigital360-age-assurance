# Plano DNS — `agekey.com.br`

Documento normativo do go-live. Cobre apex, subdomínios, CAA, e-mail
(SPF/DKIM/DMARC), HSTS preload e checklist de validação. A criação
real dos registros é **ação humana no registrar / DNS provider**;
este documento é o source-of-truth para o operador executar.

> Status: **plano** — apenas após `dig` validar todos os records
> e SSL Labs reportar `A+`, marcar `AK-P0-02` como `done`.

---

## 1. Domínio raiz

- Domínio: `agekey.com.br` (já adquirido, registrar = Registro.br).
- DNS provider: **a definir entre Cloudflare ou Vercel DNS** —
  recomendado **Cloudflare** (suporte ALIAS no apex, DNSSEC nativo,
  filtros, observabilidade gratuita). Vercel DNS funciona igual
  para os subdomínios mas exige A-record no apex.
- DNSSEC: ativar no registrar **somente após** publicar o KSK do
  provider escolhido. Não habilitar antes — risco de NXDOMAIN.
- TTL durante go-live: `300` (5min). Após 7 dias estáveis: `3600`.

---

## 2. Apex `agekey.com.br`

Vercel é o destino default do site institucional. Existem dois
caminhos suportados:

| Caminho | Record | Valor | Quando usar |
|---|---|---|---|
| **Preferido** (Cloudflare / Route53 / DNSimple) | `ALIAS` ou `ANAME` | `cname.vercel-dns.com.` | provider suporta flattening no apex |
| Fallback (Vercel DNS, Registro.br) | `A` | `76.76.21.21` | provider NÃO suporta ALIAS no apex |

> O IP `76.76.21.21` é o anycast oficial documentado pela Vercel
> para apex domains (https://vercel.com/docs/projects/domains).
> NÃO usar `A` apontando para deployments individuais.

`AAAA` no apex: Vercel ainda não publica IPv6 estável para anycast
de apex. **Não declarar `AAAA`** até a Vercel documentar oficialmente.

---

## 3. Subdomínios

| Host | Type | Value | TTL | Scope | Observação |
|---|---|---|---|---|---|
| `agekey.com.br` | `ALIAS`/`A` | `cname.vercel-dns.com.` / `76.76.21.21` | 300 | site institucional | apex |
| `www.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | redirect 301 → apex | servido pelo mesmo projeto Vercel |
| `app.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | painel admin (`apps/admin`) | autenticação via Supabase |
| `api.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | API pública / proxy Edge Functions | rewrite definido em `apps/admin/next.config.mjs` (ver AK-P0-03) |
| `verify.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | hosted page do fluxo de verificação | iframeável apenas com `frame-ancestors` configurado |
| `docs.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | documentação (Docusaurus / Nextra) | leitura pública |
| `status.agekey.com.br` | `CNAME` | `<provider>.statuspage.io.` | 3600 | status page externa | provider sugerido: Atlassian Statuspage ou Instatus |
| `staging.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | preview/staging | Vercel preview deployments |

> Se `status.agekey.com.br` ainda não tiver provider contratado,
> manter o subdomínio **não publicado** (não criar registro) até a
> escolha. Não criar página HTML estática "coming soon" — risco de
> ser indexada como signal de status real.

---

## 4. CAA — Certification Authority Authorization

Aplicado no apex e replicado em subdomínios sensíveis para reduzir
superfície de mis-issuance.

### 4.1 Apex

```txt
agekey.com.br. CAA 0 issue "letsencrypt.org"
agekey.com.br. CAA 0 issue "pki.goog"
agekey.com.br. CAA 0 issuewild ";"
agekey.com.br. CAA 0 iodef "mailto:security@agekey.com.br"
```

- `issue "letsencrypt.org"` — autoriza Let's Encrypt (Vercel default).
- `issue "pki.goog"` — autoriza Google Trust Services (fallback Vercel).
- `issuewild ";"` — **proíbe** wildcards. Cada subdomínio pega seu
  próprio cert.
- `iodef` — endpoint para CAs reportarem violações. Caixa
  `security@` deve estar monitorada.

### 4.2 Subdomínios críticos

Replicar em `api.agekey.com.br` e `app.agekey.com.br` para defesa em
profundidade:

```txt
api.agekey.com.br. CAA 0 issue "letsencrypt.org"
api.agekey.com.br. CAA 0 issue "pki.goog"
api.agekey.com.br. CAA 0 issuewild ";"
app.agekey.com.br. CAA 0 issue "letsencrypt.org"
app.agekey.com.br. CAA 0 issue "pki.goog"
app.agekey.com.br. CAA 0 issuewild ";"
```

> CAA é herdado pelo apex se não houver record específico no
> subdomínio. A duplicação é redundante porém defensiva: se alguém
> alterar CAA do apex sem revisar `api`, o subdomínio continua
> protegido.

---

## 5. E-mail

### 5.1 Decisão de provider

**Provider escolhido: Google Workspace** (placeholder confirmado para
o go-live; substituível por Fastmail ou Zoho sem impacto contratual).
Justificativa: SLA enterprise, DKIM rotacionável, DMARC reports
suportados, integração com SAML futuro.

> Se a decisão final for "AgeKey não envia e-mail por enquanto",
> ver §5.5 (MX null).

### 5.2 MX

```txt
agekey.com.br. MX 1  smtp.google.com.
```

(Workspace moderno usa apenas `smtp.google.com` como MX único —
não usar mais a lista legada `aspmx.l.google.com` etc.)

### 5.3 SPF

```txt
agekey.com.br. TXT "v=spf1 include:_spf.google.com ~all"
```

- `~all` (softfail) durante bootstrap. Migrar para `-all` (hardfail)
  em ≤30 dias após DMARC monitorando reports sem rejeição inesperada.
- **Nunca** ter mais de um TXT começando com `v=spf1` no apex —
  resolvers tratam como `permerror`.

### 5.4 DKIM

DKIM é gerado no console do provider e deve ser ativado **antes** de
publicar DMARC com `p=quarantine`.

Procedimento Google Workspace:

1. Admin Console → Apps → Google Workspace → Gmail → Authenticate
   email.
2. Gerar chave DKIM 2048 bits, selector `google`.
3. Provider apresenta o record CNAME (não TXT) — copiar valor exato:

```txt
google._domainkey.agekey.com.br. CNAME google._domainkey.<workspace-id>.dkim.<provider>.
```

> Substituir `<workspace-id>` pelo valor literal exibido no Console
> no momento da geração — o valor varia por tenant Google.

4. Aguardar propagação (≤24h), clicar "Start authentication".

Selectors de rotação: prever `google2._domainkey` para rotação em
T+12 meses.

### 5.5 DMARC

```txt
_dmarc.agekey.com.br. TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@agekey.com.br; ruf=mailto:dmarc-forensic@agekey.com.br; fo=1; pct=100; adkim=s; aspf=s"
```

- `p=quarantine` durante go-live; migrar para `p=reject` em T+90d
  após reports limpos.
- `rua` → relatórios agregados (XML diário). Configurar parser
  (Dmarcian, Postmark, ou alias para inbox monitorada).
- `ruf` → forensic reports (cada falha individual). Cuidado: pode
  receber PII — caixa restrita a security/DPO.
- `fo=1` → emite forensic report para qualquer falha SPF ou DKIM.
- `adkim=s` / `aspf=s` → strict alignment, evita header-from
  spoofing por subdomínio.

### 5.6 MX null route (alternativa, caso AgeKey não envie e-mail)

Se a decisão for **não** operar e-mail no domínio nesta fase:

```txt
agekey.com.br. MX 0 .
agekey.com.br. TXT "v=spf1 -all"
_dmarc.agekey.com.br. TXT "v=DMARC1; p=reject; rua=mailto:postmaster@<external-mailbox>"
```

`MX 0 .` é o null-MX padrão (RFC 7505) que sinaliza explicitamente
"este domínio não recebe e-mail".

---

## 6. HSTS preload

HSTS preload é **destrutivo se aplicado prematuramente**: se algum
subdomínio HTTPS falhar após preload, ele fica inacessível em
qualquer browser pelo TTL do preload list (meses).

### 6.1 Header (somente após validação)

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

`max-age=63072000` = 2 anos.

### 6.2 Gating (ordem obrigatória)

1. Todos os subdomínios da §3 servindo HTTPS válido por **≥30 dias**
   ininterruptos.
2. SSL Labs `A+` em apex, `app`, `api`, `verify`, `docs`.
3. Curl manual sem `-k` em todos os hosts retorna 200 com cadeia
   válida.
4. **Apenas então** ativar header HSTS no Vercel para todos os
   projetos (já incluído em `apps/admin/next.config.mjs` rewrites para `api.agekey.com.br`
   — ver AK-P0-03).
5. Submeter em https://hstspreload.org **somente após** o header
   estar live por ≥7 dias com `includeSubDomains; preload`.
6. Após inclusão na preload list, considerar a decisão **irreversível**
   por 6+ meses. Documentar em `infrastructure/secrets.md` a data e
   responsável.

---

## 7. Checklist de validação (go-live)

Executar **na ordem** após criar os records:

```bash
# 1. Apex resolve para anycast Vercel
dig +short A agekey.com.br
# esperado: 76.76.21.21 (ou ALIAS resolvendo no equivalente)

# 2. CNAMEs apontando pra Vercel
dig +short CNAME www.agekey.com.br
dig +short CNAME app.agekey.com.br
dig +short CNAME api.agekey.com.br
dig +short CNAME verify.agekey.com.br
dig +short CNAME docs.agekey.com.br
dig +short CNAME staging.agekey.com.br
# esperado em todos: cname.vercel-dns.com.

# 3. CAA visível no apex e em api/app
dig +short CAA agekey.com.br
dig +short CAA api.agekey.com.br
dig +short CAA app.agekey.com.br

# 4. SPF / DMARC / DKIM
dig +short TXT agekey.com.br | grep spf1
dig +short TXT _dmarc.agekey.com.br
dig +short CNAME google._domainkey.agekey.com.br

# 5. HTTPS efetivo (cada host)
for h in agekey.com.br www.agekey.com.br app.agekey.com.br api.agekey.com.br verify.agekey.com.br docs.agekey.com.br staging.agekey.com.br; do
  echo "=== $h ==="
  curl -sI "https://$h" | head -n 1
done
# esperado: 200/301/308 em todos; nunca curl error 60 (cert)

# 6. Smoke do proxy (Parte B / AK-P0-03)
curl -sI https://api.agekey.com.br/v1/.well-known/jwks.json
# esperado: 200 com Content-Type: application/json
# esperado: header Strict-Transport-Security presente

# 7. SSL Labs
# https://www.ssllabs.com/ssltest/analyze.html?d=api.agekey.com.br
# critério: nota A+ em api, app, verify, apex
```

Se qualquer linha falhar:

- **NÃO** habilitar HSTS preload.
- **NÃO** marcar AK-P0-02 como `done`.
- Investigar o record específico (TTL pode ainda estar propagando —
  esperar até 24h após criação).

---

## 8. Tabela final consolidada

| Host | Type | Value | TTL | Scope |
|---|---|---|---|---|
| `agekey.com.br` | `ALIAS` | `cname.vercel-dns.com.` | 300 | site institucional (apex) |
| `agekey.com.br` | `A` (fallback) | `76.76.21.21` | 300 | apex se provider não suportar ALIAS |
| `agekey.com.br` | `CAA` | `0 issue "letsencrypt.org"` | 3600 | TLS issuance |
| `agekey.com.br` | `CAA` | `0 issue "pki.goog"` | 3600 | TLS issuance fallback |
| `agekey.com.br` | `CAA` | `0 issuewild ";"` | 3600 | proibe wildcard |
| `agekey.com.br` | `CAA` | `0 iodef "mailto:security@agekey.com.br"` | 3600 | CA violation channel |
| `agekey.com.br` | `MX` | `1 smtp.google.com.` | 3600 | inbound mail (Google Workspace) |
| `agekey.com.br` | `TXT` | `v=spf1 include:_spf.google.com ~all` | 3600 | SPF |
| `_dmarc.agekey.com.br` | `TXT` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@agekey.com.br; ruf=mailto:dmarc-forensic@agekey.com.br; fo=1; pct=100; adkim=s; aspf=s` | 3600 | DMARC policy |
| `google._domainkey.agekey.com.br` | `CNAME` | `google._domainkey.<workspace-id>.dkim.google.com.` | 3600 | DKIM (selector `google`) |
| `www.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | redirect 301 → apex |
| `app.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | painel admin |
| `app.agekey.com.br` | `CAA` | `0 issue "letsencrypt.org"` | 3600 | TLS issuance |
| `app.agekey.com.br` | `CAA` | `0 issue "pki.goog"` | 3600 | TLS issuance fallback |
| `app.agekey.com.br` | `CAA` | `0 issuewild ";"` | 3600 | proibe wildcard |
| `api.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | proxy Edge Functions |
| `api.agekey.com.br` | `CAA` | `0 issue "letsencrypt.org"` | 3600 | TLS issuance |
| `api.agekey.com.br` | `CAA` | `0 issue "pki.goog"` | 3600 | TLS issuance fallback |
| `api.agekey.com.br` | `CAA` | `0 issuewild ";"` | 3600 | proibe wildcard |
| `verify.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | hosted verification page |
| `docs.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | documentação |
| `status.agekey.com.br` | `CNAME` | `<provider>.statuspage.io.` | 3600 | status page externa (post-go-live) |
| `staging.agekey.com.br` | `CNAME` | `cname.vercel-dns.com.` | 300 | preview/staging |

---

## 9. Observações operacionais

- **Não apontar `api.agekey.com.br` diretamente para Supabase**
  (`*.supabase.co`). O contrato público é `api.agekey.com.br/v1/*` —
  ver `apps/admin/next.config.mjs` e `infrastructure/vercel-deploy.md` (AK-P0-03).
  Apontar diretamente quebra a abstração e impede troca de
  infraestrutura sem `Host` migration.
- A criação dos registros é **ação humana** no painel do registrar
  Registro.br (ou no DNS provider escolhido). Este documento NÃO
  automatiza criação — não há terraform de DNS no repositório por
  enquanto (item futuro: `AK-P2-XX` — IaC de DNS).
- Mudanças posteriores neste plano devem ser PR-revisadas e
  refletidas no `docs/implementation/pending-work-backlog.md`.
- Para revogar HSTS preload: processo manual no Chromium
  (`chrome://net-internals/#hsts`) só funciona local; remoção real da
  preload list leva ≥6 meses. Tratar HSTS como decisão one-way.
