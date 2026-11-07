-- Re-authenticating a locked (idle) session now asks for the second factor too (owner decision 2026-11-02, GMP): the password step creates a challenge that belongs to
-- that one session, so a challenge made for signing in can never unlock a session, and a challenge made for unlocking can never sign anybody in.
-- Forward-only and idempotent. Null = a sign-in challenge (every row before this change).

ALTER TABLE login_challenges ADD COLUMN IF NOT EXISTS session_id UUID;
