-- Enables refresh-token reuse detection: keep the hash of the token that was
-- valid before the most recent rotation so a stolen-and-replayed old token can
-- be recognized (instead of just failing lookup like any other garbage token).
ALTER TABLE auth_sessions
    ADD COLUMN previous_refresh_token_hash VARCHAR(128);

ALTER TABLE auth_sessions
    ADD CONSTRAINT uk_auth_sessions_previous_refresh_token_hash UNIQUE (previous_refresh_token_hash);
