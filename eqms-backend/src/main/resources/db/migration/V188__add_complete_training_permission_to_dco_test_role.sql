-- RevisionService.completeTraining() enforces a SECOND, separate authorization gate beyond the
-- workflow-action permission check already covered by the action-capabilities matrix:
-- TrainingAuthorizationService.requireCanCompleteRevisionTraining() requires one of
-- documents.training.complete / documents.training.manage / training.material.manage.
-- DCO_LEGACY already has documents.training.complete + documents.training.manage, confirming DCO
-- is meant to be able to complete training, but PS_DCO_TEST (new catalog test role) was missing
-- both — so the "Complete Training" button showed (capability check passed) but submitting it
-- would have failed with "Current user is not allowed to complete revision training".

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('documents.training.complete', 'documents.training.manage')
WHERE ps.code = 'PS_DCO_TEST'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
