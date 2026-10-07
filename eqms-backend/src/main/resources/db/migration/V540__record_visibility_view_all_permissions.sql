-- V540: Record visibility for Document Control (Decision DOC-VISIBILITY-2026-10-06).
--
-- 1. Two dedicated blanket-view permissions for Controlled and Uncontrolled Copies. They are
--    independent of documents.document.view_all (the copy categories differ) and of any Access
--    Profile name.
-- 2. DocumentAuthorizationService.canViewAllDocuments now checks documents.document.view_all
--    ONLY. Until now it also accepted documents.admin.view, documents.admin.manage_workflow_roles
--    and security.sod.manage, so administration permissions silently granted "see every
--    document". To keep every account's effective access unchanged on upgrade, every Permission
--    Set holding any of those permissions is granted the dedicated permissions here (expand,
--    never revoke). New/edited sets can then drop the administration permission without
--    losing or accidentally keeping blanket visibility.
-- 3. Uncontrolled copy lists used to treat approve/reject/distribute as "see every copy". That
--    is now the dedicated permission too; sets holding those three keep their current access.
-- 4. Uncontrolled copy recipient visibility needs an indexed column: recipient_user_id mirrors
--    recipient_snapshot.userId (the only identity recipient access ever matched on).

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'documents.controlled_copy.view_all', 'View All Controlled Copies',
     'Controlled Copy Files', 'documents', 'controlled_copy_files',
     'See every controlled copy and distribution batch regardless of recipient. Without it a user sees only the copies on which they are the named recipient (unless Record visibility is set to All).',
     710, FALSE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.view_all', 'View All Uncontrolled Copies',
     'Document Control', 'documents', 'uncontrolled_copy',
     'See every uncontrolled copy regardless of recipient. Without it a user sees only the copies they hold as the named recipient (unless Record visibility is set to All).',
     4012, FALSE)
ON CONFLICT (code) DO NOTHING;

-- (2) Sets that relied on an administration permission or the existing view_all keep blanket
--     visibility, now through the three dedicated permissions.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code IN (
        'documents.admin.view',
        'documents.admin.manage_workflow_roles',
        'security.sod.manage',
        'documents.document.view_all'
    )
) src
JOIN permissions tgt ON tgt.code IN (
    'documents.document.view_all',
    'documents.controlled_copy.view_all',
    'documents.uncontrolled_copy.view_all'
)
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- (3) Sets that saw every uncontrolled copy through an operational permission.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code IN (
        'documents.uncontrolled_copy.approve_request',
        'documents.uncontrolled_copy.reject_request',
        'documents.uncontrolled_copy.distribute'
    )
) src
JOIN permissions tgt ON tgt.code = 'documents.uncontrolled_copy.view_all'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- Dependency catalog (reference data only, same style as V403): a blanket copy view still needs
-- the module and the base view permission.
INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale) VALUES
    ('documents.controlled_copy.view_all', 'documents.module.view', 'REQUIRES', 'DOC-13', 'Quyền xem tất cả Controlled Copy cũng cần vào module.'),
    ('documents.controlled_copy.view_all', 'documents.controlled_copy.view', 'IMPLIES', 'DOC-13', 'Quyền xem tất cả bao hàm xem cơ bản.'),
    ('documents.uncontrolled_copy.view_all', 'documents.module.view', 'REQUIRES', 'DOC-14', 'Quyền xem tất cả Uncontrolled Copy cũng cần vào module.'),
    ('documents.uncontrolled_copy.view_all', 'documents.uncontrolled_copy.view', 'IMPLIES', 'DOC-14', 'Quyền xem tất cả bao hàm xem cơ bản.')
ON CONFLICT DO NOTHING;

-- (4) Uncontrolled copy recipient column + backfill (only well-formed UUIDs of existing accounts).
ALTER TABLE uncontrolled_copies ADD COLUMN IF NOT EXISTS recipient_user_id UUID;

UPDATE uncontrolled_copies copy
SET recipient_user_id = account.id
FROM app_users account
WHERE copy.recipient_user_id IS NULL
  AND copy.recipient_snapshot IS NOT NULL
  AND (copy.recipient_snapshot ->> 'userId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND account.id = (copy.recipient_snapshot ->> 'userId')::uuid;

CREATE INDEX IF NOT EXISTS idx_uncontrolled_copies_recipient_user
    ON uncontrolled_copies (recipient_user_id);
