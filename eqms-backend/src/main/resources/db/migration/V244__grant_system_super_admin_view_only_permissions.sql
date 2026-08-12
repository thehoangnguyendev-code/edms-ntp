-- Follow-up to V243: SYSTEM_SUPER_ADMIN losing the wildcard bypass also
-- blocked basic navigation/browsing of every operational module (e.g.
-- "Access Denied" on the Document Control list). Per GMP Segregation of
-- Duties, Admin should still be able to VIEW records/details across all
-- modules for oversight purposes — it just cannot perform business-workflow
-- actions (create/edit/approve/reject/publish/distribute/recall/etc.) unless
-- separately granted like any other user.
--
-- This grants only genuinely read-only permission codes (module/list view,
-- record detail view, audit view, preview of already-published content) to
-- the existing SYSTEM_ADMINISTRATION permission set. Mutating actions
-- (create/edit/approve/close/implement/investigate/distribute/recall/
-- download_source/generate_preview/etc.) remain excluded.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('SYSTEM_ADMINISTRATION', 'documents.module.view'),
    ('SYSTEM_ADMINISTRATION', 'documents.document.view'),
    ('SYSTEM_ADMINISTRATION', 'documents.document.view_audit'),
    ('SYSTEM_ADMINISTRATION', 'documents.document.preview_published'),
    ('SYSTEM_ADMINISTRATION', 'documents.admin.view'),
    ('SYSTEM_ADMINISTRATION', 'documents.controlled_copy.view'),
    ('SYSTEM_ADMINISTRATION', 'documents.controlled_copy.view_file'),
    ('SYSTEM_ADMINISTRATION', 'documents.controlled_copy.view_evidence'),
    ('SYSTEM_ADMINISTRATION', 'documents.revision.preview'),
    ('SYSTEM_ADMINISTRATION', 'capa.module.view'),
    ('SYSTEM_ADMINISTRATION', 'change_control.module.view'),
    ('SYSTEM_ADMINISTRATION', 'complaints.module.view'),
    ('SYSTEM_ADMINISTRATION', 'deviations.module.view'),
    ('SYSTEM_ADMINISTRATION', 'equipment.module.view'),
    ('SYSTEM_ADMINISTRATION', 'product.module.view'),
    ('SYSTEM_ADMINISTRATION', 'regulatory.module.view'),
    ('SYSTEM_ADMINISTRATION', 'risk_management.module.view'),
    ('SYSTEM_ADMINISTRATION', 'supplier.module.view'),
    ('SYSTEM_ADMINISTRATION', 'training.module.view'),
    ('SYSTEM_ADMINISTRATION', 'work_management.project.view'),
    ('SYSTEM_ADMINISTRATION', 'dashboard.module.view'),
    ('SYSTEM_ADMINISTRATION', 'dashboard.admin.view'),
    ('SYSTEM_ADMINISTRATION', 'my_tasks.module.view'),
    ('SYSTEM_ADMINISTRATION', 'notifications.module.view'),
    ('SYSTEM_ADMINISTRATION', 'preferences.module.view'),
    ('SYSTEM_ADMINISTRATION', 'help_support.module.view'),
    ('SYSTEM_ADMINISTRATION', 'user_manual.module.view'),
    ('SYSTEM_ADMINISTRATION', 'report.module.view')
) AS v(set_code, perm_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);
