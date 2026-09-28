-- Reserved, non-login SYSTEM account used as the actor for automated / background actions
-- (scheduled jobs, async reconciliation, background failure-recovery). Previously such actions
-- were attributed to the real "admin" human account (findByUsername("admin")), which made an
-- automated 2 AM job indistinguishable from a manual admin action in the audit trail and broke
-- silently if no user was literally named "admin". This row is the single, project-wide anchor
-- for "Who = the system" -- both as the audit actor snapshot and as the domain FK (e.g.
-- controlled_copies.obsoleted_by) when an automated process changes state.
--
-- Login is impossible: status = 'Inactive' AND password_hash is not a valid hash. The account
-- carries no access profile / permission set, so it can never be a source of authorization.
INSERT INTO app_users (
    id, username, email, full_name, password_hash, role_name, status,
    must_change_password, mfa_enabled, mfa_email_fallback_enabled, mfa_remember_device_enabled,
    email_notifications_enabled, failed_login_count,
    notification_preferences, localization_preferences,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001', 'system', 'system@eqms.local',
    'System (Automated)', '!disabled-no-login', 'SYSTEM', 'Inactive',
    true, false, false, false,
    false, 0,
    '{}', '{}',
    now(), now()
)
ON CONFLICT (id) DO NOTHING;
