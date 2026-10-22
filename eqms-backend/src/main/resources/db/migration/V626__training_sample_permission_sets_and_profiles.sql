-- V626: sample Permission Sets and Access Profiles for Training Management, for QA to review and adjust.
--
-- The SOP names positions (QM, head of QA, head of department). Real access is given through Permission Sets and Access Profiles, so these are
-- SAMPLES of how the 44 training.* permissions can be bundled. Mapping of every step of SOP.0003.02 to permission and profile:
-- docs/to-be-sds/training/TRAINING-ACCESS-MAPPING.md.
--
-- Nothing is granted to anybody: the profiles are created with no user, no existing set or profile changes, and no enforcement changes.
-- An Administrator assigns users in Security & Authorization when QA has approved the mapping. Sets are single-duty on purpose, so that
-- QA can combine them differently; the service still refuses a person approving what the same person prepared.
-- Idempotent: a set, item, profile or link that already exists is left as it is.

DO $$
DECLARE missing TEXT;
BEGIN
    SELECT string_agg(v.code, ', ') INTO missing
    FROM (VALUES
        ('training.scope.all'), ('training.self.view'), ('training.matrix.view'), ('training.matrix.manage'), ('training.matrix.approve'),
        ('training.requirement.view'), ('training.requirement.prepare'), ('training.requirement.review'), ('training.requirement.approve'),
        ('training.code.allocate'), ('training.activity.view'), ('training.activity.organize'), ('training.activity.conduct'),
        ('training.assessment.record'), ('training.activity.close'), ('training.document_impact.manage'), ('training.content.review'),
        ('training.content.approve'), ('training.trainer.exception.approve'), ('training.approval.designate'), ('training.approval.reassign'),
        ('training.record.view'), ('training.record.export'), ('training.record.void'), ('training.job_assignment.view'),
        ('training.job_assignment.manage'), ('training.job_assignment.exception.approve'), ('training.signature.view'),
        ('training.signature.manage'), ('training.signature.confirm'), ('training.compliance.view'), ('training.settings.view'),
        ('training.settings.manage'), ('training.admin.manage'), ('training.audit.view'), ('training.paper.print'),
        ('training.paper.transcribe'), ('training.paper.verify')
    ) AS v(code)
    WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'V626: training permissions not found: %', missing;
    END IF;
