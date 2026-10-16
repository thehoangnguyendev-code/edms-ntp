-- REPORT-TEMPLATE-NUMBER-2026-10-14: a report template's number (report_definitions.code) is assigned by the system from one numbering rule,
-- the way a Document Number is, and is never typed by a user. Forward-only, idempotent. Templates that already exist keep their number.

CREATE TABLE IF NOT EXISTS report_template_number_rule (
    id               smallint PRIMARY KEY CHECK (id = 1),
    prefix           varchar(10) NOT NULL CHECK (prefix ~ '^[A-Z][A-Z0-9]{1,9}$'),
    digits           smallint    NOT NULL CHECK (digits BETWEEN 3 AND 8),
    current_sequence integer     NOT NULL DEFAULT 0 CHECK (current_sequence >= 0),
    version          integer     NOT NULL DEFAULT 1,
    updated_by       uuid,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- The default rule gives RPT.0001, RPT.0002, ... The sequence only ever moves forward, so a number is never issued twice, even after a rule change.
INSERT INTO report_template_number_rule (id, prefix, digits, current_sequence)
SELECT 1, 'RPT', 4, 0
WHERE NOT EXISTS (SELECT 1 FROM report_template_number_rule WHERE id = 1);
