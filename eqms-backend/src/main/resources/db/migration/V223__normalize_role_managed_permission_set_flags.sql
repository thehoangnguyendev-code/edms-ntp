-- V220 created ROLE_<role-code> sets as system sets, while the Access Profile editor
-- is intentionally their owner. Do not overload "system" for role-managed content:
-- system sets are immutable platform configuration, whereas managed sets are edited
-- only through the owning Access Profile.
UPDATE permission_sets ps
SET system = FALSE
FROM roles r
WHERE ps.code = 'ROLE_' || r.code
  AND ps.description = 'System-managed compatibility set created from the legacy permissions of role ' || r.code || '.'
  AND ps.system = TRUE;