END $$;

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), v.name, v.code, v.description, true, false
FROM (VALUES
    ('Training - My Training', 'TRAINING_MY_TRAINING', 'See and confirm my own training and my own training records.'),
    ('Training - View', 'TRAINING_VIEW', 'Read-only: activities, records, matrices, requirements, job assignments, specimen signatures and compliance of the own department.'),
    ('Training - All Departments', 'TRAINING_ALL_DEPARTMENTS', 'Lets the other Training permissions apply to every department, not only the own one.'),
    ('Training - Organizer', 'TRAINING_ORGANIZER', 'Creates, plans, notifies and cancels training activities, issues training numbers, chooses the positions trained on a document, designates approvers, prints paper packs.'),
    ('Training - Trainer', 'TRAINING_TRAINER', 'Holds sessions, records attendance and assessments, types in paper results.'),
    ('Training - Content Review', 'TRAINING_CONTENT_REVIEW', 'Reviews training content and tests when designated.'),
    ('Training - Content Approve', 'TRAINING_CONTENT_APPROVE', 'Approves training content and tests when designated.'),
    ('Training - QA Closing', 'TRAINING_QA_CLOSE', 'Confirms completion of a training activity, verifies paper transcriptions, exports personal records, reassigns approvers.'),
    ('Training - Void Records', 'TRAINING_RECORD_VOID', 'Voids a training record line with a reason and a signature.'),
    ('Training - Matrix Prepare', 'TRAINING_MATRIX_PREPARE', 'Prepares, edits, submits and upgrades a training matrix.'),
    ('Training - Matrix Approve', 'TRAINING_MATRIX_APPROVE', 'Approves or rejects a training matrix when designated.'),
    ('Training - Requirement Prepare', 'TRAINING_REQUIREMENT_PREPARE', 'Prepares and submits a training requirement.'),
    ('Training - Requirement Review', 'TRAINING_REQUIREMENT_REVIEW', 'Reviews a training requirement when designated.'),
    ('Training - Requirement Approve', 'TRAINING_REQUIREMENT_APPROVE', 'Approves a training requirement when designated.'),
    ('Training - Exception Approve', 'TRAINING_EXCEPTION_APPROVE', 'Approves a trainer who does not meet the trainer requirements, and a job assignment made before the matrix is complete.'),
    ('Training - Job Assignment', 'TRAINING_JOB_ASSIGNMENT', 'Prepares and signs job assignments and creates training for a transfer.'),
    ('Training - Specimen Signature Manage', 'TRAINING_SIGNATURE_MANAGE', 'Uploads a specimen signature.'),
    ('Training - Specimen Signature Confirm', 'TRAINING_SIGNATURE_CONFIRM', 'Confirms a specimen signature when designated.'),
    ('Training - Administration', 'TRAINING_ADMIN', 'Training properties, topics, position mapping, notices and background jobs, and the Training Audit Trail.')
) AS v(name, code, description)
WHERE NOT EXISTS (SELECT 1 FROM permission_sets existing WHERE existing.code = v.code);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('TRAINING_MY_TRAINING', 'training.self.view'),
    ('TRAINING_VIEW', 'training.activity.view'), ('TRAINING_VIEW', 'training.record.view'), ('TRAINING_VIEW', 'training.matrix.view'),
    ('TRAINING_VIEW', 'training.requirement.view'), ('TRAINING_VIEW', 'training.job_assignment.view'), ('TRAINING_VIEW', 'training.signature.view'),
    ('TRAINING_VIEW', 'training.compliance.view'),
    ('TRAINING_ALL_DEPARTMENTS', 'training.scope.all'),
    ('TRAINING_ORGANIZER', 'training.activity.view'), ('TRAINING_ORGANIZER', 'training.activity.organize'), ('TRAINING_ORGANIZER', 'training.code.allocate'),
    ('TRAINING_ORGANIZER', 'training.document_impact.manage'), ('TRAINING_ORGANIZER', 'training.approval.designate'), ('TRAINING_ORGANIZER', 'training.paper.print'),
    ('TRAINING_TRAINER', 'training.activity.view'), ('TRAINING_TRAINER', 'training.activity.conduct'), ('TRAINING_TRAINER', 'training.assessment.record'),
    ('TRAINING_TRAINER', 'training.paper.transcribe'),
    ('TRAINING_CONTENT_REVIEW', 'training.content.review'),
    ('TRAINING_CONTENT_APPROVE', 'training.content.approve'),
    ('TRAINING_QA_CLOSE', 'training.activity.close'), ('TRAINING_QA_CLOSE', 'training.paper.verify'), ('TRAINING_QA_CLOSE', 'training.record.export'),
    ('TRAINING_QA_CLOSE', 'training.approval.reassign'),
    ('TRAINING_RECORD_VOID', 'training.record.void'),
    ('TRAINING_MATRIX_PREPARE', 'training.matrix.view'), ('TRAINING_MATRIX_PREPARE', 'training.matrix.manage'),
    ('TRAINING_MATRIX_APPROVE', 'training.matrix.approve'),
    ('TRAINING_REQUIREMENT_PREPARE', 'training.requirement.view'), ('TRAINING_REQUIREMENT_PREPARE', 'training.requirement.prepare'),
    ('TRAINING_REQUIREMENT_REVIEW', 'training.requirement.review'),
    ('TRAINING_REQUIREMENT_APPROVE', 'training.requirement.approve'),
    ('TRAINING_EXCEPTION_APPROVE', 'training.trainer.exception.approve'), ('TRAINING_EXCEPTION_APPROVE', 'training.job_assignment.exception.approve'),
    ('TRAINING_JOB_ASSIGNMENT', 'training.job_assignment.view'), ('TRAINING_JOB_ASSIGNMENT', 'training.job_assignment.manage'),
    ('TRAINING_SIGNATURE_MANAGE', 'training.signature.view'), ('TRAINING_SIGNATURE_MANAGE', 'training.signature.manage'),
    ('TRAINING_SIGNATURE_CONFIRM', 'training.signature.confirm'),
    ('TRAINING_ADMIN', 'training.settings.view'), ('TRAINING_ADMIN', 'training.settings.manage'), ('TRAINING_ADMIN', 'training.admin.manage'),
    ('TRAINING_ADMIN', 'training.audit.view')
) AS v(set_code, permission_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items existing
    WHERE existing.permission_set_id = ps.id AND existing.permission_id = p.id
);

