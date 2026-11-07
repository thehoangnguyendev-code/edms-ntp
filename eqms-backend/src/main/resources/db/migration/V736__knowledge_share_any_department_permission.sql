-- Owner decision 2026-11-04: for self-reading training the person designated as DCO (who sees every document anyway) must be able to share
-- Knowledge Base folders and documents of ANY Department with the trainees, not only the Department Head of that Department.
-- It is a permission like every other, assigned through an Access Profile (never a role name), and it is granted to no profile by default:
-- the administrator assigns it to the profile of the person designated as DCO.
-- (permissions.description is VARCHAR(255): keep the text short.)
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT '72111111-1111-1111-1111-111111111736'::uuid, 'security.object_rules.share_knowledge_any_department',
       'Share Knowledge Base of Any Department', 'Object Access Rules', 'security-authorization', 'object_access',
       'Decide who sees the folders and documents of any Department in the Knowledge Base (for example to give trainees a document to read). Only shares; changes nothing in Document Control.',
       1834, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = 'security.object_rules.share_knowledge_any_department');
