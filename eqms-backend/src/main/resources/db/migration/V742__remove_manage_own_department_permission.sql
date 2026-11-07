-- Whoever is named Department Head (Department) or Head of Unit (Business Unit) in Dictionaries may share the Knowledge Base of what he or she
-- heads: only the administrator edits Dictionaries, so the naming is the grant and there is no permission to assign. The permission
-- "Share Knowledge Base of Own Department" (V727, V735) has no use any more; it was granted to no profile by default.
DELETE FROM permission_dependencies WHERE permission_code = 'security.object_rules.manage_own_department' OR depends_on_code = 'security.object_rules.manage_own_department';
DELETE FROM permission_set_items WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'security.object_rules.manage_own_department');
DELETE FROM permissions WHERE code = 'security.object_rules.manage_own_department';
