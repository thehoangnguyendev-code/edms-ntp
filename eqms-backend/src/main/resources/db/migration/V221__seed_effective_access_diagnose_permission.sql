-- Effective Access Diagnosis ("why can't user X do action Y on record Z?").
-- Separate permission so the diagnosis tool can be granted deliberately — it reveals
-- another user's per-layer authorization state, which is admin-only information.
-- Role managers get it implicitly via the settings.role.manage alias in
-- PermissionEvaluationService; this row makes it grantable to others via the catalog.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (
    gen_random_uuid(),
    'security.effective_access.diagnose',
    'Diagnose Effective Access',
    'SECURITY',
    'security-authorization',
    'effective-access',
    'Run the per-layer access diagnosis for another user on a specific record',
    95,
    true
)
ON CONFLICT (code) DO NOTHING;
