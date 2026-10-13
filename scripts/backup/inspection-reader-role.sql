-- Backup Inspection (SDS-BR-001 section 7.2): the read-only role the inspection checks run as.
-- Run once per PostgreSQL server by a database administrator, as a superuser (DEV: the eqms role):
--   docker exec -i eqms-postgres psql -U eqms -d postgres < scripts/backup/inspection-reader-role.sql
-- The role cannot log in and holds no privileges of its own. The restore account (DEV: eqms_restore, AGENT_RESTORE_USER) is made a
-- member so that it can switch to this role with SET ROLE; the agent does this for the checks only. The restore account therefore
-- does not need CREATEROLE, and it can never grant itself more than the copy it made.
-- Running this script again changes nothing.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eqms_inspect_reader') THEN
        CREATE ROLE eqms_inspect_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END
$$;

GRANT eqms_inspect_reader TO eqms_restore;
