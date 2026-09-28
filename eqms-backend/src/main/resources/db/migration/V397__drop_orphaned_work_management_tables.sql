-- Completes the Work Management module removal started by V355 (which retired the permissions/
-- feature flag but deliberately left the schema in place as an "inaccessible archive" pending a
-- retention/export decision). No live code references any of these tables (verified: no JPA
-- entities/repositories in com.eqms, no controllers, no frontend feature) and their data is
-- negligible test/junk rows (1 project named "ewfwefew", 1 membership row, all other tables
-- empty) -- confirmed against the running database before writing this migration. Dropped in
-- child-to-parent FK order; app_users (referenced by several of these tables) is untouched.

DROP TABLE IF EXISTS work_issue_history;
DROP TABLE IF EXISTS work_issues;
DROP TABLE IF EXISTS work_user_project_preferences;
DROP TABLE IF EXISTS work_project_members;
DROP TABLE IF EXISTS work_projects;
DROP TABLE IF EXISTS work_global_user_roles;
