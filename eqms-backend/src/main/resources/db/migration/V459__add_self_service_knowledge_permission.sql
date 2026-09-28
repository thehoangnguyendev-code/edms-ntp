-- Knowledge (formerly "Knowledge Base", nested inside Document Control) moved into its own
-- top-level "Self-Service" menu group alongside Dashboard. It used to ride on the broad
-- documents.module.view permission; now that it has left the Documents module, it needs its own
-- view permission (NavigationService#getNavigation and the /self-service/knowledge route both
-- check this code, not documents.module.view, going forward).
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (gen_random_uuid(), 'self_service.knowledge.view', 'View Knowledge',
        'Self-Service', 'self_service', 'self_service_access',
        'View the Knowledge portal under Self-Service (browse/search published documents, feedback, subscriptions).',
        60, FALSE)
ON CONFLICT (code) DO NOTHING;

-- Backfill: every Permission Set that currently grants documents.module.view already has today's
-- Knowledge Base access via that broader permission -- grant the new dedicated code to the same
-- set of Permission Sets so nobody silently loses access to Knowledge when this permission starts
-- being checked instead. Consistent with the V455 legacy-import-permission backfill pattern.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'documents.module.view'
) src
JOIN permissions tgt ON tgt.code = 'self_service.knowledge.view'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
