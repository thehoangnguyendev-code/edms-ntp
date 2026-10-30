-- Training Annex (owner decisions 2026-10-28, PLAN-TR-004): the forms of Training (the APD annexes) are uploaded in Training Administration, written with tokens, and filled by the system.
-- Forward-only and idempotent.
--
-- 1. Own permissions (not the ones of Training Properties): view, manage (upload, disable, signature styles) and enable (the electronic signature that puts a template in force).
-- 2. What the check of a template found, kept with the template (the file never changes, so the check is made once, when it is uploaded).
-- 3. How the electronic signature of each slot of a form is shown (compact, standard, detailed), per form code.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'training.annex.view', 'View Training Annex',
     'Training Administration', 'training', 'training_admin',
     'See the Training Annex: the forms of Training (APD annexes), their templates, tokens, signature slots and previews.', 66, FALSE),
    (gen_random_uuid(), 'training.annex.manage', 'Manage Training Annex',
     'Training Administration', 'training', 'training_admin',
     'Upload templates of the Training Annex, disable a template, and choose how the electronic signature of each slot is shown.', 67, TRUE),
    (gen_random_uuid(), 'training.annex.enable', 'Enable Training Annex Template',
     'Training Administration', 'training', 'training_admin',
     'Put a template of the Training Annex in force with an electronic signature.', 68, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Backfill: whoever administered the form templates of Training before (training.admin.manage) keeps doing so, with the new permissions. Nobody gains anything they could not do before.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'training.admin.manage'
) src
JOIN permissions tgt ON tgt.code IN ('training.annex.view', 'training.annex.manage', 'training.annex.enable')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- The check of a template: TOKENS (written with tokens and checked against the contract of its code), LEGACY (an earlier template, found by its printed words, tokens not checked) or NOT_APPLICABLE
-- (APD.0009, whose test is built by the assessment form builder). The columns are not the file, so the guard of the file allows them to be written.
ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS token_mode VARCHAR(20);
ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS check_problems TEXT;
ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_form_templates_token_mode') THEN
        ALTER TABLE training_form_templates ADD CONSTRAINT ck_training_form_templates_token_mode CHECK (token_mode IS NULL OR token_mode IN ('TOKENS', 'LEGACY', 'NOT_APPLICABLE'));
    END IF;
END $$;

-- Every template that exists today was written before tokens: it is LEGACY (APD.0009 and the forms that Training Annex does not manage are marked as such). The guard of the file allows it.
UPDATE training_form_templates SET token_mode = CASE WHEN code = 'APD.0009' THEN 'NOT_APPLICABLE' ELSE 'LEGACY' END, checked_at = now() WHERE token_mode IS NULL;

CREATE TABLE IF NOT EXISTS training_annex_slot_styles (
    code        VARCHAR(40) NOT NULL,
    slot        VARCHAR(60) NOT NULL,
    style       VARCHAR(20) NOT NULL,
    updated_by  UUID REFERENCES app_users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (code, slot),
    CONSTRAINT ck_training_annex_slot_style CHECK (style IN ('COMPACT', 'STANDARD', 'DETAILED'))
);
