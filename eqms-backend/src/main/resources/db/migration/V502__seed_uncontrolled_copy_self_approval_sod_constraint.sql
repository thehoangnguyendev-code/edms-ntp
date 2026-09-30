-- V502: Segregation of Duties -- the requester of an Uncontrolled Copy must not decide (approve OR reject)
-- their own request. Previously a hard-coded rule in UncontrolledCopyService; now enforced at action time via
-- SodConstraintService.isActiveConstraint(...) so an administrator can deactivate it on the Segregation of
-- Duties screen (e-signed + audited). BLOCK severity = actually enforced (not advisory). system = true: the
-- definition is fixed and the row cannot be deleted, only activated/deactivated.
-- Default active = true preserves the previous always-on behaviour.

INSERT INTO sod_constraints (name, description, permission_code_a, permission_code_b, severity, regulation_ref, active, system)
SELECT
    'Request vs Approve Uncontrolled Copy',
    'The user who requested an uncontrolled copy must not approve or reject their own request. While active, this rule is enforced at the moment of approval/rejection (the requester can still cancel their own request).',
    'documents.uncontrolled_copy.request', 'documents.uncontrolled_copy.approve_request',
    'BLOCK', 'EU-GMP Chapter 4 §4.28 · EU-GMP Annex 11 §12.1 · 21 CFR Part 11 §11.10(g)', true, true
WHERE NOT EXISTS (
    SELECT 1 FROM sod_constraints
    WHERE (permission_code_a = 'documents.uncontrolled_copy.request' AND permission_code_b = 'documents.uncontrolled_copy.approve_request')
       OR (permission_code_a = 'documents.uncontrolled_copy.approve_request' AND permission_code_b = 'documents.uncontrolled_copy.request')
);
