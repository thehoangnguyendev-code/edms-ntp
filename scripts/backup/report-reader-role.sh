#!/usr/bin/env bash
# REPORT-BACKUP-RUNS-2026-11-15: creates (or re-sets the password of) the read-only login the application uses to copy the summary of each backup and
# restore run into its own database for the Backup and Restore Runs report. The login can read ONE view (reporting.run_summary: no error text, path,
# key or manifest), only through a read-only session, and holds no other privilege. It is made by an operator, never by the application.
#   BACKUP_REPORT_DB_PASSWORD='...' bash scripts/backup/report-reader-role.sh
# Then put the same password in the environment of the backend (BACKUP_REPORT_DB_PASSWORD) and start it again. Running this again only sets the password.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${BACKUP_REPORT_DB_PASSWORD:?set BACKUP_REPORT_DB_PASSWORD (at least 20 characters)}"
[ "${#BACKUP_REPORT_DB_PASSWORD}" -ge 20 ] || { echo "The password must have at least 20 characters"; exit 2; }
CONTAINER="${EQMS_CONTAINER_PREFIX:-eqms}-backup-control"
# The password reaches psql through its environment (\getenv) and is quoted by psql (:'pw'); it is never on a command line.
MSYS_NO_PATHCONV=1 docker exec -i -e BACKUP_REPORT_DB_PASSWORD "$CONTAINER" psql -v ON_ERROR_STOP=1 -U eqms_backup -d eqms_backup_control \
  <<'SQL' 2>&1 | sed 's/^/  /'
\getenv pw BACKUP_REPORT_DB_PASSWORD
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eqms_backup_report_ro') THEN
        CREATE ROLE eqms_backup_report_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 3;
    END IF;
END
$$;
SELECT format('ALTER ROLE eqms_backup_report_ro WITH LOGIN PASSWORD %L', :'pw') \gexec
ALTER ROLE eqms_backup_report_ro SET default_transaction_read_only = on;
ALTER ROLE eqms_backup_report_ro SET statement_timeout = '30s';
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM eqms_backup_report_ro;
GRANT USAGE ON SCHEMA reporting TO eqms_backup_report_ro;
REVOKE ALL ON ALL TABLES IN SCHEMA reporting FROM eqms_backup_report_ro;
GRANT SELECT ON reporting.run_summary TO eqms_backup_report_ro;
SQL
echo "Read-only reporting login ready: eqms_backup_report_ro (it can read reporting.run_summary only)."
