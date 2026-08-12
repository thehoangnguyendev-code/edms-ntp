UPDATE audit_logs
SET electronic_signature_applied = TRUE
WHERE replace(upper(entity_type), ' ', '_') IN ('CONTROLLED_COPY', 'CONTROLLED_COPY_DISTRIBUTION_BATCH')
  AND upper(action_type) IN (
      'APPROVE',
      'PRINT',
      'DISTRIBUTE',
      'RECALL',
      'CANCEL',
      'DESTROY'
  );

