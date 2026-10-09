#!/bin/bash
# Prepares the DEV environment for the Backup Agent. Safe to run again: it only creates what is missing.
#   1. random secrets for the agent, appended to the (git-ignored) .env
#   2. a read-only database role for the agent on the DEV PostgreSQL
#   3. an OpenPGP key pair for DEV backups. The PRIVATE key stays in backups/dev-keys/ (git-ignored); only the public key
#      is given to the agent container. TEST and PROD must NOT use this script: their keys and secrets are provisioned by
#      the people who hold them (SDS-BR-001 section 8.4).
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env"
[ -f "$ENV_FILE" ] || { echo ".env not found: this script is for the DEV environment"; exit 1; }
grep -q '^EQMS_ENVIRONMENT=' "$ENV_FILE" && ! grep -q '^EQMS_ENVIRONMENT=DEV' "$ENV_FILE" && { echo "refusing: .env is not a DEV environment"; exit 1; }

secret() { openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-40; }
add_secret() {
  if ! grep -q "^$1=" "$ENV_FILE"; then
    [ -n "$(tail -c1 "$ENV_FILE")" ] && echo >> "$ENV_FILE"
    echo "$1=$(secret)" >> "$ENV_FILE"
    echo "created $1 in .env"
  else
    echo "$1 already present"
  fi
}
add_secret BACKUP_CONTROL_DB_PASSWORD
add_secret BACKUP_SOURCE_DB_PASSWORD
add_secret BACKUP_AGENT_API_TOKEN

get() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'; }
PG_USER="$(get POSTGRES_USER)"
PG_DB="$(get POSTGRES_DB)"; PG_DB="${PG_DB:-eqms-database}"
RO_PW="$(get BACKUP_SOURCE_DB_PASSWORD)"

echo "== read-only database role"
docker exec -i eqms-postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -v pw="$RO_PW" -v db="$PG_DB" <<'SQL'
SELECT format('CREATE ROLE eqms_backup_ro LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eqms_backup_ro') \gexec
SELECT format('ALTER ROLE eqms_backup_ro PASSWORD %L', :'pw') \gexec
GRANT pg_read_all_data TO eqms_backup_ro;
-- pg_read_all_data does not cover large objects, and pg_dump stops at the first one it may not read.
-- This setting is applied only to this read-only role.
ALTER ROLE eqms_backup_ro SET lo_compat_privileges = on;
SELECT format('GRANT CONNECT ON DATABASE %I TO eqms_backup_ro', :'db') \gexec
SQL

echo "== OpenPGP key for DEV backups"
KEYS="$ROOT/backups/dev-keys"
mkdir -p "$KEYS/gnupg-home" "$ROOT/backups/dev/t1" "$ROOT/backups/dev/ledger" "$ROOT/backups/dev/agent"
chmod 700 "$KEYS/gnupg-home"
export GNUPGHOME="$KEYS/gnupg-home"
if [ ! -s "$KEYS/public.asc" ]; then
  cat > "$KEYS/keyparams.txt" <<'PARAMS'
%no-protection
Key-Type: eddsa
Key-Curve: ed25519
Key-Usage: sign
Subkey-Type: ecdh
Subkey-Curve: cv25519
Subkey-Usage: encrypt
Name-Real: eQMS DEV Backup Key
Name-Email: backup-dev@eqms.local
Expire-Date: 0
%commit
PARAMS
  gpg --batch --gen-key "$KEYS/keyparams.txt"
  gpg --armor --export backup-dev@eqms.local > "$KEYS/public.asc"
  echo "created the DEV key (private half stays in $KEYS/gnupg-home)"
else
  echo "DEV public key already present"
fi
echo "done"
