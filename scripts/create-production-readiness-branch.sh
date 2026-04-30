#!/usr/bin/env bash
set -euo pipefail

BRANCH="agekey/production-readiness-20260429"

git fetch origin
git checkout main
git pull origin main
git checkout -b "$BRANCH"

echo "Copie os arquivos do pacote para a raiz do repo antes de rodar este script, ou rode com PACKAGE_DIR=/caminho/pacote"

if [ "${PACKAGE_DIR:-}" != "" ]; then
  rsync -av "$PACKAGE_DIR"/ ./
fi

pnpm install
pnpm typecheck || true
pnpm lint || true
pnpm test || true

git status

echo "Revise os resultados. Depois:"
echo "git add ."
echo "git commit -m 'docs: add AgeKey production readiness pack'"
echo "git push origin $BRANCH"
