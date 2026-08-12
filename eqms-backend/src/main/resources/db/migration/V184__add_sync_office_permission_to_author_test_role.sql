-- The "Upload to Office Online" / "Sync from Office Online" revision actions are gated by
-- documents.revision.sync_office (SecureFileAccessService.resolveRequiredPermission), but this
-- permission was previously granted only to the legacy DCO_LEGACY permission set. No test (or,
-- as far as this data shows, real) Author-facing permission set had it, so the button was hidden
-- for every Author — masked until now by an unrelated bug where the action-capabilities endpoint
-- was failing outright and the frontend silently fell back to a client-guessed capability.
-- Production permission sets representing the real "Author" role need the same grant.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'documents.revision.sync_office'
WHERE ps.code = 'PS_AUTHOR_TEST'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
