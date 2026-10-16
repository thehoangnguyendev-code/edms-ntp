-- REPORT-COMPANY-APPEARANCE-2026-10-15 (owner direction: every report uses one company appearance): the look of a report (cover, header, footer, page numbers,
-- font, stamp, watermark, logo, orientation and the Word page templates) is kept once, in Report Properties, and is no longer part of each report template.
-- A template keeps only its charts. NULL means the built-in default appearance. Forward-only, idempotent.
ALTER TABLE report_properties ADD COLUMN IF NOT EXISTS appearance JSONB;
