ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS electronic_signature_applied BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE audit_logs audit
SET user_id = COALESCE(audit.user_id, audit.acted_by_user_id),
    username = COALESCE(audit.username, user_account.username),
    user_full_name = COALESCE(audit.user_full_name, user_account.full_name),
    employee_code = COALESCE(audit.employee_code, user_account.employee_code),
    role_name = COALESCE(audit.role_name, user_account.role_name),
    position_name = COALESCE(audit.position_name, user_account.position),
    department_name = COALESCE(audit.department_name, user_account.department)
FROM app_users user_account
WHERE user_account.id = COALESCE(audit.user_id, audit.acted_by_user_id);

UPDATE audit_logs audit
SET entity_name = COALESCE(audit.entity_name, document.document_name),
    entity_code = COALESCE(audit.entity_code, document.document_number),
    document_number = COALESCE(audit.document_number, document.document_number),
    entity_status = COALESCE(audit.entity_status, document.status_code)
FROM documents document
WHERE replace(upper(audit.entity_type), ' ', '_') = 'DOCUMENT'
  AND document.id = audit.entity_id;

UPDATE audit_logs audit
SET entity_name = COALESCE(audit.entity_name, revision.revision_name),
    entity_code = COALESCE(
        audit.entity_code,
        revision.document_number || CASE
            WHEN revision.revision_number IS NULL THEN ''
            ELSE ' Rev.' || revision.revision_number
        END
    ),
    document_number = COALESCE(audit.document_number, revision.document_number),
    revision_number = COALESCE(audit.revision_number, revision.revision_number),
    entity_status = COALESCE(audit.entity_status, revision.status_code)
FROM document_revisions revision
WHERE replace(upper(audit.entity_type), ' ', '_') = 'REVISION'
  AND revision.id = audit.entity_id;

UPDATE audit_logs audit
SET ip_address = COALESCE(
        audit.ip_address,
        (
            SELECT session.ip_address
            FROM auth_sessions session
            WHERE session.user_id = COALESCE(audit.user_id, audit.acted_by_user_id)
              AND session.created_at <= COALESCE(audit.event_time, audit.created_at) + INTERVAL '1 day'
            ORDER BY ABS(EXTRACT(EPOCH FROM (
                COALESCE(audit.event_time, audit.created_at) - session.last_activity_at
            )))
            LIMIT 1
        )
    ),
    user_agent = COALESCE(
        audit.user_agent,
        (
            SELECT session.user_agent
            FROM auth_sessions session
            WHERE session.user_id = COALESCE(audit.user_id, audit.acted_by_user_id)
              AND session.created_at <= COALESCE(audit.event_time, audit.created_at) + INTERVAL '1 day'
            ORDER BY ABS(EXTRACT(EPOCH FROM (
                COALESCE(audit.event_time, audit.created_at) - session.last_activity_at
            )))
            LIMIT 1
        )
    ),
    device_name = COALESCE(
        audit.device_name,
        (
            SELECT session.device_name
            FROM auth_sessions session
            WHERE session.user_id = COALESCE(audit.user_id, audit.acted_by_user_id)
              AND session.created_at <= COALESCE(audit.event_time, audit.created_at) + INTERVAL '1 day'
            ORDER BY ABS(EXTRACT(EPOCH FROM (
                COALESCE(audit.event_time, audit.created_at) - session.last_activity_at
            )))
            LIMIT 1
        )
    )
WHERE audit.ip_address IS NULL
   OR audit.user_agent IS NULL
   OR audit.device_name IS NULL;

UPDATE audit_logs audit
SET signature_id = participant.signature_session_id
FROM revision_workflow_participants participant
WHERE replace(upper(audit.entity_type), ' ', '_') = 'REVISION'
  AND participant.revision_id = audit.entity_id
  AND participant.user_id = COALESCE(audit.user_id, audit.acted_by_user_id)
  AND participant.signature_session_id IS NOT NULL
  AND audit.signature_id IS NULL
  AND (
      (upper(audit.action_type) IN ('REVIEW_COMPLETE', 'REVIEW_REJECT')
          AND upper(participant.participant_type) = 'REVIEWER')
      OR
      (upper(audit.action_type) IN ('APPROVE_COMPLETE', 'APPROVE_REJECT')
          AND upper(participant.participant_type) = 'APPROVER')
  );

UPDATE audit_logs
SET electronic_signature_applied = TRUE
WHERE signature_id IS NOT NULL
   OR upper(action_type) IN (
       'SUBMIT',
       'SUBMIT_FOR_REVIEW',
       'REVIEW_COMPLETE',
       'REVIEW_REJECT',
       'APPROVE_COMPLETE',
       'APPROVE_REJECT',
       'PUBLISH',
       'OBSOLETE',
       'DISTRIBUTE',
       'RECALL',
       'DESTROY'
   );

CREATE INDEX IF NOT EXISTS idx_audit_logs_electronic_signature
    ON audit_logs (electronic_signature_applied, created_at DESC);

