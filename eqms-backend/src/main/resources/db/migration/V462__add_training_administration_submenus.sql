-- Training Administration grows from a single "coming soon" leaf into a group of four
-- "coming soon" sub-screens: Training Properties, Requirement Templates, Create a Quiz,
-- Curriculums. Each gets its own granular view permission (mirrors the Document Administration
-- per-screen permission pattern) so an Access Profile can delegate a single screen later once
-- real functionality lands.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'training.admin.properties.view', 'View Training Properties',
     'Training Administration', 'training', 'training_admin',
     'View the Training Properties section under Training Administration.', 62, FALSE),
    (gen_random_uuid(), 'training.admin.requirement_templates.view', 'View Requirement Templates',
     'Training Administration', 'training', 'training_admin',
     'View the Requirement Templates section under Training Administration.', 63, FALSE),
    (gen_random_uuid(), 'training.admin.quiz.view', 'View Create a Quiz',
     'Training Administration', 'training', 'training_admin',
     'View the Create a Quiz section under Training Administration.', 64, FALSE),
    (gen_random_uuid(), 'training.admin.curriculums.view', 'View Curriculums',
     'Training Administration', 'training', 'training_admin',
     'View the Curriculums section under Training Administration.', 65, FALSE)
ON CONFLICT (code) DO NOTHING;

-- Backfill: every Permission Set that already holds training.admin.view (the original single
-- "coming soon" entry point) also receives all four new sub-screen permissions, so nobody who
-- could already see Training Administration loses visibility into any of its new children.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'training.admin.view'
) src
JOIN permissions tgt ON tgt.code IN (
    'training.admin.properties.view',
    'training.admin.requirement_templates.view',
    'training.admin.quiz.view',
    'training.admin.curriculums.view'
)
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
