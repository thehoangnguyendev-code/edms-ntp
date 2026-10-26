-- SOP.0025: the units that train from outside the company (external training) are approved before they are used. The register of approved training providers: the name, the reference of the
-- approval, the date until which the approval is valid, and the electronic signature of the person who approved it. A provider is not changed after it was approved: it is made Inactive (with a reason and a
-- signature). An external training whose training unit is not in the register, or whose approval has ended, gets a warning (it does not block).
CREATE TABLE IF NOT EXISTS training_approved_providers (
    id                       UUID PRIMARY KEY,
    name                     VARCHAR(255) NOT NULL,
    reference                VARCHAR(120),
    valid_until              DATE,
    status                   VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    approved_by              UUID NOT NULL REFERENCES app_users(id),
    approved_signature_id    UUID NOT NULL,
    approved_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_by           UUID REFERENCES app_users(id),
    deactivated_signature_id UUID,
    deactivated_at           TIMESTAMPTZ,
    deactivate_reason        TEXT,
    CONSTRAINT ck_training_provider_inactive CHECK (status = 'ACTIVE' OR (deactivated_by IS NOT NULL AND deactivated_at IS NOT NULL AND deactivate_reason IS NOT NULL AND length(btrim(deactivate_reason)) > 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_provider_active_name ON training_approved_providers (lower(btrim(name))) WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION training_provider_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'An approved training provider is a record and cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'INACTIVE' THEN RAISE EXCEPTION 'An inactive training provider does not change again' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.name <> OLD.name OR NEW.reference IS DISTINCT FROM OLD.reference OR NEW.valid_until IS DISTINCT FROM OLD.valid_until OR NEW.approved_by <> OLD.approved_by
       OR NEW.approved_signature_id <> OLD.approved_signature_id OR NEW.approved_at <> OLD.approved_at THEN
        RAISE EXCEPTION 'An approved training provider can only be made inactive' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_provider_guard ON training_approved_providers;
CREATE TRIGGER trg_training_provider_guard BEFORE UPDATE OR DELETE ON training_approved_providers FOR EACH ROW EXECUTE FUNCTION training_provider_guard();

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES ('TRAINING_PROVIDER_APPROVED', 'Training Provider Approved'), ('TRAINING_PROVIDER_DEACTIVATED', 'Training Provider Deactivated')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
