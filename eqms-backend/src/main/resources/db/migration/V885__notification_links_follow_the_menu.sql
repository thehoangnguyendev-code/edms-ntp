-- The sidebar was reorganised: the screens kept their function but some links that notifications already carry no longer open the right screen (the address does not exist,
-- or it is read as the id of a document). Only the address of the link is corrected; the notification itself (title, message, time, status) is untouched.
UPDATE user_notifications SET action_url = CASE
    WHEN action_url IN ('/controlled-copies', '/documents/controlled-copies')            THEN '/documents/controlled-copies/all'
    WHEN action_url = '/uncontrolled-copies'                                              THEN '/documents/uncontrolled-copies/all'
    WHEN action_url IN ('/knowledge', '/documents/knowledge')                             THEN '/documents/knowledge/explorer'
    WHEN action_url = '/security/object-access-rules'                                     THEN '/security/access-profiles'
    WHEN action_url = '/security/workflow-authorization'                                  THEN '/security/lifecycle-policies'
    WHEN action_url = '/settings/administration/backup/restore' OR action_url ~ '^/backup-restore/restores/[A-Za-z0-9-]+$' THEN '/backup-restore/production-restores'
    WHEN action_url = '/training-management/document-trainings'                           THEN '/training-management/document-impact-assessment'
    WHEN action_url = '/documents'                                                        THEN '/documents/all'
    ELSE action_url END
WHERE action_url IN ('/controlled-copies', '/documents/controlled-copies', '/uncontrolled-copies', '/knowledge', '/documents/knowledge', '/security/object-access-rules',
                     '/security/workflow-authorization', '/settings/administration/backup/restore', '/training-management/document-trainings', '/documents')
   OR action_url ~ '^/backup-restore/restores/[A-Za-z0-9-]+$';
