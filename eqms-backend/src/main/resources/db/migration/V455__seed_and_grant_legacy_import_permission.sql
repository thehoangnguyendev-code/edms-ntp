-- Registers the Legacy Import permission in the real backend catalog. It was already referenced
-- by DocumentService/RevisionService (documents.legacy_import.manage) and listed in the frontend
-- Access Profile catalog for display, but never inserted into `permissions` itself -- so no
-- Access Profile could actually be granted it, and hasPermission() always evaluated false.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (gen_random_uuid(), 'documents.legacy_import.manage', 'Import Legacy Document',
        'Document Administration', 'documents', 'document_administration',
        'Import a document that already exists outside the system (e.g. a paper original), assigning its existing document number and revision number directly instead of the automatic sequence.',
        53, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Every Permission Set that already grants the broad documents.admin.manage code also receives
-- this one, consistent with how the V418/V419 granular Document Administration permissions were
-- backfilled -- nobody who already administers Document Control settings needs a second grant.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'documents.admin.manage'
) src
JOIN permissions tgt ON tgt.code = 'documents.legacy_import.manage'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
