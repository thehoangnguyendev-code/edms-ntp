-- NOTIFICATION-REVIEW-2026-11-21: the person with a time-limited access window is warned a few days before it ends
-- (user.time_limited_access_expiring). The time of the warning is kept so that it is sent once per window.
ALTER TABLE time_limited_user_grants ADD COLUMN IF NOT EXISTS expiry_warned_at timestamptz;
