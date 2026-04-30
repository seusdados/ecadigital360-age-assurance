# AgeKey - Production Readiness Branch Pack

Branch-alvo sugerida: `agekey/production-readiness-20260429`  
Repositório: `seusdados/ecadigital360-age-assurance`  
Data: 2026-04-29

Este pacote foi construído para ser aplicado no monorepo AgeKey sem desperdiçar tokens do Claude Code. Ele contém documentação operacional, compliance, segurança, infraestrutura, especificações de token, contratos de adapters, SDKs nativos de referência implementável e roteirização comercial.

## Como aplicar no repositório

A partir da raiz do repositório local:

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b agekey/production-readiness-20260429

# Copiar o conteúdo deste pacote para a raiz do repo.
# Exemplo, se o zip foi extraído em ../agekey-production-readiness-20260429:
rsync -av --exclude='AgeKey_Manual_Funcionamento_e_Fluxos.pdf' \
  --exclude='AgeKey_Manual_Funcionamento_e_Fluxos.docx' \
  ../agekey-production-readiness-20260429/ ./

# Os artefatos PDF/DOCX podem ficar versionados em docs/manual/releases/
mkdir -p docs/manual/releases
cp ../agekey-production-readiness-20260429/AgeKey_Manual_Funcionamento_e_Fluxos.pdf docs/manual/releases/
cp ../agekey-production-readiness-20260429/AgeKey_Manual_Funcionamento_e_Fluxos.docx docs/manual/releases/

git status
pnpm install
pnpm typecheck
pnpm lint
pnpm test

git add .
git commit -m "docs: add AgeKey production readiness pack"
git push origin agekey/production-readiness-20260429
```

## Ordem recomendada para o Claude Code

1. Ler `.claude/AGEKEY_IMPLEMENTATION_HANDOFF.md`.
2. Comparar os arquivos novos com o estado real da branch.
3. Aplicar primeiro documentação e specs.
4. Depois integrar contratos TypeScript aos exports existentes.
5. Validar SDK iOS e Android em ambiente próprio.
6. Só então abrir PR para `main`.

## Regra de ouro

Não transformar AgeKey em KYC. O produto deve continuar sendo um motor de elegibilidade etária com privacidade, e não uma plataforma de identificação civil.
