-- V544: Executed Records are now only the scan of a returned paper Controlled Copy (owner decision 2026-10-07):
-- the DCO's one e-signature on the recall, with its attestation, is the control, so a record is Executed as soon as it is
-- filed. The approve/reject step (a leftover of the retired eForm design) and its two permissions are removed.
--
-- 1. A record still waiting for approval (data from before this change) becomes Executed.
UPDATE executed_records SET status = 'EXECUTED' WHERE status IN ('PENDING_APPROVAL', 'SUBMITTED');

-- 2. The two permissions go; Permission Set grants follow by cascade (exported to backups/ beforehand).
DELETE FROM permission_dependencies
WHERE permission_code IN ('documents.form.approve_executed_record', 'documents.form.reject_executed_record')
   OR depends_on_code IN ('documents.form.approve_executed_record', 'documents.form.reject_executed_record');
DELETE FROM permissions
WHERE code IN ('documents.form.approve_executed_record', 'documents.form.reject_executed_record');
