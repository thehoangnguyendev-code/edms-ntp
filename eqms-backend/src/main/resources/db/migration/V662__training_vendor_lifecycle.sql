-- The life of a training vendor (SOP.0025): Draft (written, not yet approved), Active (approved with an electronic signature of a person other than the one who wrote it), Inactive (made inactive with a
-- reason and a signature), and Active again (activated again with a reason and a signature). Before this, a vendor was written and approved in one step and an inactive vendor could not come back.
-- the old guard forbids the backfill below: it is dropped first and made again at the end
DROP TRIGGER IF EXISTS trg_training_provider_guard ON training_approved_providers;
ALTER TABLE training_approved_providers DROP CONSTRAINT IF EXISTS training_approved_providers_status_check;
ALTER TABLE training_approved_providers DROP CONSTRAINT IF EXISTS ck_training_provider_inactive;
ALTER TABLE training_approved_providers ADD CONSTRAINT training_approved_providers_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE'));
ALTER TABLE training_approved_providers ALTER COLUMN approved_by DROP NOT NULL;
ALTER TABLE training_approved_providers ALTER COLUMN approved_signature_id DROP NOT NULL;
ALTER TABLE training_approved_providers ALTER COLUMN approved_at DROP NOT NULL;
ALTER TABLE training_approved_providers ALTER COLUMN approved_at DROP DEFAULT;
ALTER TABLE training_approved_providers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id);
ALTER TABLE training_approved_providers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE training_approved_providers SET created_by = approved_by, created_at = approved_at WHERE created_by IS NULL;
ALTER TABLE training_approved_providers ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE training_approved_providers ADD CONSTRAINT ck_training_vendor_approved CHECK (status = 'DRAFT' OR (approved_by IS NOT NULL AND approved_signature_id IS NOT NULL AND approved_at IS NOT NULL));
ALTER TABLE training_approved_providers ADD CONSTRAINT ck_training_vendor_inactive CHECK (status <> 'INACTIVE' OR (deactivated_by IS NOT NULL AND deactivated_at IS NOT NULL AND deactivate_reason IS NOT NULL AND length(btrim(deactivate_reason)) > 0));

CREATE OR REPLACE FUNCTION training_provider_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'A training vendor that was approved is a record and cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'Who wrote a training vendor does not change' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status <> 'DRAFT' AND (NEW.name <> OLD.name OR NEW.reference IS DISTINCT FROM OLD.reference) THEN
        RAISE EXCEPTION 'The name and the reference of a training vendor that was approved do not change' USING ERRCODE = '0LPTR';
    END IF;
    IF OLD.status = 'ACTIVE' AND NEW.status = 'ACTIVE' AND NEW.valid_until IS DISTINCT FROM OLD.valid_until THEN
        RAISE EXCEPTION 'The validity of an active training vendor does not change: make it inactive and activate it again' USING ERRCODE = '0LPTR';
    END IF;
    IF (OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'ACTIVE')) OR (OLD.status = 'ACTIVE' AND NEW.status NOT IN ('ACTIVE', 'INACTIVE')) OR (OLD.status = 'INACTIVE' AND NEW.status NOT IN ('INACTIVE', 'ACTIVE')) THEN
        RAISE EXCEPTION 'This change of the state of a training vendor is not allowed' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_training_provider_guard BEFORE UPDATE OR DELETE ON training_approved_providers FOR EACH ROW EXECUTE FUNCTION training_provider_guard();

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_VENDOR_ACTIVATED', 'Training Vendor Activated'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_VENDOR_ACTIVATED');
