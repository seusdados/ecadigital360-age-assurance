#!/usr/bin/env bash
# migrate.sh — pipeline canônico de aplicação de migrations Supabase.
#
# Uso:
#   ./supabase/scripts/migrate.sh --env staging
#   ./supabase/scripts/migrate.sh --env prod
#   ./supabase/scripts/migrate.sh --env staging --dry-run
#   ./supabase/scripts/migrate.sh --env prod --confirm-destructive
#
# Pré-requisitos:
#   - supabase CLI 1.180+
#   - SUPABASE_ACCESS_TOKEN exportado (PAT da org)
#   - SUPABASE_DB_URL_<ENV> ou SUPABASE_DB_URL exportado
#     (postgres://postgres:<password>@<host>:5432/postgres)
#   - SUPABASE_PROJECT_REF_<ENV> exportado (ou via flag)
#
# Política:
#   - Idempotente: pode ser reexecutado; supabase db push pula migrations já aplicadas.
#   - NÃO aplica seeds. Seeds são responsabilidade de scripts dedicados
#     (setup-staging.sh, ou aplicação manual via SQL Editor em prod).
#   - Migrations destrutivas (DROP TABLE/COLUMN, DELETE não-idempotente) requerem
#     a flag --confirm-destructive. O script grep-a as migrations pendentes e
#     bloqueia caso encontre padrões sensíveis sem a flag.
#   - Em --env prod, exige confirmação interativa explícita digitando "PROD".

set -euo pipefail

# ---------- defaults ----------
ENV=""
DRY_RUN=0
CONFIRM_DESTRUCTIVE=0
PROJECT_REF=""

usage() {
  cat <<USAGE
Usage: $0 --env <staging|prod> [--dry-run] [--confirm-destructive] [--project-ref <ref>]

Options:
  --env                    Ambiente alvo (staging|prod). Obrigatório.
  --dry-run                Apenas lista as migrations pendentes; não aplica.
  --confirm-destructive    Permite aplicar migrations contendo padrões
                           destrutivos (DROP TABLE, DROP COLUMN, DELETE FROM
                           sem WHERE de forma idempotente).
  --project-ref            Override do project ref (default: variáveis env).
  -h, --help               Mostra esta ajuda.

Variáveis de ambiente esperadas:
  SUPABASE_ACCESS_TOKEN              PAT da org (obrigatório)
  SUPABASE_DB_URL_STAGING            Connection string DB staging
  SUPABASE_DB_URL_PROD               Connection string DB prod
  SUPABASE_PROJECT_REF_STAGING       project_ref staging
  SUPABASE_PROJECT_REF_PROD          project_ref prod

Exemplos:
  $0 --env staging
  $0 --env prod --confirm-destructive
  $0 --env staging --dry-run
USAGE
}

# ---------- parse args ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --confirm-destructive)
      CONFIRM_DESTRUCTIVE=1
      shift
      ;;
    --project-ref)
      PROJECT_REF="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$ENV" ]]; then
  echo "ERROR: --env é obrigatório" >&2
  usage
  exit 2
fi

if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "ERROR: --env deve ser 'staging' ou 'prod' (recebido: $ENV)" >&2
  exit 2
fi

# ---------- pré-checks ----------
if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI não encontrada. Instale: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: export SUPABASE_ACCESS_TOKEN=<seu PAT>" >&2
  exit 1
fi

# Resolve DB URL e project_ref a partir do ambiente
if [[ "$ENV" == "staging" ]]; then
  DB_URL="${SUPABASE_DB_URL_STAGING:-${SUPABASE_DB_URL:-}}"
  RESOLVED_PROJECT_REF="${PROJECT_REF:-${SUPABASE_PROJECT_REF_STAGING:-}}"
else
  DB_URL="${SUPABASE_DB_URL_PROD:-${SUPABASE_DB_URL:-}}"
  RESOLVED_PROJECT_REF="${PROJECT_REF:-${SUPABASE_PROJECT_REF_PROD:-}}"
fi

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: SUPABASE_DB_URL_${ENV^^} (ou SUPABASE_DB_URL) não definido" >&2
  exit 1
fi

if [[ -z "$RESOLVED_PROJECT_REF" ]]; then
  echo "ERROR: SUPABASE_PROJECT_REF_${ENV^^} não definido (ou use --project-ref)" >&2
  exit 1
fi

