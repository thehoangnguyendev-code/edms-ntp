-- Reporting (REPORT-BACKUP-RUNS-2026-11-15): one summary line for every backup, verification, restore, restore rehearsal and store scrub.
-- The application copies these lines into its own database for the Backup and Restore Runs report. Only a role created by an operator
-- (scripts/backup/report-reader-role.sh) can read this view, and it can read nothing else: the view holds no error text, no path, no key,
-- no manifest and no detail of a run, only what a person asks of a run (what, when, who, how big, how it ended).
CREATE SCHEMA IF NOT EXISTS reporting;

CREATE OR REPLACE VIEW reporting.run_summary AS
SELECT 'BACKUP'::text AS kind, r.id AS source_id, r.backup_number::text AS reference, r.backup_number::text AS backup_number, r.status::text AS status,
       r.trigger_kind::text AS trigger_kind, r.type::text AS run_type, r.environment::text AS environment, r.started_at AS started_at, r.finished_at AS finished_at,
       r.requested_by::text AS actor, r.size_bytes AS size_bytes, NULL::text AS tier, r.error_code::text AS error_code, NULL::text AS failed_step,
       NULL::integer AS restore_seconds, NULL::bigint AS checked_files, NULL::integer AS different_files, NULL::integer AS missing_files,
       r.reason::text AS reason, r.change_control_ref::text AS change_control_ref
  FROM backup_run r
UNION ALL
SELECT 'VERIFICATION', v.id, r.backup_number::text || ' / ' || v.tier::text, r.backup_number::text, v.result::text,
       NULL::text, NULL::text, r.environment::text, v.verified_at, v.verified_at,
       v.verified_by::text, NULL::bigint, v.tier::text, NULL::text, NULL::text,
       NULL::integer, NULL::bigint, NULL::integer, NULL::integer,
       NULL::text, NULL::text
  FROM backup_verification v JOIN backup_run r ON r.id = v.run_id
UNION ALL
SELECT 'RESTORE', s.id, s.restore_number::text, s.backup_number::text, s.status::text,
       NULL::text, NULL::text, NULL::text, s.started_at, s.finished_at,
       s.started_by::text, NULL::bigint, NULL::text, s.error_code::text, s.failed_step::text,
       NULL::integer, NULL::bigint, NULL::integer, NULL::integer,
       NULL::text, NULL::text
  FROM restore_run s
UNION ALL
SELECT 'REHEARSAL', h.id, h.rehearsal_id::text, r.backup_number::text, h.status::text,
       NULL::text, NULL::text, r.environment::text, COALESCE(h.started_at, h.requested_at), h.finished_at,
       h.requested_by::text, NULL::bigint, NULL::text, h.error_code::text, NULL::text,
       h.restore_seconds, NULL::bigint, NULL::integer, NULL::integer,
       h.reason::text, NULL::text
  FROM restore_rehearsal h LEFT JOIN backup_run r ON r.id = h.run_id
UNION ALL
SELECT 'SCRUB', c.id, 'SCRUB ' || to_char(c.started_at, 'YYYY-MM-DD HH24:MI'), c.backup_number::text, c.status::text,
       c.trigger_kind::text, NULL::text, NULL::text, c.started_at, c.finished_at,
       c.requested_by::text, c.checked_bytes, NULL::text, c.error_code::text, NULL::text,
       NULL::integer, c.checked_files, c.different_files, c.missing_files,
       NULL::text, NULL::text
  FROM store_scrub_run c;
