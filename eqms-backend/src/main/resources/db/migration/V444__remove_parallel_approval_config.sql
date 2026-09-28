-- The system allows exactly one Approver, so a Parallel Approval option can never differ from
-- Sequential Approval. The switch was removed from Document Properties; drop the stored key.
UPDATE system_configurations
SET documents_config = documents_config - 'parallelApprovalEnabled';
