-- Report Platform: immutable, asynchronously generated report snapshots.
CREATE TABLE IF NOT EXISTS report_definitions (
    code VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(80) NOT NULL,
    classification VARCHAR(40) NOT NULL DEFAULT 'INTERNAL',
    active BOOLEAN NOT NULL DEFAULT FALSE,
    definition_version INTEGER NOT NULL DEFAULT 1,
    allowed_formats JSONB NOT NULL DEFAULT '["CSV"]'::jsonb,
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    access_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    retention_policy_id UUID NULL REFERENCES retention_policies(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_definition_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_code VARCHAR(100) NOT NULL REFERENCES report_definitions(code) ON DELETE CASCADE,
    field_code VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    field_type VARCHAR(40) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    default_selected BOOLEAN NOT NULL DEFAULT FALSE,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(definition_code, field_code)
);

CREATE TABLE IF NOT EXISTS report_definition_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_code VARCHAR(100) NOT NULL REFERENCES report_definitions(code),
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    reason TEXT NOT NULL,
    changed_by_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(definition_code, version)
);

CREATE TABLE IF NOT EXISTS report_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_code VARCHAR(100) NOT NULL REFERENCES report_definitions(code),
    definition_version INTEGER NOT NULL,
    requester_user_id UUID NOT NULL REFERENCES app_users(id),
    request_type VARCHAR(30) NOT NULL,
    requested_format VARCHAR(12) NOT NULL DEFAULT 'CSV',
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    selected_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_spec JSONB NOT NULL DEFAULT '[]'::jsonb,
    authorization_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    as_of_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    progress INTEGER NOT NULL DEFAULT 0,
    reason_code VARCHAR(80),
    error_message TEXT,
    idempotency_key VARCHAR(160),
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_until TIMESTAMPTZ,
    UNIQUE(requester_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS report_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
    format VARCHAR(12) NOT NULL,
    generated_filename VARCHAR(255) NOT NULL,
    provider VARCHAR(40) NOT NULL,
    bucket VARCHAR(255), object_key TEXT NOT NULL, object_version VARCHAR(255),
    mime_type VARCHAR(120) NOT NULL, byte_size BIGINT NOT NULL, sha256 CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ, legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(run_id, format)
);

CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), definition_code VARCHAR(100) NOT NULL REFERENCES report_definitions(code),
    creator_user_id UUID NOT NULL REFERENCES app_users(id), name VARCHAR(255) NOT NULL, cron_expression VARCHAR(120) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb, selected_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    authorization_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, active BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(60) NOT NULL DEFAULT 'ACTIVE', next_run_at TIMESTAMPTZ, last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS report_schedule_recipients (
    schedule_id UUID NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id), PRIMARY KEY(schedule_id, user_id)
);
CREATE TABLE IF NOT EXISTS report_delivery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id UUID REFERENCES report_artifacts(id), recipient_user_id UUID REFERENCES app_users(id),
    status VARCHAR(40) NOT NULL, reason_code VARCHAR(80), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS report_run_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), run_id UUID NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
    event_type VARCHAR(80) NOT NULL, reason_code VARCHAR(80), detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_runs_claim ON report_runs(status, next_attempt_at, queued_at);
