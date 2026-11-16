-- REPORT-APPEARANCE-LIST-2026-11-15: many appearances of the reports, of which exactly one is Active.
-- Until now the appearance was one record (report_properties.appearance). Each appearance is a row here; the Active one is what every new report is drawn with, and
-- activating another makes the present one Inactive in the same transaction. The database itself refuses a second Active row (partial unique index).
-- Forward-only, idempotent. The old column stays, unused, so that a rollback of the application finds its data; the appearance it held becomes the first row.

CREATE TABLE IF NOT EXISTS report_appearances (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          varchar(120) NOT NULL,
    status        varchar(10)  NOT NULL DEFAULT 'INACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    appearance    jsonb        NOT NULL,
    version       integer      NOT NULL DEFAULT 1,
    created_by    uuid REFERENCES app_users (id),
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_by    uuid REFERENCES app_users (id),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    activated_by  uuid REFERENCES app_users (id),
    activated_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_report_appearances_name ON report_appearances (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS ux_report_appearances_one_active ON report_appearances ((true)) WHERE status = 'ACTIVE';

INSERT INTO report_appearances (name, status, appearance, activated_at)
SELECT 'Standard', 'ACTIVE',
       COALESCE(rp.appearance, '{"cover":false,"coverTitle":"{{report.title}}","subtitle":"","showExecutor":true,"showGeneratedAt":true,"header":"{{report.title}}","footer":"{{report.code}} · Rev {{template.version}}","pageNumbers":true,"watermarkEnabled":false,"watermark":"FOR PREVIEW ONLY","stampEnabled":false,"stamp":"TEST"}'::jsonb),
       now()
FROM (SELECT 1) AS one
LEFT JOIN report_properties rp ON rp.id = 1
WHERE NOT EXISTS (SELECT 1 FROM report_appearances);

COMMENT ON TABLE report_appearances IS 'The appearances of the reports (logo, header, footer, cover, marks, fonts). One is Active; every new report is drawn with it.';
COMMENT ON COLUMN report_properties.appearance IS 'Superseded by report_appearances (V785); no longer read or written.';
