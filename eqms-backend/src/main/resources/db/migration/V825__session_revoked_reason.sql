-- Why a session ended on the server (for example CONCURRENT_LIMIT when the same account signed in on another device), so the browser that held it can say so.
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(40);
