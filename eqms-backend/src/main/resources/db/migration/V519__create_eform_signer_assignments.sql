-- V519: Form / eForm Phase 2b -- per-electronic-distribution sequential signer assignment,
-- replacing V517's global per-Form role list (never used for real data; dropped outright).
--
-- Real-world process: a Form's Controlled Copy is requested and distributed to specific people
-- PER OCCASION (this month's copy goes to QA, next month's to QC) -- who signs what, and in what
-- order, must be decided at distribution time, not fixed once on the Form. The DCO configures this
-- on a dedicated screen at the existing "Ready for Distribution" step, then clicks Distribute.

DROP TABLE IF EXISTS form_role_assignments;

-- A copy's distribution medium -- defaults every existing/future row to PAPER so the base
-- Controlled Copy feature (every non-Form, non-eForm document) is completely unaffected.
ALTER TABLE controlled_copies ADD COLUMN delivery_mode VARCHAR(20) NOT NULL DEFAULT 'PAPER';

CREATE TABLE eform_signer_assignments (
    id UUID PRIMARY KEY,
    controlled_copy_id UUID NOT NULL REFERENCES controlled_copies(id),
    role_name VARCHAR(100) NOT NULL,
    assigned_user_id UUID NOT NULL REFERENCES app_users(id),
    sequence INT NOT NULL,
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (controlled_copy_id, role_name)
);

CREATE INDEX idx_eform_signer_assignments_copy ON eform_signer_assignments(controlled_copy_id);

-- Which electronic distribution a Fill run belongs to -- lets multiple concurrent electronic
-- copies of the SAME Form (e.g. issued to QA and QC at once) each get their own independent
-- signer chain instead of colliding on one "active run per Form".
ALTER TABLE eform_fill_runs ADD COLUMN controlled_copy_id UUID REFERENCES controlled_copies(id);
