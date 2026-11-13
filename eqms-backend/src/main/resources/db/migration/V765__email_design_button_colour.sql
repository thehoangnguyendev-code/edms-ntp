-- NOTIFICATION-ADMIN-2026-11-12: the brand colour of the shared email design is only the colour of the header band; the action button and the links
-- get their own colour. Existing designs keep the look they had: the button colour starts as the brand colour.
ALTER TABLE email_design ADD COLUMN IF NOT EXISTS button_color varchar(20) NOT NULL DEFAULT '#059669';
UPDATE email_design SET button_color = brand_color WHERE button_color = '#059669' AND brand_color <> '#059669';