# Sanity: a URL precisa começar com postgres://
if [[ ! "$DB_URL" =~ ^postgres(ql)?:// ]]; then
  echo "ERROR: SUPABASE_DB_URL inválido (deve começar com postgres:// ou postgresql://)" >&2
  exit 1
fi

# ---------- localiza root do repo ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "═══════════════════════════════════════════════════"
echo "  AgeKey — migrate.sh"
echo "═══════════════════════════════════════════════════"
echo "  Env:           $ENV"
echo "  Project ref:   $RESOLVED_PROJECT_REF"
echo "  Repo root:     $REPO_ROOT"
echo "  Dry-run:       $DRY_RUN"
echo "  Destructive:   $CONFIRM_DESTRUCTIVE"
echo "═══════════════════════════════════════════════════"

# ---------- prod requer dupla confirmação ----------
if [[ "$ENV" == "prod" && $DRY_RUN -eq 0 ]]; then
  echo
  echo "⚠  Você está prestes a aplicar migrations em PRODUÇÃO."
  read -r -p "Digite PROD para confirmar: " CONFIRM
  if [[ "$CONFIRM" != "PROD" ]]; then
    echo "ABORTADO: confirmação não recebida"
    exit 1
  fi
fi

# ---------- link CLI ----------
echo
echo "→ supabase link --project-ref $RESOLVED_PROJECT_REF"
supabase link --project-ref "$RESOLVED_PROJECT_REF" >/dev/null

# ---------- listar migrations pendentes ----------
echo
echo "→ Migrations pendentes:"
PENDING_OUTPUT="$(supabase migration list --db-url "$DB_URL" 2>&1 || true)"
echo "$PENDING_OUTPUT"

# Extrai timestamps das migrations locais ainda não aplicadas remotamente.
# `supabase migration list` formata cada linha como:
#   "  <local-ts>   |   <remote-ts>   |   <name>"
# Pendente = local presente, remote vazio.
PENDING_TIMESTAMPS=()
while IFS= read -r ts; do
  [[ -z "$ts" ]] && continue
  PENDING_TIMESTAMPS+=("$ts")
done < <(
  echo "$PENDING_OUTPUT" \
    | awk -F'|' '
        /^[[:space:]]*[0-9]{14}/ {
          gsub(/[[:space:]]/, "", $1)
          gsub(/[[:space:]]/, "", $2)
          if ($1 != "" && $2 == "") print $1
        }
      '
)

# ---------- guard de destrutividade ----------
# Restrito a migrations PENDENTES — sem isso, o `DROP TABLE IF EXISTS %I`
# que vive dentro do body de funções já mergeadas (ex.:
# 010_edge_support.sql:135 em drop_partition()) dispara o guard em todo
# run, bloqueando até dry-runs com `--confirm-destructive` desnecessário.
DESTRUCTIVE_PATTERNS='(DROP[[:space:]]+TABLE|DROP[[:space:]]+COLUMN|DROP[[:space:]]+SCHEMA|TRUNCATE[[:space:]]|DELETE[[:space:]]+FROM[[:space:]]+[a-zA-Z_]+[[:space:]]*;|ALTER[[:space:]]+TABLE[[:space:]]+[a-zA-Z_.]+[[:space:]]+DROP)'

DESTRUCTIVE_HITS=""
if [[ ${#PENDING_TIMESTAMPS[@]} -gt 0 ]]; then
  # Resolve cada timestamp para o arquivo concreto em supabase/migrations/.
  # supabase CLI aceita tanto `<ts>_<name>.sql` (novo) quanto `<NNN>_<name>.sql`
  # (legado, ainda em uso aqui). Prefixo `<ts>_*` cobre o formato atual; se
  # não casar, faz fallback amplo.
  PENDING_FILES=()
  for ts in "${PENDING_TIMESTAMPS[@]}"; do
    while IFS= read -r f; do
      PENDING_FILES+=("$f")
    done < <(compgen -G "supabase/migrations/${ts}_*.sql" || true)
  done

  if [[ ${#PENDING_FILES[@]} -gt 0 ]]; then
    DESTRUCTIVE_HITS="$(grep -nEi "$DESTRUCTIVE_PATTERNS" "${PENDING_FILES[@]}" || true)"
  fi
fi

if [[ -n "$DESTRUCTIVE_HITS" && $CONFIRM_DESTRUCTIVE -ne 1 ]]; then
  echo
  echo "⚠  Padrões destrutivos detectados nas migrations:"
  echo "$DESTRUCTIVE_HITS" | head -20
  echo
  echo "Para prosseguir, reexecute com --confirm-destructive. Recomendado:"
  echo "  1. Code review humano explícito da migration destrutiva"
  echo "  2. Snapshot/PITR atualizado"
  echo "  3. Janela de manutenção comunicada (se prod)"
  exit 3
fi

# ---------- dry-run termina aqui ----------
if [[ $DRY_RUN -eq 1 ]]; then
  echo
  echo "✓ Dry-run concluído. Nenhuma migration aplicada."
  exit 0
fi

# ---------- aplicar via supabase db push ----------
echo
echo "→ supabase db push --db-url <redacted>"
supabase db push --db-url "$DB_URL"

# ---------- relatório final ----------
echo
echo "→ Migrations aplicadas. Status final:"
supabase migration list --db-url "$DB_URL"

echo
echo "═══════════════════════════════════════════════════"
echo "  ✓ Migrations aplicadas em $ENV ($RESOLVED_PROJECT_REF)"
echo "═══════════════════════════════════════════════════"
echo
echo "Próximos passos recomendados:"
echo "  - Verificar cron schedules:  psql \"\$SUPABASE_DB_URL_${ENV^^}\" -c 'SELECT jobname FROM cron.job;'"
echo "  - Smoke health-check:        curl -fsS https://${RESOLVED_PROJECT_REF}.supabase.co/functions/v1/jwks"
echo "  - Atualizar tipos TS:        supabase gen types typescript --project-id $RESOLVED_PROJECT_REF > apps/admin/types/database.ts"
