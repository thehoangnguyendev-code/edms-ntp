-- DEV test only (2026-11-07, owner instruction in the session): sample Access Profiles and accounts for the Document Control visibility run.
-- One profile ("DC Contributor") is enough for a person who is Author on one document and Reviewer/Approver on another: the role per document comes from the flow, not from the profile.
-- Idempotent; DEV data only. Accounts take the password hash of the admin test account (the shared DEV test password). Restart the backend afterwards: permissions are cached.
BEGIN;

-- ---------------------------------------------------------------- permission sets
INSERT INTO permission_sets (id, name, code, description, active, system, created_at, updated_at, version)
SELECT gen_random_uuid(), v.name, v.code, v.descr, TRUE, FALSE, now(), now(), 0
FROM (VALUES
  ('DC Contributor (DEV test)', 'PS_DCV_CONTRIBUTOR', 'DEV test: may write, review and approve revisions and ask for copies; WHICH documents comes from the name in the flow.'),
  ('DC Operator (DEV test)', 'PS_DCV_OPERATOR', 'DEV test: Document Control operator: creates documents, publishes, distributes, recalls. No view-everything.'),
  ('DC Uncontrolled Copy Approver (DEV test)', 'PS_DCV_UC_APPROVER', 'DEV test: approves or rejects Uncontrolled Copy requests.'),
  ('DC Knowledge Reader (DEV test)', 'PS_DCV_READER', 'DEV test: reads Effective documents through the Knowledge Base only.')
) AS v(name, code, descr)
WHERE NOT EXISTS (SELECT 1 FROM permission_sets s WHERE s.code = v.code);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code IN (
  'dashboard.module.view', 'notifications.module.view', 'self_service.knowledge.view', 'documents.module.view', 'documents.document.view', 'documents.revision.preview',
  'documents.revision.edit_onlyoffice', 'documents.revision.upload_source', 'documents.revision.submit_review', 'documents.revision.review', 'documents.revision.reject_review',
  'documents.revision.approve', 'documents.revision.reject_approval', 'documents.revision.upgrade', 'documents.document.edit_metadata', 'documents.form.design_efield',
  'documents.controlled_copy.view', 'documents.controlled_copy.view_file', 'documents.controlled_copy.request', 'documents.controlled_copy.report_lost_damaged',
  'documents.uncontrolled_copy.view', 'documents.uncontrolled_copy.view_file', 'documents.uncontrolled_copy.preview_file', 'documents.uncontrolled_copy.request')
WHERE ps.code = 'PS_DCV_CONTRIBUTOR' AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

-- the operator = the DCO test set without the three view-everything permissions
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), tgt.id, i.permission_id FROM permission_sets tgt JOIN permission_sets src ON src.code = 'PS_DCO_TEST'
JOIN permission_set_items i ON i.permission_set_id = src.id JOIN permissions p ON p.id = i.permission_id
WHERE tgt.code = 'PS_DCV_OPERATOR' AND p.code NOT IN ('documents.document.view_all', 'documents.controlled_copy.view_all', 'documents.uncontrolled_copy.view_all')
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = tgt.id AND x.permission_id = i.permission_id);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code IN ('documents.uncontrolled_copy.approve_request', 'documents.uncontrolled_copy.reject_request')
WHERE ps.code = 'PS_DCV_UC_APPROVER' AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code IN ('dashboard.module.view', 'notifications.module.view', 'self_service.knowledge.view')
WHERE ps.code = 'PS_DCV_READER' AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

