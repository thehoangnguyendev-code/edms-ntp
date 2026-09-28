-- Stable REST Countries identity used by the managed sync. Existing seeded rows are populated
-- during the first sync by matching their current unique display name.
ALTER TABLE countries ADD COLUMN iso2_code VARCHAR(2);

CREATE UNIQUE INDEX uq_countries_iso2_code
    ON countries (iso2_code)
    WHERE iso2_code IS NOT NULL;
