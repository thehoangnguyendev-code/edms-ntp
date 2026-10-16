-- V600: Grant "Request Uncontrolled Copy" (documents.uncontrolled_copy.request) to the DCO
-- permission sets. Owner decision (2026-10-16, in conversation, replying to the DCO test account
-- not seeing the Request Uncontrolled Copy button): "cấp cho DCO trước đi" (grant to DCO first).
--
-- documents.uncontrolled_copy.request was created in V499 with its own SoD constraint (V502,
-- against self-approval) and permission_dependencies rows (V511), but was never actually granted
-- to any permission set in any prior migration -- not even the real (non-test) DCO set. This is
-- the first grant of it.
--
-- Scoped to the three sets that are genuinely "DCO" by code (same reading used in
-- V542/DOC-VISIBILITY-2026-10-06): PS_DCO_TEST (lifecycle test account), PS_DOCUMENT_DCO and
-- PS_UAT_DOCUMENT_DCO (real DCO sets). Administrator/SYSTEM_ADMINISTRATION and the legacy
-- ROLE_* sets are intentionally left out -- the owner said DCO first, not every blanket-view set.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_DCO_TEST'),
    ('PS_DOCUMENT_DCO'),
    ('PS_UAT_DOCUMENT_DCO')
) AS v(set_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = 'documents.uncontrolled_copy.request'
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);
