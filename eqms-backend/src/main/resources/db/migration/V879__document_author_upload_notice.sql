-- NOTIFICATION document.author_assigned (DEC-DOC-2026-11-27-05): which Author was already asked to upload the first revision of a new document,
-- so that saving the draft again does not send the notice again, and a change of Author sends it to the new one. Forward-only, additive.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS author_upload_notified_user_id UUID;
