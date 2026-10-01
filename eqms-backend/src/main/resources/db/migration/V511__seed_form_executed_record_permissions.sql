-- V511: Seed Form/Executed Record permission codes and attach them to existing access profiles.
-- Mirrors the seeding shape of V499 (Uncontrolled Copy permissions): everyone who already holds
-- the Uncontrolled Copy request/approve/reject/view/download equivalent also receives the
-- matching Form/Executed Record permission, so no separate access-profile UI work is needed to
-- pilot this feature.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'documents.form.configure', 'Configure Form Settings',
     'Document Control', 'documents', 'form',
     'Enable eForm/paper capture and approval requirement on a Form document.', 4101, TRUE),
    (gen_random_uuid(), 'documents.form.design_efield', 'Design eForm Fields',
     'Document Control', 'documents', 'form',
     'Open a Form''s published PDF in OnlyOffice Form Creator to add fillable fields.', 4102, TRUE),
    (gen_random_uuid(), 'documents.form.fill_eform', 'Fill eForm',
     'Document Control', 'documents', 'form',
     'Fill and submit an electronic form.', 4103, TRUE),
    (gen_random_uuid(), 'documents.form.record_physical_copy', 'Record Physical Copy',
     'Document Control', 'documents', 'form',
     'Log a hand-filled, scanned Controlled Copy as an Executed Record.', 4104, TRUE),
    (gen_random_uuid(), 'documents.form.approve_executed_record', 'Approve Executed Record',
     'Document Control', 'documents', 'form',
     'Approve a pending Executed Record.', 4105, TRUE),
    (gen_random_uuid(), 'documents.form.reject_executed_record', 'Reject Executed Record',
     'Document Control', 'documents', 'form',
     'Reject a pending Executed Record.', 4106, TRUE),
    (gen_random_uuid(), 'documents.form.view_executed_records', 'View Executed Records',
     'Document Control', 'documents', 'form',
     'View Executed Records and their status.', 4107, FALSE),
    (gen_random_uuid(), 'documents.form.download_executed_record', 'Download Executed Record',
     'Document Control', 'documents', 'form',
     'Download the file attached to an Executed Record.', 4108, FALSE)
ON CONFLICT (code) DO NOTHING;

-- Mirror grants from the equivalent Uncontrolled Copy permission, same "expand, never revoke"
-- style as V499.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), legacy.permission_set_id, target.id
FROM permission_set_items legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN (VALUES
    ('documents.uncontrolled_copy.request', 'documents.form.fill_eform'),
    ('documents.uncontrolled_copy.request', 'documents.form.record_physical_copy'),
    ('documents.uncontrolled_copy.approve_request', 'documents.form.approve_executed_record'),
    ('documents.uncontrolled_copy.reject_request', 'documents.form.reject_executed_record'),
    ('documents.uncontrolled_copy.view', 'documents.form.view_executed_records'),
    ('documents.uncontrolled_copy.download_file', 'documents.form.download_executed_record'),
    ('documents.admin.uncontrolled_copies_policy.manage', 'documents.form.configure'),
    ('documents.admin.uncontrolled_copies_policy.manage', 'documents.form.design_efield')
) AS mapping(old_code, new_code) ON mapping.old_code = old_permission.code
JOIN permissions target ON target.code = mapping.new_code
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
