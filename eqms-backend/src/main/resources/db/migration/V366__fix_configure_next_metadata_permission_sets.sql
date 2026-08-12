-- V365 only granted documents.document.configure_next_metadata to 2 of the 7 permission sets that
-- already hold documents.revision.configure_next_reviewers (the sibling "configure next revision"
-- permission this one is modeled after). Missed sets: Administrator managed permissions,
-- DCO managed permissions, Document Controller managed permissions, Document Security
-- Administrator, System Administration -- verified by reproducing with dco.lead2 (role "DCO",
-- permission set "DCO managed permissions"), whose manageReviewCycle capability incorrectly
-- came back false while configureNextReviewers correctly came back true.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps, permissions p
WHERE ps.name IN (
    'Administrator managed permissions',
    'DCO managed permissions',
    'Document Controller managed permissions',
    'Document Security Administrator',
    'System Administration'
)
  AND p.code = 'documents.document.configure_next_metadata'
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items psi2
      WHERE psi2.permission_set_id = ps.id AND psi2.permission_id = p.id
  );