-- ---------------------------------------------------------------- access profiles
INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.name, v.descr, FALSE, TRUE, 'CUSTOM', 0, now(), now()
FROM (VALUES
  ('DCV_CONTRIBUTOR', 'DC Contributor (DEV test)', 'DEV test: author / reviewer / approver by the name in each flow.'),
  ('DCV_UC_APPROVER', 'DC Uncontrolled Copy Approver (DEV test)', 'DEV test: contributor who also approves Uncontrolled Copy requests.'),
  ('DCV_OPERATOR', 'DC Operator (DEV test)', 'DEV test: Document Control operator, ticked with view-everything (an operator who is not ticked cannot even see the documents he creates; run finding F1, 2026-11-07).'),
  ('DCV_VIEWALL', 'DC Contributor + View Everything (DEV test)', 'DEV test: contributor ticked with the view-everything bundle.'),
  ('DCV_READER', 'DC Knowledge Reader (DEV test)', 'DEV test: Knowledge Base only.'),
  ('DCV_CREATOR', 'DC Operator without View Everything (DEV test)', 'DEV test: operator not ticked with view-everything; sees only what he created or is named in (finding F1).')
) AS v(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.code = v.code);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON
  (r.code = 'DCV_CONTRIBUTOR' AND ps.code = 'PS_DCV_CONTRIBUTOR') OR
  (r.code = 'DCV_UC_APPROVER' AND ps.code IN ('PS_DCV_CONTRIBUTOR', 'PS_DCV_UC_APPROVER')) OR
  (r.code = 'DCV_OPERATOR' AND ps.code IN ('PS_DCV_OPERATOR', 'PS_DOCUMENT_VIEW_ALL', 'PS_CONTROLLED_COPY_DCO')) OR
  (r.code = 'DCV_VIEWALL' AND ps.code IN ('PS_DCV_CONTRIBUTOR', 'PS_DOCUMENT_VIEW_ALL')) OR
  (r.code = 'DCV_READER' AND ps.code = 'PS_DCV_READER') OR
  (r.code = 'DCV_CREATOR' AND ps.code IN ('PS_DCV_OPERATOR', 'PS_CONTROLLED_COPY_DCO'))
WHERE NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);

-- ---------------------------------------------------------------- accounts
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, position, status, employee_code, business_unit, start_date, created_at, updated_at,
                       password_changed_at, mfa_email_fallback_enabled, mfa_remember_device_enabled)
SELECT gen_random_uuid(), v.username, v.username || '@example.local', v.full_name, (SELECT password_hash FROM app_users WHERE username = 'admin'), 'ACCESS_PROFILE_MANAGED',
       'Quality Control', 'QC Specialist', 'Active', v.code, 'Quality Unit', DATE '2025-03-03', now(), now(), now(), FALSE, FALSE
FROM (VALUES
  ('dcv.u1', 'DCV Contributor 1', 'TEST-DCV-01'), ('dcv.u2', 'DCV Contributor 2', 'TEST-DCV-02'), ('dcv.u3', 'DCV Contributor 3', 'TEST-DCV-03'),
  ('dcv.approver', 'DCV Copy Approver', 'TEST-DCV-04'), ('dcv.operator', 'DCV Operator', 'TEST-DCV-05'), ('dcv.viewall', 'DCV View Everything', 'TEST-DCV-06'),
  ('dcv.reader', 'DCV Knowledge Reader', 'TEST-DCV-07'), ('dcv.creator', 'DCV Operator not ticked', 'TEST-DCV-08')
) AS v(username, full_name, code)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.username = v.username);

UPDATE app_users SET mfa_email_fallback_enabled = FALSE, mfa_remember_device_enabled = FALSE, password_changed_at = COALESCE(password_changed_at, now()) WHERE username LIKE 'dcv.%';

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON
  (u.username IN ('dcv.u1', 'dcv.u2', 'dcv.u3') AND r.code = 'DCV_CONTRIBUTOR') OR (u.username = 'dcv.approver' AND r.code = 'DCV_UC_APPROVER') OR
  (u.username = 'dcv.operator' AND r.code = 'DCV_OPERATOR') OR (u.username = 'dcv.viewall' AND r.code = 'DCV_VIEWALL') OR (u.username = 'dcv.reader' AND r.code = 'DCV_READER') OR (u.username = 'dcv.creator' AND r.code = 'DCV_CREATOR')
WHERE NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);
COMMIT;
