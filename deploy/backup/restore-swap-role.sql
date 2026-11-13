-- The database role that swaps the restored database in (SDS-BR-003 step 6; Decision Log BACKUP-RESTORE-IMPLEMENTATION-2026-11-09).
-- Run once as a superuser, connected to the maintenance database "postgres":
--   psql -U <superuser> -d postgres -v swap_password="'<password>'" -v live_db="'eqms-database'" -f restore-swap-role.sql
-- The role is not a superuser. It may rename databases it owns or whose owner role it is a member of, and nothing else.
SELECT format('CREATE ROLE eqms_restore_swap LOGIN CREATEDB NOSUPERUSER NOCREATEROLE NOREPLICATION PASSWORD %L', :swap_password)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eqms_restore_swap') \gexec

-- restored databases are created by eqms_restore; membership lets the swap role rename them
GRANT eqms_restore TO eqms_restore_swap;

-- the live database is owned by the swap role, so that it can be renamed (the application's own login keeps working)
SELECT format('ALTER DATABASE %I OWNER TO eqms_restore_swap', :live_db) \gexec

-- A role that is not a superuser cannot end the sessions of the application's login. This function does it for the swap role, and only for
-- the live database and the restore databases; it cannot be used on any other database.
SELECT format($f$
CREATE OR REPLACE FUNCTION public.eqms_end_sessions(target text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $body$
DECLARE ended integer;
BEGIN
    IF target <> %L AND target !~ '^eqms_(keep|restore)_[a-z0-9_]+$' AND target !~ '^.*_(pre|post)_[a-z0-9_]+$' THEN
        RAISE EXCEPTION 'eqms_end_sessions: that is not a database this function may act on';
    END IF;
    SELECT count(*) INTO ended FROM (
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = target AND pid <> pg_backend_pid()) s;
    RETURN ended;
END $body$;
$f$, :live_db) \gexec
REVOKE ALL ON FUNCTION public.eqms_end_sessions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eqms_end_sessions(text) TO eqms_restore_swap;

-- Files-only restore writes alias rows into the LIVE database, through the restore login (eqms_restore). It must be able to read the file
-- references and to add aliases, and nothing else. Run these connected to the live database, as the owner of its tables:
--   GRANT pg_read_all_data TO eqms_restore;
--   GRANT INSERT ON object_version_alias TO eqms_restore;
--   GRANT USAGE, SELECT ON SEQUENCE object_version_alias_id_seq TO eqms_restore;
-- After a database restore the live tables are owned by eqms_restore, so these rights are then already held. NOT YET APPLIED ON DEV:
-- a decision on this privilege is pending.
