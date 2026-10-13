-- Disaster recovery drills (SDS 15.2) and the scenarios they are measured against. A drill is a record of a rebuild on empty hardware:
-- which scenario, when, who led it, the recovery time target and the time achieved, the result and the findings. Records are never
-- edited or deleted. The scenario targets are proposals until the owner approves the Disaster Recovery Plan; they are kept as data so
-- that the plan can change them with a recorded decision, not by a code change.
CREATE TABLE dr_scenario (
    code          VARCHAR(40)  PRIMARY KEY,
    label         VARCHAR(120) NOT NULL,
    description   TEXT         NOT NULL,
    rpo_hours     NUMERIC(6,1) NOT NULL CHECK (rpo_hours > 0),
    rto_hours     NUMERIC(6,1) NOT NULL CHECK (rto_hours > 0),
    status        VARCHAR(20)  NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'APPROVED')),
    approved_by   VARCHAR(120),
    approved_at   TIMESTAMPTZ
);

INSERT INTO dr_scenario (code, label, description, rpo_hours, rto_hours, status) VALUES
    ('DATA_CORRUPTION', 'Data corruption, server intact', 'Records damaged or wrongly changed; hardware is fine.', 24, 8, 'PROPOSED'),
    ('SERVER_LOSS', 'Server lost, site intact', 'Hardware failure; a replacement server is available on site.', 24, 24, 'PROPOSED'),
    ('SITE_LOSS', 'Site lost', 'Fire, flood or loss of the building; rebuild elsewhere from off-site copies.', 24, 72, 'PROPOSED'),
    ('RANSOMWARE', 'Ransomware or malicious deletion', 'Servers and nearby backups cannot be trusted; recover from the immutable copy.', 24, 72, 'PROPOSED');

CREATE SEQUENCE dr_drill_seq;
CREATE TABLE dr_drill (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drill_code         VARCHAR(30)  NOT NULL UNIQUE,
    scenario_code      VARCHAR(40)  NOT NULL REFERENCES dr_scenario (code),
    performed_at       TIMESTAMPTZ  NOT NULL,
    lead               VARCHAR(120) NOT NULL,
    rpo_target_hours   NUMERIC(6,1) NOT NULL,
    rto_target_hours   NUMERIC(6,1) NOT NULL,
    achieved_rto_hours NUMERIC(6,1) NOT NULL CHECK (achieved_rto_hours >= 0),
    result             VARCHAR(30)  NOT NULL CHECK (result IN ('PASSED', 'PASSED_WITH_FINDINGS', 'FAILED')),
    findings           TEXT,
    recorded_by        VARCHAR(120) NOT NULL,
    recorded_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT dr_drill_findings_required CHECK (result = 'PASSED' OR (findings IS NOT NULL AND length(trim(findings)) > 0))
);
CREATE INDEX dr_drill_performed_idx ON dr_drill (performed_at DESC);
CREATE TRIGGER dr_drill_append_only BEFORE UPDATE OR DELETE ON dr_drill
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
