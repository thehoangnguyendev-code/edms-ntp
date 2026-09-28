-- Fields introduced by vietnam_education_institutions_MASTER_FINAL_2026_v2.json.
-- They remain nullable so existing manually managed Schools remain backwards compatible.
ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS supervising_authority VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ultimate_governing_body VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ownership_verification_status VARCHAR(120),
    ADD COLUMN IF NOT EXISTS status_note VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS governing_body_source_urls JSONB;

CREATE INDEX IF NOT EXISTS idx_schools_supervising_authority
    ON schools (supervising_authority)
    WHERE supervising_authority IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schools_ultimate_governing_body
    ON schools (ultimate_governing_body)
    WHERE ultimate_governing_body IS NOT NULL;
