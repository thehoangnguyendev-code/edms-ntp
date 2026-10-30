-- Training Management: the rule of the codes of the Training Requirement, the Training Matrix and the Training Assessment. SOP.0003 gives a rule only for the Training Number (TRN/DC/YY-XXX);
-- the codes of these three records are set by the company, in Training Administration. A rule is a pattern with the parts {YYYY} (year of four digits), {YY} (two digits), {DEPT} (code of the
-- department) and {SEQ:n} (the next number, n digits). The number starts again for each year when the pattern has a year, and for each department when it has a department and a number.
-- The codes already issued are never changed; a rule applies to the codes made after it.
CREATE TABLE IF NOT EXISTS training_code_rules (
    entity      varchar(20) PRIMARY KEY CHECK (entity IN ('REQUIREMENT', 'MATRIX', 'ASSESSMENT')),
    pattern     varchar(60) NOT NULL,
    version     integer NOT NULL DEFAULT 1,
    updated_by  uuid,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_code_counters (
    entity      varchar(20) NOT NULL,
    scope_key   varchar(60) NOT NULL,
    last_value  bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (entity, scope_key)
);

INSERT INTO training_code_rules(entity, pattern) VALUES
    ('REQUIREMENT', 'REQ/{YYYY}-{SEQ:3}'),
    ('MATRIX', 'TM-{DEPT}'),
    ('ASSESSMENT', 'TAS-{SEQ:4}')
ON CONFLICT (entity) DO NOTHING;

-- the numbers already issued by the rules above continue where they stopped
INSERT INTO training_code_counters(entity, scope_key, last_value)
SELECT 'REQUIREMENT', 'Y' || year, count(*) FROM training_requirements GROUP BY year
ON CONFLICT (entity, scope_key) DO NOTHING;

INSERT INTO training_code_counters(entity, scope_key, last_value)
SELECT 'ASSESSMENT', '', COALESCE((SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM training_assessment_code_seq), 0)
ON CONFLICT (entity, scope_key) DO NOTHING;
