-- Super Administrator sign-in throttle (SDS 11.6, open item "rate limit"): after 5 failed sign-ins in 15 minutes the account refuses
-- further attempts for the rest of that window without checking the password. Each refused attempt is recorded as LOGIN_THROTTLED.
ALTER TABLE super_admin_event DROP CONSTRAINT IF EXISTS super_admin_event_event_check;
ALTER TABLE super_admin_event ADD CONSTRAINT super_admin_event_event_check
    CHECK (event IN ('LOGIN_OK', 'LOGIN_FAILED', 'LOGIN_THROTTLED', 'ACCOUNT_CREATED'));
