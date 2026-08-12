-- V224: Remove legacy auth session refresh audit rows.
-- These entries are technical refresh-token churn, not GMP business events.
-- Keep all other audit history intact.

DELETE FROM audit_log_changes
WHERE audit_log_id IN (
    SELECT id
    FROM audit_logs
    WHERE UPPER(entity_type) = 'SESSION'
      AND UPPER(action_type) = 'REFRESH'
);

DELETE FROM audit_logs
WHERE UPPER(entity_type) = 'SESSION'
  AND UPPER(action_type) = 'REFRESH';
