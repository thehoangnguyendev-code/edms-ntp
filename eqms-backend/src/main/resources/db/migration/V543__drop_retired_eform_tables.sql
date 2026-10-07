-- V543: Owner decision 2026-10-06 (COPY-RECALL-SCAN-2026-10-06, superseding the "no purge" clause of EFORM-RETIRE-2026-10-03):
-- delete the retired electronic-form tables. The rows were exported (pg_dump of all eight tables) to
-- backups/eform-tables-2026-10-06.sql before this migration; BACK UP any other database before deploying this to it.
--
-- Only the tables are dropped. Their triggers go with them. Not touched: files already written to storage, electronic
-- signatures, audit entries, executed records, controlled copies (including the read-only eform_signing_protocol column) and
-- the paper-only guard triggers on controlled_copies and executed_records, which still apply.
-- Dependency order: steps reference runs and signer assignments; sessions reference runs.

DROP TABLE IF EXISTS eform_pdf_signature_steps;
DROP TABLE IF EXISTS eform_edit_sessions;
DROP TABLE IF EXISTS eform_fill_runs;
DROP TABLE IF EXISTS eform_signer_assignments;
DROP TABLE IF EXISTS eform_artifact_writes;
DROP TABLE IF EXISTS eform_design_engine_writes;
DROP TABLE IF EXISTS eform_retirement_history;
DROP TABLE IF EXISTS form_settings;

-- Only those tables used it.
DROP FUNCTION IF EXISTS reject_retired_eform_write();
