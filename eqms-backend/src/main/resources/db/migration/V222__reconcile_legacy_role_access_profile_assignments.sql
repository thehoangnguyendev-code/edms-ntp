-- Corrective migration for V220. Do not alter historic Flyway migrations after they
-- may have been promoted. This reconciliation is deliberately conservative: it only
-- assigns users who currently have no Access Profile, which is exactly the group that
-- still depends on the legacy role_name fallback.

CREATE TABLE IF NOT EXISTS security_legacy_role_mapping_exceptions (
    user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    role_name VARCHAR(80),
    exception_type VARCHAR(40) NOT NULL,
    candidate_role_ids TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep the exception list current. A profile-less user whose legacy role name has no
-- exact match, or maps to more than one role, must be resolved by an administrator;
-- assigning either candidate automatically would be an authorization escalation.
WITH candidates AS (
    SELECT u.id AS user_id, u.role_name, r.id AS role_id
    FROM app_users u
    LEFT JOIN roles r
      ON lower(trim(r.code)) = lower(trim(u.role_name))
      OR lower(trim(r.name)) = lower(trim(u.role_name))
    WHERE NOT EXISTS (
        SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = u.id
    )
      AND nullif(trim(u.role_name), '') IS NOT NULL
), candidate_summary AS (
    SELECT user_id,
           max(role_name) AS role_name,
           count(role_id) AS candidate_count,
           string_agg(role_id::text, ',' ORDER BY role_id::text) AS candidate_role_ids
    FROM candidates
    GROUP BY user_id
)
INSERT INTO security_legacy_role_mapping_exceptions (user_id, role_name, exception_type, candidate_role_ids, detected_at)
SELECT user_id,
       role_name,
       CASE WHEN candidate_count = 0 THEN 'NO_EXACT_ROLE_MATCH' ELSE 'AMBIGUOUS_ROLE_MATCH' END,
       candidate_role_ids,
       now()
FROM candidate_summary
WHERE candidate_count <> 1
ON CONFLICT (user_id) DO UPDATE
SET role_name = EXCLUDED.role_name,
    exception_type = EXCLUDED.exception_type,
    candidate_role_ids = EXCLUDED.candidate_role_ids,
    detected_at = EXCLUDED.detected_at;

-- Add exactly-one matches for every account status. Account status controls whether a
-- person can sign in; it must not silently discard their entitlement mapping before a
-- future reactivation. Existing profiles are intentionally left unchanged.
WITH candidates AS (
    SELECT u.id AS user_id, r.id AS role_id
    FROM app_users u
    JOIN roles r
      ON lower(trim(r.code)) = lower(trim(u.role_name))
      OR lower(trim(r.name)) = lower(trim(u.role_name))
    WHERE NOT EXISTS (
        SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = u.id
    )
      AND nullif(trim(u.role_name), '') IS NOT NULL
), unique_matches AS (
    SELECT user_id, min(role_id::text)::uuid AS role_id
    FROM candidates
    GROUP BY user_id
    HAVING count(DISTINCT role_id) = 1
)
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT user_id, role_id, now()
FROM unique_matches
ON CONFLICT (user_id, access_profile_id) DO NOTHING;

-- Clear resolved exceptions so the table remains an actionable cutover checklist.
DELETE FROM security_legacy_role_mapping_exceptions e
WHERE EXISTS (
    SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = e.user_id
);

CREATE INDEX IF NOT EXISTS idx_security_legacy_role_mapping_exceptions_type
    ON security_legacy_role_mapping_exceptions (exception_type);
