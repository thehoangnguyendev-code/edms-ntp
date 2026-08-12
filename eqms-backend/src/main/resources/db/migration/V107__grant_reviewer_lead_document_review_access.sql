INSERT INTO roles (id, code, name, description, is_system, is_active, created_at, updated_at)
SELECT
    '41111111-1111-1111-1111-111111111120',
    'REVIEWER_LEAD',
    'Reviewer Lead',
    'Custom reviewer role',
    FALSE,
    TRUE,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'REVIEWER_LEAD'
       OR name = 'Reviewer Lead'
);

WITH reviewer_role AS (
    SELECT id
    FROM roles
    WHERE code = 'REVIEWER_LEAD'
       OR name = 'Reviewer Lead'
    ORDER BY created_at ASC
    LIMIT 1
),
reviewer_permissions AS (
    SELECT p.id
    FROM permissions p
    WHERE p.code IN (
        'VIEW_DOCUMENTS',
        'REVIEW_DOCUMENTS',
        'COMPLETE_REVIEW',
        'REJECT_REVISION',
        'VIEW_FINAL_PDF_PREVIEW',
        'VIEW_DOCUMENT_AUDIT_TRAIL',
        'VIEW_REPORTS'
    )
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT reviewer_role.id, reviewer_permissions.id
FROM reviewer_role
CROSS JOIN reviewer_permissions
ON CONFLICT DO NOTHING;

INSERT INTO document_workflow_pool_members (id, pool_type, user_id, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'REVIEWER',
    u.id,
    TRUE,
    NOW(),
    NOW()
FROM app_users u
WHERE u.username IN ('reviewer.lead1', 'reviewer.lead2')
ON CONFLICT (pool_type, user_id) DO UPDATE
SET is_active = TRUE,
    updated_at = NOW();
