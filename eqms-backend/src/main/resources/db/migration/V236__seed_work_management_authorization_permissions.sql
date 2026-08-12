-- Work Management module entitlements. Project roles remain per-project actor
-- assignments in work_project_members and do not replace these permissions.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
  (gen_random_uuid(), 'work_management.project.view', 'View work projects', 'Work Management', 'WORK_MANAGEMENT', 'PROJECT', 'View projects, issues and work history for projects where the user is a member.', 10, false),
  (gen_random_uuid(), 'work_management.project.create', 'Create work projects', 'Work Management', 'WORK_MANAGEMENT', 'PROJECT', 'Create a new Work Management project.', 20, true),
  (gen_random_uuid(), 'work_management.project.manage_members', 'Manage project members', 'Work Management', 'WORK_MANAGEMENT', 'PROJECT', 'Add or change project members when also authorized as Project Admin.', 30, true),
  (gen_random_uuid(), 'work_management.issue.create', 'Create work issues', 'Work Management', 'WORK_MANAGEMENT', 'ISSUE', 'Create issues in a project where the user is a contributor.', 40, true),
  (gen_random_uuid(), 'work_management.issue.update', 'Update work issues', 'Work Management', 'WORK_MANAGEMENT', 'ISSUE', 'Transition issues in a project where the user is a contributor.', 50, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  module_key = EXCLUDED.module_key,
  group_key = EXCLUDED.group_key,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  requires_audit = EXCLUDED.requires_audit;
