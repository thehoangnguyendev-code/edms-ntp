-- Training Management, form templates: a template is Enabled or Disabled (it was Draft, Current or Superseded). A newly uploaded template is Disabled until a person who administers Training
-- enables it with an electronic signature; enabling one disables the other that was enabled for the same document number; a template can be disabled again with a reason and enabled
-- again later. The file of a template never changes and is never deleted. Forward-only and idempotent.

DROP TRIGGER IF EXISTS trg_training_form_template_guard ON training_form_templates;
DO $$
DECLARE c TEXT;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'training_form_templates'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%' LOOP
        EXECUTE format('ALTER TABLE training_form_templates DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
DROP INDEX IF EXISTS ux_training_form_template_current;
UPDATE training_form_templates SET status = 'ENABLED' WHERE status = 'CURRENT';
UPDATE training_form_templates SET status = 'DISABLED' WHERE status IN ('DRAFT', 'SUPERSEDED');
ALTER TABLE training_form_templates ALTER COLUMN status SET DEFAULT 'DISABLED';
ALTER TABLE training_form_templates ADD CONSTRAINT ck_training_form_templates_status CHECK (status IN ('ENABLED', 'DISABLED'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_form_template_enabled ON training_form_templates (code) WHERE status = 'ENABLED';
ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS disabled_by UUID REFERENCES app_users(id);
ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS disable_reason TEXT;

CREATE OR REPLACE FUNCTION training_form_template_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A training form template cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.stored_path <> OLD.stored_path OR NEW.sha256 <> OLD.sha256 OR NEW.code <> OLD.code OR NEW.version_label <> OLD.version_label OR NEW.uploaded_by <> OLD.uploaded_by THEN
        RAISE EXCEPTION 'A training form template cannot be replaced' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_training_form_template_guard BEFORE UPDATE OR DELETE ON training_form_templates FOR EACH ROW EXECUTE FUNCTION training_form_template_guard();

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_FORM_TEMPLATE_ENABLED', 'Form Template Enabled'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_FORM_TEMPLATE_ENABLED');