-- Sample Access Profiles. No user holds them until an Administrator assigns it.
INSERT INTO roles (id, code, name, description, is_system, is_active, type, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.name, v.description, FALSE, TRUE, 'CUSTOM', NOW(), NOW()
FROM (VALUES
    ('TRN_EMPLOYEE', 'Training - Employee', 'Sample: sees and confirms own training.'),
    ('TRN_DEPT_COORDINATOR', 'Training - Department Coordinator', 'Sample: organises training of the department, prepares matrices and requirements, signatures and job assignments.'),
    ('TRN_TRAINER', 'Training - Trainer', 'Sample: conducts training and records attendance and assessments.'),
    ('TRN_CONTENT_REVIEWER', 'Training - Content Reviewer', 'Sample: reviews training content (for example head of department).'),
    ('TRN_CONTENT_APPROVER', 'Training - Content Approver', 'Sample: approves training content (for example head of QA).'),
    ('TRN_QA_RECORDS', 'Training - QA Records Officer', 'Sample: confirms completion, verifies paper results and specimen signatures, exports records, in every department.'),
    ('TRN_QA_MANAGER', 'Training - QA Manager', 'Sample: approves matrices and requirements, approves exceptions and content, voids records, in every department.'),
    ('TRN_ADMIN', 'Training - Administrator', 'Sample: administers Training settings, topics, notices and the Training Audit Trail.')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM roles existing WHERE existing.code = v.code OR existing.name = v.name);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM (VALUES
    ('TRN_EMPLOYEE', 'TRAINING_MY_TRAINING'),
    ('TRN_DEPT_COORDINATOR', 'TRAINING_MY_TRAINING'), ('TRN_DEPT_COORDINATOR', 'TRAINING_VIEW'), ('TRN_DEPT_COORDINATOR', 'TRAINING_ORGANIZER'),
    ('TRN_DEPT_COORDINATOR', 'TRAINING_MATRIX_PREPARE'), ('TRN_DEPT_COORDINATOR', 'TRAINING_REQUIREMENT_PREPARE'),
    ('TRN_DEPT_COORDINATOR', 'TRAINING_JOB_ASSIGNMENT'), ('TRN_DEPT_COORDINATOR', 'TRAINING_SIGNATURE_MANAGE'),
    ('TRN_TRAINER', 'TRAINING_MY_TRAINING'), ('TRN_TRAINER', 'TRAINING_VIEW'), ('TRN_TRAINER', 'TRAINING_TRAINER'),
    ('TRN_CONTENT_REVIEWER', 'TRAINING_MY_TRAINING'), ('TRN_CONTENT_REVIEWER', 'TRAINING_VIEW'), ('TRN_CONTENT_REVIEWER', 'TRAINING_CONTENT_REVIEW'),
    ('TRN_CONTENT_REVIEWER', 'TRAINING_REQUIREMENT_REVIEW'),
    ('TRN_CONTENT_APPROVER', 'TRAINING_MY_TRAINING'), ('TRN_CONTENT_APPROVER', 'TRAINING_VIEW'), ('TRN_CONTENT_APPROVER', 'TRAINING_CONTENT_APPROVE'),
    ('TRN_QA_RECORDS', 'TRAINING_MY_TRAINING'), ('TRN_QA_RECORDS', 'TRAINING_VIEW'), ('TRN_QA_RECORDS', 'TRAINING_ALL_DEPARTMENTS'),
    ('TRN_QA_RECORDS', 'TRAINING_QA_CLOSE'), ('TRN_QA_RECORDS', 'TRAINING_SIGNATURE_CONFIRM'),
    ('TRN_QA_MANAGER', 'TRAINING_MY_TRAINING'), ('TRN_QA_MANAGER', 'TRAINING_VIEW'), ('TRN_QA_MANAGER', 'TRAINING_ALL_DEPARTMENTS'),
    ('TRN_QA_MANAGER', 'TRAINING_MATRIX_APPROVE'), ('TRN_QA_MANAGER', 'TRAINING_REQUIREMENT_APPROVE'), ('TRN_QA_MANAGER', 'TRAINING_EXCEPTION_APPROVE'),
    ('TRN_QA_MANAGER', 'TRAINING_CONTENT_APPROVE'), ('TRN_QA_MANAGER', 'TRAINING_RECORD_VOID'),
    ('TRN_ADMIN', 'TRAINING_MY_TRAINING'), ('TRN_ADMIN', 'TRAINING_VIEW'), ('TRN_ADMIN', 'TRAINING_ALL_DEPARTMENTS'), ('TRN_ADMIN', 'TRAINING_ADMIN')
) AS v(profile_code, set_code)
JOIN roles r ON r.code = v.profile_code
JOIN permission_sets ps ON ps.code = v.set_code
WHERE NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets existing
    WHERE existing.access_profile_id = r.id AND existing.permission_set_id = ps.id
);
