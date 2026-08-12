-- ============================================================
-- V115: Reorganize permission module structure
-- * Split 'settings' into 'system-admin' (users + roles) and
--   'app-settings' (configuration)
-- * Rename 'report' -> 'reports'
-- * Move 'user-manual' permissions under 'help-support'
-- * Give each quality/operations module its own group_key
-- * Add granular function-level permissions for each module
-- ============================================================

-- 1. Split settings → system-admin (user management + role management)
UPDATE permissions
SET module_key = 'system-admin',
    group_key  = CASE
                     WHEN group_key = 'user_management' THEN 'user_management'
                     WHEN group_key = 'access_profiles' THEN 'access_profiles'
                     ELSE group_key
                 END
WHERE module_key = 'settings'
  AND group_key IN ('user_management', 'access_profiles');

-- 2. Split settings → app-settings (configuration)
UPDATE permissions
SET module_key = 'app-settings',
    group_key  = 'system_configuration',
    category   = 'Application Settings'
WHERE module_key = 'settings'
  AND group_key = 'system_configuration';

-- 3. Rename report → reports; update category
UPDATE permissions
SET module_key = 'reports',
    group_key  = 'reports_access',
    category   = 'Reports & Analytics'
WHERE module_key = 'report';

-- 4. Merge user-manual into help-support; update category
UPDATE permissions
SET module_key = 'help-support',
    group_key  = 'help_support',
    category   = 'Help & Support'
WHERE module_key = 'user-manual';

UPDATE permissions
SET group_key = 'help_support',
    category  = 'Help & Support'
WHERE module_key = 'help-support';

-- 5. Quality modules: own group_keys + distinct categories
UPDATE permissions SET group_key = 'deviations_access',     category = 'Deviations & NCs'          WHERE module_key = 'deviations';
UPDATE permissions SET group_key = 'capa_access',           category = 'CAPA Management'            WHERE module_key = 'capa';
UPDATE permissions SET group_key = 'change_control_access', category = 'Change Controls'            WHERE module_key = 'change-control';
UPDATE permissions SET group_key = 'complaints_access',     category = 'Complaints Management'      WHERE module_key = 'complaints';
UPDATE permissions SET group_key = 'risk_access',           category = 'Risk Management'            WHERE module_key = 'risk-management';

-- 6. Operations modules: own group_keys + distinct categories
UPDATE permissions SET group_key = 'equipment_access',  category = 'Equipment Management'  WHERE module_key = 'equipment';
UPDATE permissions SET group_key = 'supplier_access',   category = 'Supplier Management'   WHERE module_key = 'supplier';
UPDATE permissions SET group_key = 'product_access',    category = 'Product Management'    WHERE module_key = 'product';
UPDATE permissions SET group_key = 'regulatory_access', category = 'Regulatory Management' WHERE module_key = 'regulatory';

-- 7. Fix personal workspace modules: give each its own category
UPDATE permissions SET group_key = 'notifications_access', category = 'Notifications' WHERE module_key = 'notifications';
UPDATE permissions SET group_key = 'my_tasks_access',      category = 'My Tasks'       WHERE module_key = 'my-tasks';
UPDATE permissions SET group_key = 'preferences_access',   category = 'Preferences'    WHERE module_key = 'preferences';

-- 8. Fix audit trail category
UPDATE permissions SET group_key = 'audit_trail_access', category = 'Audit Trail' WHERE module_key = 'audit-trail';

-- 9. Fix dashboard category
UPDATE permissions SET group_key = 'dashboard_access', category = 'Dashboard' WHERE module_key = 'dashboard';

-- 10. System-admin: update category
UPDATE permissions SET category = 'System Administration' WHERE module_key = 'system-admin';

