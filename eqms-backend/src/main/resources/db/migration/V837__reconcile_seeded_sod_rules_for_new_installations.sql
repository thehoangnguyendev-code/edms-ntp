-- V837: the Segregation of Duties rules a NEW installation starts with (DEC-AUTHZ-2026-11-21-02).
--
-- Found on 2026-11-21 by building the database from nothing and running the backend suite (PermissionReferentialIntegrityTest):
--   1. Rules seeded by V152 and V38 still name permissions that were retired later (documents.revision.submit, settings.role.manage). A rule over a permission that does not exist
--      can never fire, so it protects nothing and only looks like a control.
--   2. The rule "a person who can submit a Revision for review cannot also approve it" (documents.revision.submit_review against documents.revision.approve), which the Document
--      Control workflow depends on, was created by hand on DEV and has no migration, so a new installation did not have it.
-- This migration makes the two cases right and does nothing on a database that is already right (DEV had no rule of case 1 and has the rule of case 2).
--
-- Not decided here (owner / QA): which pair, if any, replaces "Manage Users vs Manage Roles" now that settings.role.manage is retired, and whether the other rules that only a new
-- installation has (Request vs Distribute Controlled Copy, Submit Revision vs Obsolete Document) are wanted. They are listed in the Decision Log.

-- 1. A rule over a permission that is not in the catalogue can never apply.
DELETE FROM sod_constraints s
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = s.permission_code_a)
   OR NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = s.permission_code_b);

-- 2. The two Document Control pairs of the approval chain, same wording and severity as on DEV; each is added only when the pair is not there yet, in either order.
INSERT INTO sod_constraints (name, description, permission_code_a, permission_code_b, severity, regulation_ref, active, system)
SELECT v.name, v.description, v.a, v.b, 'BLOCK', v.ref, true, true
FROM (VALUES
    ('Document Submitter versus Approver', 'A user who can submit a Revision for review cannot also approve it.',
     'documents.revision.submit_review', 'documents.revision.approve', 'EU-GMP Chapter 4; 21 CFR 211.68(b)'),
    ('Document Reviewer versus Approver', 'A Reviewer cannot also approve a Revision.',
     'documents.revision.review', 'documents.revision.approve', 'EU GMP Annex 11 12.1')
) AS v(name, description, a, b, ref)
WHERE EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.a)
  AND EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.b)
  AND NOT EXISTS (
      SELECT 1 FROM sod_constraints s
      WHERE (s.permission_code_a = v.a AND s.permission_code_b = v.b)
         OR (s.permission_code_a = v.b AND s.permission_code_b = v.a)
  );
