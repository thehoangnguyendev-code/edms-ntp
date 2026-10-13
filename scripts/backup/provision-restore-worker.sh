#!/usr/bin/env bash
# Prepares the DEV restore worker. Safe to run again: it only creates what is missing.
#   1. a random password for the restore role, appended to the (git-ignored) .env
#   2. the restore role eqms_restore on the DEV PostgreSQL: it may log in and create databases, it owns and can read none of the
#      eQMS data. Rehearsals create their own scratch databases with names starting eqms_restore_ and drop them afterwards.
# DEV only. TEST and PROD create this role and key holding by the people who hold them (SDS-BR-001 section 8.4).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env"
[ -f "$ENV_FILE" ] || { echo ".env not found: this script is for the DEV environment"; exit 1; }
grep -q '^EQMS_ENVIRONMENT=' "$ENV_FILE" && ! grep -q '^EQMS_ENVIRONMENT=DEV' "$ENV_FILE" && { echo "refusing: .env is not a DEV environment"; exit 1; }

get() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'; }

if ! grep -q '^BACKUP_RESTORE_DB_PASSWORD=' "$ENV_FILE"; then
  [ -n "$(tail -c1 "$ENV_FILE")" ] && echo >> "$ENV_FILE"
  echo "BACKUP_RESTORE_DB_PASSWORD=$(openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-40)" >> "$ENV_FILE"
  echo "created BACKUP_RESTORE_DB_PASSWORD in .env"
else
  echo "BACKUP_RESTORE_DB_PASSWORD already present"
fi

PG_USER="$(get POSTGRES_USER)"
RS_PW="$(get BACKUP_RESTORE_DB_PASSWORD)"

echo "== restore role"
docker exec -i eqms-postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -v pw="$RS_PW" <<'SQL'
SELECT format('CREATE ROLE eqms_restore LOGIN CREATEDB NOSUPERUSER NOINHERIT PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eqms_restore') \gexec
SELECT format('ALTER ROLE eqms_restore LOGIN CREATEDB NOSUPERUSER NOINHERIT PASSWORD %L', :'pw') \gexec
SQL
echo "done. Start the worker with: docker compose -f docker-compose.yml -f docker-compose.backup-restore.yml --profile restore-worker up -d backup-restore-worker"
