-- NOTIFICATION-ADMIN-2026-11-12: the font of the words in the header of the shared email design. Empty means the font of the body, as before.
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS header_font_family varchar(100);
