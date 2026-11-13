-- The E-Sign Config screen lists the signing actions. The action is fixed by the application; only the meaning
-- (display_name) can be changed by an administrator. Keep the original wording as the action name so that it
-- stays readable after the meaning has been renamed.
ALTER TABLE electronic_signature_meanings ADD COLUMN IF NOT EXISTS action_name VARCHAR(160);
UPDATE electronic_signature_meanings SET action_name = display_name WHERE action_name IS NULL;
