-- NOTIFICATION-ADMIN-2026-11-12 (owner decisions D2, D3): one email frame for the whole system, a button label for the email of an event,
-- and the electronic-signature meaning for the wording of a GMP-mandatory notification. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS email_design (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    logo_url      text,
    brand_color   varchar(20)  NOT NULL DEFAULT '#059669',
    font_family   varchar(100) NOT NULL DEFAULT 'Arial',
    footer_text   text,
    support_email varchar(255),
    version       integer      NOT NULL DEFAULT 1,
    updated_by    varchar(100),
    updated_at    timestamptz  NOT NULL DEFAULT now()
);
-- exactly one row: the design is a single system-wide setting
CREATE UNIQUE INDEX IF NOT EXISTS email_design_single_row ON email_design ((true));

-- start from what the most used active template already looked like, so no email changes its look on the day of the migration
INSERT INTO email_design (logo_url, brand_color, font_family, footer_text, support_email, updated_by)
SELECT t.logo_url, COALESCE(NULLIF(t.primary_color, ''), '#059669'), COALESCE(NULLIF(t.font_family, ''), 'Arial'), t.copyright, t.contact_email, 'System'
FROM email_templates t
WHERE t.status = 'Active'
ORDER BY t.usage_count DESC NULLS LAST
LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO email_design (updated_by) SELECT 'System' WHERE NOT EXISTS (SELECT 1 FROM email_design);

ALTER TABLE notification_template_versions ADD COLUMN IF NOT EXISTS action_label varchar(80);

INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'NOTIFICATION_MANDATORY_WORDING', 'Mandatory Notification Wording')
ON CONFLICT (code) DO NOTHING;
