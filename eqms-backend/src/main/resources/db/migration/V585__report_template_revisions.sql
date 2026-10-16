-- REPORT-TEMPLATE-REVISION-2026-10-14: a report template is managed in numbered revisions, as a document is. Forward-only, idempotent.
--
-- The live rows of a template (report_definitions and its field and scope tables) always hold the EFFECTIVE revision, which is the only one that
-- runs. A revision that is being written after that (DRAFT or PENDING_APPROVAL) lives in report_template_revisions.snapshot until it is approved;
-- approving it replaces the live rows and makes the earlier effective revision SUPERSEDED. A template that was never approved has one revision whose
-- content is still in the live rows (snapshot is null). Released revisions keep their full content for ever.

CREATE TABLE IF NOT EXISTS report_template_revisions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_code       varchar(100) NOT NULL REFERENCES report_definitions(code),
    revision              integer      NOT NULL CHECK (revision >= 1),
    status                varchar(30)  NOT NULL CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'EFFECTIVE', 'SUPERSEDED')),
    snapshot              jsonb,
    draft_version         integer      NOT NULL DEFAULT 1,
    base_version          integer,
    definition_version    integer,
    change_reason         text,
    created_by_user_id    uuid REFERENCES app_users(id),
    created_at            timestamptz  NOT NULL DEFAULT now(),
    last_changed_by_user_id uuid REFERENCES app_users(id),
    last_changed_at       timestamptz  NOT NULL DEFAULT now(),
    submitted_by_user_id  uuid REFERENCES app_users(id),
    submitted_at          timestamptz,
    approved_by_user_id   uuid REFERENCES app_users(id),
    approved_at           timestamptz,
    approval_signature_id varchar(64),
    approval_comment      text,
    effective_at          timestamptz,
    superseded_at         timestamptz,
    superseded_by_revision integer,
    UNIQUE (definition_code, revision)
);

-- One revision being written and one effective revision at a time, per template.
CREATE UNIQUE INDEX IF NOT EXISTS ux_report_template_revisions_open
    ON report_template_revisions (definition_code) WHERE status IN ('DRAFT', 'PENDING_APPROVAL');
CREATE UNIQUE INDEX IF NOT EXISTS ux_report_template_revisions_effective
    ON report_template_revisions (definition_code) WHERE status = 'EFFECTIVE';

-- A template that is approved now: its approved version becomes Revision 1, effective, with the content it had when it was approved.
INSERT INTO report_template_revisions (definition_code, revision, status, snapshot, definition_version, change_reason,
                                       created_by_user_id, last_changed_by_user_id, approved_by_user_id, approved_at, approval_signature_id, effective_at)
SELECT d.code, 1, 'EFFECTIVE', v.snapshot, d.approved_version, v.reason,
       v.changed_by_user_id, v.changed_by_user_id, d.approved_by_user_id, d.approved_at, d.approval_signature_id, COALESCE(d.approved_at, d.updated_at)
  FROM report_definitions d
  LEFT JOIN report_definition_versions v ON v.definition_code = d.code AND v.version = d.approved_version
 WHERE d.source_code IS NOT NULL AND d.approval_status = 'APPROVED' AND d.approved_version IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM report_template_revisions r WHERE r.definition_code = d.code);

-- A template that is not approved yet: Revision 1, still being written (its content is in the live rows).
INSERT INTO report_template_revisions (definition_code, revision, status, snapshot, draft_version, change_reason,
                                       created_by_user_id, last_changed_by_user_id, submitted_by_user_id, submitted_at)
SELECT d.code, 1, CASE WHEN d.approval_status = 'PENDING_APPROVAL' THEN 'PENDING_APPROVAL' ELSE 'DRAFT' END, NULL, 1,
       (SELECT v.reason FROM report_definition_versions v WHERE v.definition_code = d.code ORDER BY v.version DESC LIMIT 1),
       (SELECT v.changed_by_user_id FROM report_definition_versions v WHERE v.definition_code = d.code ORDER BY v.version ASC LIMIT 1),
       (SELECT v.changed_by_user_id FROM report_definition_versions v WHERE v.definition_code = d.code ORDER BY v.version DESC LIMIT 1),
       d.submitted_by_user_id, d.submitted_at
  FROM report_definitions d
 WHERE d.source_code IS NOT NULL AND COALESCE(d.approval_status, 'DRAFT') <> 'APPROVED'
   AND NOT EXISTS (SELECT 1 FROM report_template_revisions r WHERE r.definition_code = d.code);
