-- Approved EFORM-RETIRE-2026-10-03: paper only; preserve files, signatures and history.
-- Store the full prior row before invalidation; no storage keys or checksums are removed.
CREATE TABLE eform_retirement_history (
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID NOT NULL,
    prior_state JSONB NOT NULL,
    decision_code VARCHAR(60) NOT NULL DEFAULT 'EFORM-RETIRE-2026-10-03',
    retired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_type, entity_id)
);
INSERT INTO eform_retirement_history(entity_type, entity_id, prior_state)
SELECT 'EFORM_EDIT_SESSION', id, to_jsonb(s) FROM eform_edit_sessions s WHERE status IN ('ACTIVE', 'SAVED');
INSERT INTO eform_retirement_history(entity_type, entity_id, prior_state)
SELECT 'EFORM_FILL_RUN', id, to_jsonb(r) FROM eform_fill_runs r WHERE status = 'IN_PROGRESS';
UPDATE eform_edit_sessions SET status = 'ABANDONED', lock_version = lock_version + 1, updated_at = now()
WHERE status IN ('ACTIVE', 'SAVED');
UPDATE eform_fill_runs SET status = 'ABANDONED', lock_version = lock_version + 1, updated_at = now()
WHERE status = 'IN_PROGRESS';

-- An old application instance / stale callback cannot revive or overwrite archived data.
CREATE FUNCTION reject_retired_eform_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Electronic Forms and FormSettings are retired; historical data is read-only'
        USING ERRCODE = '55000';
END;
$$;
DO $$
DECLARE archived_table TEXT;
BEGIN
    FOREACH archived_table IN ARRAY ARRAY[
        'form_settings', 'eform_edit_sessions', 'eform_fill_runs', 'eform_signer_assignments',
        'eform_pdf_signature_steps', 'eform_artifact_writes', 'eform_design_engine_writes',
        'eform_retirement_history'
    ] LOOP
        IF to_regclass(archived_table) IS NOT NULL THEN
            EXECUTE format('CREATE TRIGGER retired_eform_read_only BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_retired_eform_write()', archived_table);
        END IF;
    END LOOP;
END;
$$;

CREATE FUNCTION require_paper_controlled_copy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode THEN
        IF NEW.delivery_mode IS DISTINCT FROM 'PAPER' THEN
            RAISE EXCEPTION 'Electronic Forms are retired; new Controlled Copies must use PAPER'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER controlled_copy_paper_only BEFORE INSERT OR UPDATE OF delivery_mode ON controlled_copies
FOR EACH ROW EXECUTE FUNCTION require_paper_controlled_copy();

CREATE FUNCTION require_paper_execution_capture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.capture_method IS DISTINCT FROM OLD.capture_method THEN
        IF NEW.capture_method IS DISTINCT FROM 'PAPER_SCAN' THEN
            RAISE EXCEPTION 'Electronic Forms are retired; new records must be scanned paper copies'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER executed_record_paper_only BEFORE INSERT OR UPDATE OF capture_method ON executed_records
FOR EACH ROW EXECUTE FUNCTION require_paper_execution_capture();

COMMENT ON TABLE form_settings IS 'Retired EFORM-RETIRE-2026-10-03; retained read-only for historical evidence';
COMMENT ON TABLE eform_edit_sessions IS 'Retired; nonterminal sessions invalidated, storage references preserved';
COMMENT ON TABLE eform_fill_runs IS 'Retired; historical runs, files and signatures retained';
