-- TRAINING-WP-1/2/5 (docs/to-be-sds/training/SDS-TR-001): foundation of Training Management.
-- Settings, numbering, activities linked to a document revision, assignment of approvers, events, the four revision columns, permissions and signature meanings.
-- Forward-only and idempotent. Nothing is granted to anybody here: permissions are ticked in Security & Authorization > Permission Sets.

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 1. Settings (one row) and non-working days
-- ---------------------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_settings (
    id                             INTEGER PRIMARY KEY CHECK (id = 1),
    pass_percent                   INTEGER      NOT NULL DEFAULT 70  CHECK (pass_percent BETWEEN 1 AND 100),
    document_training_days_default INTEGER      NOT NULL DEFAULT 10  CHECK (document_training_days_default BETWEEN 1 AND 365),
    results_due_working_days       INTEGER      NOT NULL DEFAULT 7   CHECK (results_due_working_days BETWEEN 1 AND 60),
    annual_requirement_due_month   INTEGER      NOT NULL DEFAULT 12  CHECK (annual_requirement_due_month BETWEEN 1 AND 12),
    annual_requirement_due_day     INTEGER      NOT NULL DEFAULT 31  CHECK (annual_requirement_due_day BETWEEN 1 AND 31),
    absence_retrain_months         INTEGER      NOT NULL DEFAULT 6   CHECK (absence_retrain_months BETWEEN 1 AND 60),
    retention_years_after_leaving  INTEGER      NOT NULL DEFAULT 10  CHECK (retention_years_after_leaving >= 10),
    integration_enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
    version                        INTEGER      NOT NULL DEFAULT 1,
    updated_by                     UUID         REFERENCES app_users(id),
    updated_at                     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO training_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS training_non_working_days (
    day         DATE PRIMARY KEY,
    reason      VARCHAR(255) NOT NULL,
    created_by  UUID REFERENCES app_users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 2. Person to position (the user table only holds the position as text)
-- ---------------------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_person_positions (
    id             UUID PRIMARY KEY,
    person_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    position_id    UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    department_id  UUID REFERENCES departments(id) ON DELETE RESTRICT,
    valid_from     DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to       DATE,
    source         VARCHAR(20) NOT NULL DEFAULT 'ADMIN' CHECK (source IN ('MIGRATION','JOB_ASSIGNMENT','ADMIN')),
    created_by     UUID REFERENCES app_users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
-- one open position per person
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_person_positions_open ON training_person_positions (person_user_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS ix_training_person_positions_position ON training_person_positions (position_id) WHERE valid_to IS NULL;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 3. Numbering and activities
-- ---------------------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_number_sequences (
    department_id UUID    NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    year          INTEGER NOT NULL,
    last_serial   INTEGER NOT NULL,
    PRIMARY KEY (department_id, year)
);

CREATE TABLE IF NOT EXISTS training_activities (
    id                       UUID PRIMARY KEY,
    training_number          VARCHAR(40)  NOT NULL UNIQUE,
    base_number              VARCHAR(40)  NOT NULL,
    suffix                   VARCHAR(6),
    parent_activity_id       UUID REFERENCES training_activities(id) ON DELETE RESTRICT,
    organizer_department_id  UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    year                     INTEGER NOT NULL,
    serial                   INTEGER NOT NULL,
    kind                     VARCHAR(20)  NOT NULL CHECK (kind IN ('INITIAL','PERIODIC','UNPLANNED','RETRAINING','EXTERNAL')),
    kind_reason              VARCHAR(30)  CHECK (kind_reason IS NULL OR kind_reason IN ('NEW_HIRE','TRANSFER','NEW_SOP','SOP_VERSION','CAPA','AUDIT_FINDING','VISITOR','ABSENCE_RETURN','ABSENT_MAKEUP','FAILED_ASSESSMENT','OTHER')),
    external_type            VARCHAR(10)  CHECK (external_type IS NULL OR external_type IN ('ACTIVE','PASSIVE')),
    title                    VARCHAR(255) NOT NULL,
    status                   VARCHAR(30)  NOT NULL CHECK (status IN ('RESERVED','PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION','COMPLETED','CANCELLED')),
    document_id              UUID REFERENCES documents(id) ON DELETE RESTRICT,
    revision_id              UUID REFERENCES document_revisions(id) ON DELETE RESTRICT,
    revision_number          VARCHAR(40),
    document_number          VARCHAR(80),
    document_name            VARCHAR(255),
    requirement_line_id      UUID,
    matrix_row_id            UUID,
    training_period_days     INTEGER,
    approved_on              DATE,
    due_date                 DATE,
    remarks                  TEXT,
    cancel_reason            TEXT,
    impact_assessed_by       UUID REFERENCES app_users(id),
    impact_assessed_at       TIMESTAMPTZ,
    confirmed_by             UUID REFERENCES app_users(id),
    confirmed_at             TIMESTAMPTZ,
    confirm_signature_id     UUID,
    completed_on             DATE,
    list_prepared_by         UUID REFERENCES app_users(id),
    version                  INTEGER NOT NULL DEFAULT 1,
    created_by               UUID REFERENCES app_users(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live root activity per revision, and one waiting for its first revision (the suffix rules are enforced by the service).
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_activity_revision ON training_activities (revision_id)
    WHERE revision_id IS NOT NULL AND parent_activity_id IS NULL AND status <> 'CANCELLED';
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_activity_document_pending ON training_activities (document_id)
    WHERE document_id IS NOT NULL AND revision_id IS NULL AND parent_activity_id IS NULL AND status <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS ix_training_activities_dept_year ON training_activities (organizer_department_id, year, serial);
CREATE INDEX IF NOT EXISTS ix_training_activities_status_due ON training_activities (status, due_date);
CREATE INDEX IF NOT EXISTS ix_training_activities_document ON training_activities (document_id);

-- Append-only business events (postponement, reasons, number issued and cancelled). The Audit Trail still records every change.
CREATE TABLE IF NOT EXISTS training_events (
    id            UUID PRIMARY KEY,
    object_type   VARCHAR(40) NOT NULL,
    object_id     UUID NOT NULL,
    activity_id   UUID,
    event_type    VARCHAR(50) NOT NULL,
    payload       JSONB,
    actor_user_id UUID REFERENCES app_users(id),
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_events_activity ON training_events (activity_id, occurred_at);

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 4. Who handles a review, approval or confirmation step (designated by whoever submits; any eligible user)
-- ---------------------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_approval_assignments (
    id               UUID PRIMARY KEY,
    object_type      VARCHAR(40) NOT NULL,
    object_id        UUID NOT NULL,
    step_code        VARCHAR(40) NOT NULL,
    assignee_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    assigned_by      UUID REFERENCES app_users(id),
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status           VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','REASSIGNED','CANCELLED')),
    completed_at     TIMESTAMPTZ,
    signature_id     UUID,
    reason           TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_approval_pending ON training_approval_assignments (object_type, object_id, step_code, assignee_user_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS ix_training_approval_assignee ON training_approval_assignments (assignee_user_id, status);

CREATE TABLE IF NOT EXISTS training_default_approvers (
    id            UUID PRIMARY KEY,
    step_code     VARCHAR(40) NOT NULL,
    department_id UUID REFERENCES departments(id),
    user_id       UUID NOT NULL REFERENCES app_users(id),
    valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to      DATE,
    created_by    UUID REFERENCES app_users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_approval_modes (
    step_code        VARCHAR(40) PRIMARY KEY,
    designation_mode VARCHAR(20) NOT NULL DEFAULT 'DESIGNATED_REQUIRED' CHECK (designation_mode IN ('DESIGNATED_REQUIRED','ANY_ELIGIBLE')),
    version          INTEGER NOT NULL DEFAULT 1,
    updated_by       UUID REFERENCES app_users(id),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO training_approval_modes (step_code, designation_mode) VALUES
    ('MATRIX_APPROVE','DESIGNATED_REQUIRED'),('REQUIREMENT_REVIEW','DESIGNATED_REQUIRED'),('REQUIREMENT_APPROVE','DESIGNATED_REQUIRED'),
    ('CONTENT_REVIEW','DESIGNATED_REQUIRED'),('CONTENT_APPROVE','DESIGNATED_REQUIRED'),('ACTIVITY_COMPLETE','ANY_ELIGIBLE'),
    ('JOB_ASSIGN_SIGN','DESIGNATED_REQUIRED'),('SPECIMEN_CONFIRM','DESIGNATED_REQUIRED'),('RECORD_EXPORT_APPROVE','DESIGNATED_REQUIRED'),
    ('RECORD_VOID','DESIGNATED_REQUIRED'),('TRAINER_EXCEPTION','DESIGNATED_REQUIRED'),('JOB_ASSIGN_EXCEPTION','DESIGNATED_REQUIRED')
ON CONFLICT (step_code) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 5. Document Control side: four columns on the revision
-- ---------------------------------------------------------------------------------------------------------------------------------------------
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS training_activity_id UUID;
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS training_number VARCHAR(40);
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS training_mode VARCHAR(12);
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS training_origin VARCHAR(20) NOT NULL DEFAULT 'NATIVE';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_revision_training_mode') THEN
        ALTER TABLE document_revisions ADD CONSTRAINT ck_revision_training_mode CHECK (training_mode IS NULL OR training_mode IN ('INTEGRATED','MANUAL'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_revision_training_origin') THEN
        ALTER TABLE document_revisions ADD CONSTRAINT ck_revision_training_origin CHECK (training_origin IN ('NATIVE','LEGACY_IMPORT'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_revision_training_activity') THEN
        ALTER TABLE document_revisions ADD CONSTRAINT fk_revision_training_activity FOREIGN KEY (training_activity_id) REFERENCES training_activities(id) ON DELETE RESTRICT;
    END IF;
    -- a revision never has both an activity and the manual mode
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_revision_training_mode_consistent') THEN
        ALTER TABLE document_revisions ADD CONSTRAINT ck_revision_training_mode_consistent
            CHECK (training_activity_id IS NULL OR training_mode IS DISTINCT FROM 'MANUAL');
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_document_revisions_training_activity ON document_revisions (training_activity_id) WHERE training_activity_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 6. Immutability of evidence tables (same pattern as the audit trail, V245)
-- ---------------------------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION training_prevent_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Training records are immutable and cannot be %. (table: %)', TG_OP, TG_TABLE_NAME USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_training_events_immutable_row ON training_events;
CREATE TRIGGER trg_training_events_immutable_row BEFORE UPDATE OR DELETE ON training_events FOR EACH ROW EXECUTE FUNCTION training_prevent_mutation();
DROP TRIGGER IF EXISTS trg_training_events_immutable_stmt ON training_events;
CREATE TRIGGER trg_training_events_immutable_stmt BEFORE TRUNCATE ON training_events FOR EACH STATEMENT EXECUTE FUNCTION training_prevent_mutation();

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 7. Permissions (granted to nobody here) and electronic-signature meanings
-- ---------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), v.code, v.name, 'Training Management', 'training', v.grp, v.descr, v.ord, v.audit
FROM (VALUES
 ('training.scope.all',                      'Access Training of All Departments',  'training_self',      'Let the other Training permissions apply to every department, not only the own one.', 199, TRUE),
 ('training.self.view',                      'View My Training',                    'training_self',      'See and confirm my own training and my own training records.', 200, FALSE),
 ('training.matrix.view',                    'View Training Matrices',              'training_matrix',    'See training matrices.', 210, FALSE),
 ('training.matrix.manage',                  'Manage Training Matrices',            'training_matrix',    'Prepare, edit, submit and upgrade a training matrix.', 211, TRUE),
 ('training.matrix.approve',                 'Approve Training Matrices',           'training_matrix',    'Approve or reject a training matrix when designated. Not the person who prepared it.', 212, TRUE),
 ('training.requirement.view',               'View Training Requirements',          'training_requirement','See training requirements.', 220, FALSE),
 ('training.requirement.prepare',            'Prepare Training Requirements',       'training_requirement','Prepare and submit a training requirement and postpone its lines.', 221, TRUE),
 ('training.requirement.review',             'Review Training Requirements',        'training_requirement','Review a training requirement when designated.', 222, TRUE),
 ('training.requirement.approve',            'Approve Training Requirements',       'training_requirement','Approve a training requirement when designated.', 223, TRUE),
 ('training.code.allocate',                  'Allocate Training Numbers',           'training_activity',  'Create initial and periodic training activities and issue their training numbers.', 230, TRUE),
 ('training.activity.view',                  'View Training Activities',            'training_activity',  'See training activities.', 231, FALSE),
 ('training.activity.organize',              'Organize Training Activities',        'training_activity',  'Create, plan, notify, postpone and cancel training activities of a department.', 232, TRUE),
 ('training.activity.conduct',               'Conduct Training',                    'training_activity',  'Hold sessions, record attendance and confirm attendance as trainer.', 233, TRUE),
 ('training.assessment.record',              'Record Training Assessments',         'training_activity',  'Record the assessment of trainees.', 234, TRUE),
 ('training.activity.close',                 'Confirm Training Completion',         'training_activity',  'Confirm that a training activity is completed (document control officer of QA).', 235, TRUE),
 ('training.document_impact.manage',         'Assess Document Training Impact',     'training_activity',  'Choose the positions to be trained on a new or upgraded document.', 236, TRUE),
 ('training.content.review',                 'Review Training Content',             'training_activity',  'Review training content and tests when designated.', 237, TRUE),
 ('training.content.approve',                'Approve Training Content',            'training_activity',  'Approve training content and tests when designated.', 238, TRUE),
 ('training.trainer.exception.approve',      'Approve Trainer Exceptions',          'training_activity',  'Approve a trainer who does not meet the trainer requirements.', 239, TRUE),
 ('training.approval.designate',             'Designate Approvers',                 'training_approval',  'Designate or change the person who handles a review or approval step.', 240, TRUE),
 ('training.approval.reassign',              'Reassign Approvers',                  'training_approval',  'Reassign a review or approval step to another eligible person, with a reason.', 241, TRUE),
 ('training.record.view',                    'View Training Records',               'training_record',    'See training records of people in scope.', 250, FALSE),
 ('training.record.export',                  'Export Training Records',             'training_record',    'Export a personal training record as PDF.', 251, TRUE),
 ('training.record.void',                    'Void Training Records',               'training_record',    'Void a training record line with a reason and a signature.', 252, TRUE),
 ('training.job_assignment.view',            'View Job Assignments',                'training_job',       'See job assignments.', 260, FALSE),
 ('training.job_assignment.manage',          'Manage Job Assignments',              'training_job',       'Prepare and sign job assignments and create training for a transfer.', 261, TRUE),
 ('training.job_assignment.exception.approve','Approve Job Assignment Exceptions',  'training_job',       'Approve a job assignment made before the training matrix is complete.', 262, TRUE),
 ('training.signature.view',                 'View Specimen Signatures',            'training_signature', 'See specimen signatures.', 270, FALSE),
 ('training.signature.manage',               'Manage Specimen Signatures',          'training_signature', 'Upload a specimen signature.', 271, TRUE),
 ('training.signature.confirm',              'Confirm Specimen Signatures',         'training_signature', 'Confirm a specimen signature when designated.', 272, TRUE),
 ('training.compliance.view',                'View Training Compliance',            'training_compliance','See coverage, overdue training and the training number log.', 280, FALSE),
 ('training.settings.view',                  'View Training Properties',            'training_admin',     'See the settings of Training Management.', 290, FALSE),
 ('training.settings.manage',                'Manage Training Properties',          'training_admin',     'Change the settings of Training Management.', 291, TRUE),
 ('training.admin.manage',                   'Administer Training',                 'training_admin',     'Manage topics, position mapping and background jobs.', 292, TRUE),
 ('training.audit.view',                     'View Training Audit Trail',           'training_admin',     'See the Audit Trail of Training.', 293, FALSE)
) AS v(code, name, grp, descr, ord, audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES
 ('TRAINING_MATRIX_PREPARED',          'Training Matrix Prepared',          'The person confirms the training matrix was prepared.', 400),
 ('TRAINING_MATRIX_APPROVED',          'Training Matrix Approved',          'The person approves the training matrix.', 401),
 ('TRAINING_REQUIREMENT_PREPARED',     'Training Requirement Prepared',     'The person confirms the training requirement was prepared.', 402),
 ('TRAINING_REQUIREMENT_REVIEWED',     'Training Requirement Reviewed',     'The person confirms the training requirement was reviewed.', 403),
 ('TRAINING_REQUIREMENT_APPROVED',     'Training Requirement Approved',     'The person approves the training requirement.', 404),
 ('TRAINING_LIST_VERIFIED',            'Attendance List Verified',          'The person verified the trainees and topics before the training.', 405),
 ('TRAINING_CONTENT_REVIEWED',         'Training Content Reviewed',         'The person reviewed the training content and test.', 406),
 ('TRAINING_CONTENT_APPROVED',         'Training Content Approved',         'The person approved the training content and test.', 407),
 ('TRAINING_ATTENDANCE_CONFIRMED',     'Attendance Confirmed by Trainer',   'The trainer confirms the trainees attended the sessions.', 408),
 ('TRAINING_ATTENDED',                 'Training Attended',                 'The trainee confirms attending the training.', 409),
 ('TRAINING_ASSESSMENT_SIGNED',        'Assessment Signed',                 'The trainee signs the assessment.', 410),
 ('TRAINING_READ_CONFIRMED',           'Self-reading Confirmed',            'The employee confirms having read and understood the document.', 411),
 ('TRAINING_READ_VERIFIED',            'Self-reading Verified',             'The head of department verifies the self-reading.', 412),
 ('TRAINING_COMPLETED',                'Training Completed',                'The person confirms the training activity is completed.', 413),
 ('TRAINING_RECORD_VOIDED',            'Training Record Voided',            'The person voids a training record line.', 414),
 ('TRAINING_RECORD_PREPARED',          'Training Record Prepared',          'The person prepared the personal training record.', 415),
 ('TRAINING_RECORD_APPROVED',          'Training Record Approved',          'The person approves the personal training record.', 416),
 ('TRAINING_JOB_ASSIGNED',             'Job Assigned',                      'The person assigns the job.', 417),
 ('TRAINING_JOB_ACCEPTED',             'Job Accepted',                      'The employee accepts the job assignment.', 418),
 ('TRAINING_SPECIMEN_APPROVED',        'Specimen Signature Approved',       'The head of department confirms the specimen signature.', 419),
 ('TRAINING_TRAINER_EXCEPTION_APPROVED','Trainer Exception Approved',       'The person approves a trainer exception.', 420),
 ('TRAINING_JOB_EXCEPTION_APPROVED',   'Job Assignment Exception Approved', 'The person approves a job assignment exception.', 421),
 ('TRAINING_SETTINGS_CHANGED',         'Training Settings Changed',         'The person changes the settings of Training Management.', 422)
) AS v(code, name, descr, ord)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
