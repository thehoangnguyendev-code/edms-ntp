ALTER TABLE business_units
    ADD COLUMN IF NOT EXISTS description VARCHAR(512);

ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS description VARCHAR(512);

ALTER TABLE positions
    ADD COLUMN IF NOT EXISTS description VARCHAR(512);
