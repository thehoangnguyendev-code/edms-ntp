-- V552: What the validity of an Uncontrolled Copy is counted from (owner decision UC-VALIDITY-2026-10-07).
-- DISTRIBUTION (the existing behaviour, the default so nothing changes): the copy is valid for validity_hours after it is distributed.
-- DOCUMENT_VALID_UNTIL: the copy is valid until the end of the document's Valid Until date plus validity_hours (0 = that day only).
ALTER TABLE uncontrolled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS validity_basis VARCHAR(30) NOT NULL DEFAULT 'DISTRIBUTION';
