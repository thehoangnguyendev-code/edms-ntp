-- NOTIFICATION-ADMIN-2026-11-12: the header of the shared email design is a plain text or an uploaded logo picture. This is the text.
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS logo_text varchar(200);