-- ============================================================
-- 7. Add granular permissions for modules that only had "view"
-- ============================================================

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    -- ---- Deviations & NCs ----
    ('72111111-1111-1111-1111-111111111001', 'deviations.record.create',      'Report Deviation / NC',        'Deviations & NCs',        'deviations',      'deviations_actions',      'Create and submit a new deviation or non-conformance report.',              82, TRUE),
    ('72111111-1111-1111-1111-111111111002', 'deviations.record.edit',        'Edit Deviation Record',        'Deviations & NCs',        'deviations',      'deviations_actions',      'Edit an existing deviation or non-conformance record.',                     84, TRUE),
    ('72111111-1111-1111-1111-111111111003', 'deviations.record.investigate', 'Investigate Deviation',        'Deviations & NCs',        'deviations',      'deviations_actions',      'Perform root cause analysis and document investigation findings.',           86, TRUE),
    ('72111111-1111-1111-1111-111111111004', 'deviations.record.approve',     'Approve Deviation',            'Deviations & NCs',        'deviations',      'deviations_actions',      'Review and approve a deviation investigation outcome.',                     88, TRUE),
    ('72111111-1111-1111-1111-111111111005', 'deviations.record.close',       'Close Deviation',              'Deviations & NCs',        'deviations',      'deviations_actions',      'Close a resolved deviation or non-conformance record.',                     90, TRUE),

    -- ---- CAPA Management ----
    ('72111111-1111-1111-1111-111111111011', 'capa.record.create',            'Create CAPA',                  'CAPA Management',         'capa',            'capa_actions',            'Create a new corrective or preventive action record.',                     102, TRUE),
    ('72111111-1111-1111-1111-111111111012', 'capa.record.edit',              'Edit CAPA Record',             'CAPA Management',         'capa',            'capa_actions',            'Edit an existing CAPA record or action plan.',                             104, TRUE),
    ('72111111-1111-1111-1111-111111111013', 'capa.record.assign',            'Assign CAPA Actions',          'CAPA Management',         'capa',            'capa_actions',            'Assign tasks and responsible owners to CAPA action items.',                106, TRUE),
    ('72111111-1111-1111-1111-111111111014', 'capa.record.implement',         'Implement CAPA Action',        'CAPA Management',         'capa',            'capa_actions',            'Record implementation evidence for assigned CAPA actions.',                108, TRUE),
    ('72111111-1111-1111-1111-111111111015', 'capa.record.verify',            'Verify CAPA Effectiveness',    'CAPA Management',         'capa',            'capa_actions',            'Perform and record effectiveness verification for a closed CAPA.',          110, TRUE),
    ('72111111-1111-1111-1111-111111111016', 'capa.record.close',             'Close CAPA',                   'CAPA Management',         'capa',            'capa_actions',            'Close a verified and completed CAPA record.',                              112, TRUE),

    -- ---- Change Controls ----
    ('72111111-1111-1111-1111-111111111021', 'change_control.record.create',  'Create Change Control',        'Change Controls',         'change-control',  'change_control_actions',  'Create a new change control request.',                                     92, TRUE),
    ('72111111-1111-1111-1111-111111111022', 'change_control.record.edit',    'Edit Change Control',          'Change Controls',         'change-control',  'change_control_actions',  'Edit a change control request record.',                                    94, TRUE),
    ('72111111-1111-1111-1111-111111111023', 'change_control.record.review',  'Review Change Control',        'Change Controls',         'change-control',  'change_control_actions',  'Perform an assigned review step for a change control request.',             96, TRUE),
    ('72111111-1111-1111-1111-111111111024', 'change_control.record.approve', 'Approve Change Control',       'Change Controls',         'change-control',  'change_control_actions',  'Approve a change control request to proceed with implementation.',          98, TRUE),
    ('72111111-1111-1111-1111-111111111025', 'change_control.record.implement','Implement Change Control',    'Change Controls',         'change-control',  'change_control_actions',  'Record implementation details and evidence for an approved change.',        99, TRUE),
    ('72111111-1111-1111-1111-111111111026', 'change_control.record.close',   'Close Change Control',         'Change Controls',         'change-control',  'change_control_actions',  'Close a fully implemented and verified change control.',                   100, TRUE),

    -- ---- Complaints Management ----
    ('72111111-1111-1111-1111-111111111031', 'complaints.record.create',      'Create Complaint',             'Complaints Management',   'complaints',      'complaints_actions',      'Create and submit a new customer or regulatory complaint record.',          113, TRUE),
    ('72111111-1111-1111-1111-111111111032', 'complaints.record.edit',        'Edit Complaint Record',        'Complaints Management',   'complaints',      'complaints_actions',      'Edit an existing complaint record.',                                       115, TRUE),
    ('72111111-1111-1111-1111-111111111033', 'complaints.record.investigate', 'Investigate Complaint',        'Complaints Management',   'complaints',      'complaints_actions',      'Perform investigation and document findings for a complaint.',              117, TRUE),
    ('72111111-1111-1111-1111-111111111034', 'complaints.record.close',       'Close Complaint',              'Complaints Management',   'complaints',      'complaints_actions',      'Close a resolved complaint record.',                                       119, TRUE),

    -- ---- Risk Management ----
    ('72111111-1111-1111-1111-111111111041', 'risk_management.record.create', 'Create Risk Assessment',       'Risk Management',         'risk-management', 'risk_actions',            'Create a new risk assessment record.',                                     122, TRUE),
    ('72111111-1111-1111-1111-111111111042', 'risk_management.record.edit',   'Edit Risk Record',             'Risk Management',         'risk-management', 'risk_actions',            'Edit an existing risk record or assessment.',                              124, TRUE),
    ('72111111-1111-1111-1111-111111111043', 'risk_management.record.review', 'Review Risk Assessment',       'Risk Management',         'risk-management', 'risk_actions',            'Review and score a risk assessment.',                                      126, TRUE),
    ('72111111-1111-1111-1111-111111111044', 'risk_management.record.approve','Approve Risk',                 'Risk Management',         'risk-management', 'risk_actions',            'Approve and accept a reviewed risk assessment.',                           128, TRUE),

    -- ---- Equipment Management ----
    ('72111111-1111-1111-1111-111111111051', 'equipment.record.create',       'Add Equipment',                'Equipment Management',    'equipment',       'equipment_actions',       'Add a new equipment record to the asset register.',                        132, TRUE),
    ('72111111-1111-1111-1111-111111111052', 'equipment.record.edit',         'Edit Equipment Record',        'Equipment Management',    'equipment',       'equipment_actions',       'Edit equipment metadata and lifecycle information.',                       134, TRUE),
    ('72111111-1111-1111-1111-111111111053', 'equipment.record.calibrate',    'Manage Calibration',           'Equipment Management',    'equipment',       'equipment_actions',       'Create and manage calibration records for equipment.',                     136, TRUE),
    ('72111111-1111-1111-1111-111111111054', 'equipment.record.retire',       'Retire Equipment',             'Equipment Management',    'equipment',       'equipment_actions',       'Retire or decommission an equipment asset.',                               138, TRUE),

    -- ---- Supplier Management ----
    ('72111111-1111-1111-1111-111111111061', 'supplier.record.create',        'Add Supplier',                 'Supplier Management',     'supplier',        'supplier_actions',        'Add a new supplier or vendor to the system.',                              142, TRUE),
    ('72111111-1111-1111-1111-111111111062', 'supplier.record.edit',          'Edit Supplier Record',         'Supplier Management',     'supplier',        'supplier_actions',        'Edit supplier profile and qualification information.',                     144, TRUE),
    ('72111111-1111-1111-1111-111111111063', 'supplier.record.approve',       'Approve Supplier',             'Supplier Management',     'supplier',        'supplier_actions',        'Approve or qualify a supplier for use.',                                   146, TRUE),
    ('72111111-1111-1111-1111-111111111064', 'supplier.record.audit',         'Manage Supplier Audit',        'Supplier Management',     'supplier',        'supplier_actions',        'Create and manage supplier audit records.',                                148, TRUE),

    -- ---- Product Management ----
    ('72111111-1111-1111-1111-111111111071', 'product.record.create',         'Add Product',                  'Product Management',      'product',         'product_actions',         'Add a new product or specification to the system.',                        152, TRUE),
    ('72111111-1111-1111-1111-111111111072', 'product.record.edit',           'Edit Product Record',          'Product Management',      'product',         'product_actions',         'Edit a product specification or lifecycle record.',                        154, TRUE),

    -- ---- Regulatory Management ----
    ('72111111-1111-1111-1111-111111111081', 'regulatory.record.create',      'Create Regulatory Record',     'Regulatory Management',   'regulatory',      'regulatory_actions',      'Create a new regulatory record or submission.',                            162, TRUE),
    ('72111111-1111-1111-1111-111111111082', 'regulatory.record.edit',        'Edit Regulatory Record',       'Regulatory Management',   'regulatory',      'regulatory_actions',      'Edit an existing regulatory record.',                                      164, TRUE),
    ('72111111-1111-1111-1111-111111111083', 'regulatory.record.submit',      'Submit Regulatory Filing',     'Regulatory Management',   'regulatory',      'regulatory_actions',      'Submit a regulatory filing or dossier to a health authority.',             166, TRUE),

    -- ---- Training Management (additional) ----
    ('72111111-1111-1111-1111-111111111091', 'training.session.manage',       'Manage Training Sessions',     'Training Administration', 'training',        'training_admin',          'Schedule and manage training sessions and attendance records.',             72, TRUE),
    ('72111111-1111-1111-1111-111111111092', 'training.assignment.manage',    'Manage Training Assignments',  'Training Administration', 'training',        'training_admin',          'Assign training courses and requirements to users or groups.',              74, TRUE)

