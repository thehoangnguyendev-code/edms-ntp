-- V745: Document Control visibility (Decision DC-VISIBILITY-TIERS-2026-11-07).
--
-- Two ways to see Document Control records: a person with a name in the flow sees exactly that; a person given the view-everything
-- bundle sees all of it. Operations (publish, distribute, recall...) are separate permissions and are not touched here.
--
-- 1. The bundle is the existing set PS_DOCUMENT_VIEW_ALL (V248, kept for DCO by V542). It holds the three view-all permissions and gets the
--    four base "view" permissions, so attaching it alone to an Access Profile is enough. Its effective access for the profile that already
--    uses it (UAT DCO - Quality) does not change: that profile has the base permissions from other sets.
-- 2. Uncontrolled Copy view-all is withdrawn from the sets whose profiles do not hold the Document view-all (V540 had given it to every set
--    that could approve/reject/distribute). Approvers keep seeing the requests waiting for them (UncontrolledCopyService).
-- 3. Records become "whoever holds the permission sees them all". documents.form.view_executed_records is withdrawn from the sets that gave it
--    to profiles that are neither DCO nor Administrator; it is given to ROLE_DOCUMENT_CONTROLLER, which had it only through the shared
--    requester set. The DCO, Administrator and Admin-without-maintenance-bypass profiles keep it through their own sets.
-- By set code and idempotent, so a database without these sets is unaffected. The removed rows can be put back by inserting them again.

-- (1) the bundle
UPDATE permission_sets
SET name = 'Document Control - View Everything',
    description = 'See every Document, Revision (drafts included), Controlled Copy and Uncontrolled Copy. Acting still needs a name in the flow or the operational permission.',
    updated_at = now()
WHERE code = 'PS_DOCUMENT_VIEW_ALL';

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), permission_set.id, permission.id
FROM permission_sets permission_set
JOIN permissions permission ON permission.code IN (
    'documents.module.view',
    'documents.document.view',
    'documents.controlled_copy.view',
    'documents.uncontrolled_copy.view')
WHERE permission_set.code = 'PS_DOCUMENT_VIEW_ALL'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- (2) Uncontrolled Copy view-all: the sets of Approver Lead, Approver Test, Quality and the UAT approver/contributor profiles
DELETE FROM permission_set_items item
USING permission_sets permission_set, permissions permission
WHERE item.permission_set_id = permission_set.id
  AND item.permission_id = permission.id
  AND permission_set.code IN (
      'ROLE_APPROVER_LEAD',
      'PS_APPROVER_TEST',
      'ROLE_QUALITY',
      'PS_DOCUMENT_APPROVER',
      'PS_UAT_DOCUMENT_APPROVER',
      'PS_UAT_DOCUMENT_CONTRIBUTOR'
  )
  AND permission.code = 'documents.uncontrolled_copy.view_all';

-- (3) Records: keep the Document Controller profile, then withdraw from everyone else
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), permission_set.id, permission.id
FROM permission_sets permission_set
JOIN permissions permission ON permission.code = 'documents.form.view_executed_records'
WHERE permission_set.code = 'ROLE_DOCUMENT_CONTROLLER'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

DELETE FROM permission_set_items item
USING permission_sets permission_set, permissions permission
WHERE item.permission_set_id = permission_set.id
  AND item.permission_id = permission.id
  AND permission_set.code IN (
      'PS_UAT_CONTROLLED_COPY_REQUESTER',
      'PS_APPROVER_TEST',
      'PS_DOCUMENT_SECURITY_ADMIN',
      'PS_UAT_CONTROLLED_COPY_RECIPIENT',
      'PS_DOCUMENT_READER'
  )
  AND permission.code IN (
      'documents.form.view_executed_records',
      'documents.form.download_executed_record'
  );
