-- Many permission group_keys shared the same display "category" text even
-- though they group entirely different permissions (a module's *_access
-- group_key holds only the "view module" permission while its *_actions
-- group_key holds the create/edit/workflow permissions, but both were
-- labelled with the plain module name). The Permission Explorer / Access
-- Profile / Meaning pickers group permissions by group_key, so this made
-- several visually-identical accordion entries appear under one module
-- (e.g. three "Document Control" groups, two "Revision Files" groups) with
-- no way to tell them apart. Give each group_key a category that reflects
-- what it actually contains. Purely a display-label fix — no permission
-- codes, group_keys, or module_keys are changed.

UPDATE permissions SET category = 'Document Administration' WHERE group_key = 'document_administration';
UPDATE permissions SET category = 'Training & Publishing' WHERE group_key = 'training_publish';
UPDATE permissions SET category = 'Office Online Authoring' WHERE group_key = 'revision_authoring';

UPDATE permissions SET category = 'System Configuration' WHERE module_key = 'app-settings' AND group_key = 'system_configuration';
UPDATE permissions SET category = 'Data Dictionaries' WHERE module_key = 'app-settings' AND group_key = 'data_dictionaries';
UPDATE permissions SET category = 'Controlled Copies Policy' WHERE module_key = 'app-settings' AND group_key = 'document_control';

UPDATE permissions SET category = 'CAPA Access' WHERE group_key = 'capa_access';
UPDATE permissions SET category = 'CAPA Actions' WHERE group_key = 'capa_actions';

UPDATE permissions SET category = 'Change Control Access' WHERE group_key = 'change_control_access';
UPDATE permissions SET category = 'Change Control Actions' WHERE group_key = 'change_control_actions';

UPDATE permissions SET category = 'Complaints Access' WHERE group_key = 'complaints_access';
UPDATE permissions SET category = 'Complaints Actions' WHERE group_key = 'complaints_actions';

UPDATE permissions SET category = 'Deviations Access' WHERE group_key = 'deviations_access';
UPDATE permissions SET category = 'Deviations Actions' WHERE group_key = 'deviations_actions';

UPDATE permissions SET category = 'Equipment Access' WHERE group_key = 'equipment_access';
UPDATE permissions SET category = 'Equipment Actions' WHERE group_key = 'equipment_actions';

UPDATE permissions SET category = 'Product Access' WHERE group_key = 'product_access';
UPDATE permissions SET category = 'Product Actions' WHERE group_key = 'product_actions';

UPDATE permissions SET category = 'Regulatory Access' WHERE group_key = 'regulatory_access';
UPDATE permissions SET category = 'Regulatory Actions' WHERE group_key = 'regulatory_actions';

UPDATE permissions SET category = 'Risk Management Access' WHERE group_key = 'risk_access';
UPDATE permissions SET category = 'Risk Management Actions' WHERE group_key = 'risk_actions';

UPDATE permissions SET category = 'Supplier Access' WHERE group_key = 'supplier_access';
UPDATE permissions SET category = 'Supplier Actions' WHERE group_key = 'supplier_actions';

UPDATE permissions SET category = 'Training Access' WHERE group_key = 'training_access';
UPDATE permissions SET category = 'Training Administration' WHERE group_key = 'training_admin';

UPDATE permissions SET category = 'Audit Trail (Legacy)' WHERE module_key = 'audit-trail' AND group_key = 'audit_trail_access';

UPDATE permissions SET category = 'Access Profiles' WHERE module_key = 'security-authorization' AND group_key = 'access_profiles';
UPDATE permissions SET category = 'Access Review' WHERE module_key = 'security-authorization' AND group_key = 'access_review';
UPDATE permissions SET category = 'Object Access Rules' WHERE module_key = 'security-authorization' AND group_key = 'object_access';
UPDATE permissions SET category = 'Permission Sets' WHERE module_key = 'security-authorization' AND group_key = 'permission_sets';
UPDATE permissions SET category = 'Segregation of Duties' WHERE module_key = 'security-authorization' AND group_key = 'segregation_of_duties';
UPDATE permissions SET category = 'Workflow Authorization' WHERE module_key = 'security-authorization' AND group_key = 'workflow_authorization';

UPDATE permissions SET category = 'Access Profiles (Legacy)' WHERE module_key = 'system-admin' AND group_key = 'access_profiles';
UPDATE permissions SET category = 'User Management' WHERE module_key = 'system-admin' AND group_key = 'user_management';
