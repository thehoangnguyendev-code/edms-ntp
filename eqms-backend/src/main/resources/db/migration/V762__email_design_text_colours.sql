-- NOTIFICATION-ADMIN-2026-11-12: the text colours of the shared email design (header, body, footer). The defaults are what every email looked like.
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS header_text_color varchar(20) NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS body_text_color   varchar(20) NOT NULL DEFAULT '#334155';
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS footer_text_color varchar(20) NOT NULL DEFAULT '#6B7280';