CREATE INDEX IF NOT EXISTS idx_report_runs_history ON report_runs(requester_user_id, definition_code, status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_schedules_claim ON report_schedules(active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_artifacts_expiry ON report_artifacts(expires_at) WHERE legal_hold = FALSE;

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit) VALUES
('75900000-0000-0000-0000-000000000001','reports.catalog.view','View Report Catalog','Reporting','report','report_platform','View report definitions available to the current scope.',171,FALSE),
('75900000-0000-0000-0000-000000000002','reports.run.create','Generate Reports','Reporting','report','report_platform','Queue a report generation request.',172,TRUE),
('75900000-0000-0000-0000-000000000003','reports.run.view_own','View Own Report History','Reporting','report','report_platform','View own report runs and artifacts.',173,FALSE),
('75900000-0000-0000-0000-000000000004','reports.run.view_all','View All Report History','Reporting','report','report_platform','View report runs for all users.',174,FALSE),
('75900000-0000-0000-0000-000000000005','reports.artifact.download','Download Report Artifacts','Reporting','report','report_platform','Download authorized immutable report artifacts.',175,TRUE),
('75900000-0000-0000-0000-000000000006','reports.schedule.view','View Scheduled Reports','Reporting','report','report_platform','View report schedules.',176,FALSE),
('75900000-0000-0000-0000-000000000007','reports.schedule.manage','Manage Scheduled Reports','Reporting','report','report_platform','Create, change, pause and resume report schedules.',177,TRUE),
('75900000-0000-0000-0000-000000000008','reports.definition.view','View Report Configuration','Reporting','settings','report_configuration','View controlled report definitions.',178,FALSE),
('75900000-0000-0000-0000-000000000009','reports.definition.manage','Manage Report Configuration','Reporting','settings','report_configuration','Change controlled report configuration.',179,TRUE),
('75900000-0000-0000-0000-000000000010','reports.retention.manage','Manage Report Retention','Reporting','settings','report_configuration','Manage report artifact retention and legal holds.',180,TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO report_definitions(code, display_name, description, category, classification, active, allowed_formats, limits, access_policy) VALUES
('DOCUMENT_STATUS','Document Status Report','Authorized document master snapshot.','DOCUMENT','REGULATED',TRUE,'["PDF","XLSX","CSV"]','{"maxRows":10000,"maxDateRangeDays":366,"maxArtifactBytes":52428800}','{"permission":"documents.document.view"}'),
('REVISION_LIFECYCLE','Revision Lifecycle Report','Authorized revision lifecycle and version history snapshot.','DOCUMENT','REGULATED',FALSE,'["CSV"]','{"maxRows":10000,"maxDateRangeDays":366,"maxArtifactBytes":52428800}','{"permission":"documents.revision.view"}'),
('AUDIT_TRAIL_EXTRACT','Audit Trail Extract','Authorized audit-trail extract.','AUDIT','REGULATED',FALSE,'["CSV"]','{"maxRows":50000,"maxDateRangeDays":93,"maxArtifactBytes":52428800}','{"permission":"audit.view"}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO report_definition_fields(definition_code,field_code,display_name,field_type,allowed,default_selected,required,display_order) VALUES
('DOCUMENT_STATUS','documentNumber','Document Number','TEXT',TRUE,TRUE,TRUE,10),('DOCUMENT_STATUS','documentName','Document Title','TEXT',TRUE,TRUE,TRUE,20),('DOCUMENT_STATUS','status','Status','TEXT',TRUE,TRUE,FALSE,30),('DOCUMENT_STATUS','department','Department','TEXT',TRUE,TRUE,FALSE,40),('DOCUMENT_STATUS','businessUnit','Business Unit','TEXT',TRUE,TRUE,FALSE,50),('DOCUMENT_STATUS','effectiveDate','Effective Date','DATE',TRUE,FALSE,FALSE,60),
('REVISION_LIFECYCLE','documentNumber','Document Number','TEXT',TRUE,TRUE,TRUE,10),('REVISION_LIFECYCLE','revisionNumber','Revision','TEXT',TRUE,TRUE,TRUE,20),('REVISION_LIFECYCLE','status','Status','TEXT',TRUE,TRUE,FALSE,30),('REVISION_LIFECYCLE','updatedAt','Updated At','DATETIME',TRUE,TRUE,FALSE,40),
('AUDIT_TRAIL_EXTRACT','timestamp','Timestamp','DATETIME',TRUE,TRUE,TRUE,10),('AUDIT_TRAIL_EXTRACT','actor','Actor','TEXT',TRUE,TRUE,TRUE,20),('AUDIT_TRAIL_EXTRACT','module','Module','TEXT',TRUE,TRUE,FALSE,30),('AUDIT_TRAIL_EXTRACT','action','Action','TEXT',TRUE,TRUE,FALSE,40),('AUDIT_TRAIL_EXTRACT','entity','Entity','TEXT',TRUE,TRUE,FALSE,50)
ON CONFLICT (definition_code,field_code) DO NOTHING;
