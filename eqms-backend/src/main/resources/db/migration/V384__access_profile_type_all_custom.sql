-- The System/Custom `type` badge no longer gates any capability -- every access profile,
-- including the system-seeded ones and the super admin profile, is editable by an actor with
-- the right permission subject to the same admin-coverage invariant (AccessProfileService).
-- Keeping some profiles labelled "System" was therefore misleading (it implied a restriction
-- that no longer exists). `is_system` itself is untouched -- it still drives the
-- "[System Profile Override]" audit-trail marker for these seeded baseline profiles.
UPDATE roles
SET type = 'CUSTOM', updated_at = NOW()
WHERE type <> 'CUSTOM';
