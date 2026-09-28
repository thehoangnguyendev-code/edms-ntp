-- Preserve the governance-master fields as structured, server-filterable columns while
-- retaining the complete source record in source_data for future fields and traceability.
ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS catalog_id VARCHAR(80),
    ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
    ADD COLUMN IF NOT EXISTS entity_kind VARCHAR(80),
    ADD COLUMN IF NOT EXISTS is_independent_institution BOOLEAN,
    ADD COLUMN IF NOT EXISTS institution_type VARCHAR(80),
    ADD COLUMN IF NOT EXISTS institution_type_label VARCHAR(120),
    ADD COLUMN IF NOT EXISTS presence_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS operational_status VARCHAR(100),
    ADD COLUMN IF NOT EXISTS verified_as_of DATE,
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(120),
    ADD COLUMN IF NOT EXISTS governing_body VARCHAR(255),
    ADD COLUMN IF NOT EXISTS governing_body_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS governing_body_verification_status VARCHAR(120),
    ADD COLUMN IF NOT EXISTS national_education_regulator VARCHAR(255),
    ADD COLUMN IF NOT EXISTS governance_model VARCHAR(60),
    ADD COLUMN IF NOT EXISTS direct_governing_ministry VARCHAR(255),
    ADD COLUMN IF NOT EXISTS country_of_origin_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS country_of_origin_iso2 VARCHAR(2),
    ADD COLUMN IF NOT EXISTS host_in_vietnam VARCHAR(255),
    ADD COLUMN IF NOT EXISTS parent_or_partner VARCHAR(500),
    ADD COLUMN IF NOT EXISTS locations JSONB,
    ADD COLUMN IF NOT EXISTS source_urls JSONB,
    ADD COLUMN IF NOT EXISTS source_data JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS ux_schools_catalog_id ON schools (catalog_id) WHERE catalog_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_governance_model ON schools (governance_model);
CREATE INDEX IF NOT EXISTS idx_schools_country_origin_iso2 ON schools (country_of_origin_iso2);
CREATE INDEX IF NOT EXISTS idx_schools_independent_institution ON schools (is_independent_institution);
CREATE INDEX IF NOT EXISTS idx_schools_institution_type ON schools (institution_type);
