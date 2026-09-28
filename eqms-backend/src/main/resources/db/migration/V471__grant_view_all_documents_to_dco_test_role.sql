-- DCO must be able to see every Document, not just ones they authored or participate in --
-- DocumentAuthorizationService.canViewAllDocuments() (used across the Document list, Audit
-- Trail visibility, etc.) is gated specifically by documents.document.view_all (or a handful of
-- admin-only permissions), which PS_DCO_TEST never granted. The base documents.document.view it
-- already had only shows terminal-status documents when strict participant visibility is on --
-- not the blanket "see everything" access a real DCO needs.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'documents.document.view_all'
WHERE ps.code = 'PS_DCO_TEST'
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
  );
