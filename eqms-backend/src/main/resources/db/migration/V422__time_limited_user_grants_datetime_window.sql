-- The "Active Window" needs to carry a time-of-day, not just a date (an admin may need a grant
-- to start/end mid-day) -- widen start_date/end_date from DATE to TIMESTAMPTZ and rename to
-- start_at/end_at to make the new precision explicit at the column level.
ALTER TABLE time_limited_user_grants RENAME COLUMN start_date TO start_at;
ALTER TABLE time_limited_user_grants RENAME COLUMN end_date TO end_at;
ALTER TABLE time_limited_user_grants ALTER COLUMN start_at TYPE TIMESTAMPTZ USING start_at::timestamptz;
ALTER TABLE time_limited_user_grants ALTER COLUMN end_at TYPE TIMESTAMPTZ USING end_at::timestamptz;