ON CONFLICT (code) DO UPDATE SET
    name         = EXCLUDED.name,
    category     = EXCLUDED.category,
    module_key   = EXCLUDED.module_key,
    group_key    = EXCLUDED.group_key,
    description  = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    requires_audit = EXCLUDED.requires_audit;

-- Grant all new permissions to Administrator / SuperAdmin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'deviations.record.create', 'deviations.record.edit', 'deviations.record.investigate',
    'deviations.record.approve', 'deviations.record.close',
    'capa.record.create', 'capa.record.edit', 'capa.record.assign',
    'capa.record.implement', 'capa.record.verify', 'capa.record.close',
    'change_control.record.create', 'change_control.record.edit', 'change_control.record.review',
    'change_control.record.approve', 'change_control.record.implement', 'change_control.record.close',
    'complaints.record.create', 'complaints.record.edit', 'complaints.record.investigate',
    'complaints.record.close',
    'risk_management.record.create', 'risk_management.record.edit',
    'risk_management.record.review', 'risk_management.record.approve',
    'equipment.record.create', 'equipment.record.edit', 'equipment.record.calibrate',
    'equipment.record.retire',
    'supplier.record.create', 'supplier.record.edit', 'supplier.record.approve',
    'supplier.record.audit',
    'product.record.create', 'product.record.edit',
    'regulatory.record.create', 'regulatory.record.edit', 'regulatory.record.submit',
    'training.session.manage', 'training.assignment.manage'
)
WHERE UPPER(r.name) IN ('ADMIN', 'ADMINISTRATOR', 'SUPERADMIN')
   OR UPPER(r.code) IN ('ADMIN', 'ADMINISTRATOR', 'SUPERADMIN')
ON CONFLICT DO NOTHING;
