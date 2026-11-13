-- NOTIFICATION-ADMIN-2026-11-12: the shared email design also carries the colour of the body and of the footer, and the alignment
-- (left, centre, right) of the logo and of the footer. Forward-only and idempotent; the defaults are what every email looked like before.
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS body_color   varchar(20) NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS footer_color varchar(20) NOT NULL DEFAULT '#F8FAFC';
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS logo_align   varchar(10) NOT NULL DEFAULT 'LEFT';
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS footer_align varchar(10) NOT NULL DEFAULT 'LEFT';
