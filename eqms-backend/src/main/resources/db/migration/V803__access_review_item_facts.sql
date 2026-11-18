-- V803: Access Review (owner decision 2026-11-18, SECURITY-AUTHORIZATION-REVIEW D3 and D5).
-- A campaign snapshots the access state of every user when it is created. Five more facts go into the snapshot so the reviewer can decide "keep or withdraw" from one row:
-- the last sign-in and the days without one, the state of MFA, the end of a time-limited account, and the SoD rules the person breaks at that moment.
-- The columns are empty for campaigns made before this change; the screen shows them as "not captured", never as a guess.

ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS inactive_days INTEGER;
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS inactive_flag BOOLEAN;
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS mfa_state VARCHAR(30);
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS time_limited_until TIMESTAMPTZ;
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS open_sod_violations INTEGER;
