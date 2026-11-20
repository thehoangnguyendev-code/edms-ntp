-- V818: the same backfill as V459, once more (owner decision 2026-11-18: "grant the Knowledge permission to the set").
-- V459 gave self_service.knowledge.view to every Permission Set that held documents.module.view, so that nobody lost Knowledge when that permission started to be checked instead of the broad one.
-- A set can hold documents.module.view without it afterwards (found: "Document Control - View Everything", PS_DOCUMENT_VIEW_ALL, created before V459 and holding documents.module.view but not the
-- Knowledge permission): its people could not open Knowledge. This repeats the grant for every such set. It only adds a missing row (ON CONFLICT DO NOTHING), never removes or changes one.
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
