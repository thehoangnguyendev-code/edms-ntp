-- Permission catalog forensic review (2026-08-24) found several drifted/dangling references.
-- This migration fixes the concrete, low-risk items; none of them change any existing grant
-- (role_permissions/permission_set_items rows are untouched).

-- 1) V170 seeded a Segregation-of-Duties constraint referencing 'documents.revision.submit',
-- a code that was never actually seeded in the permissions catalog (the real code is
-- 'documents.revision.submit_review', seeded V156). The constraint has been silently inert
-- since V170 -- it can never match any real permission grant. Point it at the real code.
UPDATE sod_constraints
SET permission_code_a = 'documents.revision.submit_review',
    updated_at = now()
WHERE permission_code_a = 'documents.revision.submit'
  AND permission_code_b = 'documents.document.obsolete'
  AND NOT EXISTS (
      SELECT 1 FROM sod_constraints existing
      WHERE existing.permission_code_a = 'documents.revision.submit_review'
        AND existing.permission_code_b = 'documents.document.obsolete'
  );

-- 2) V359 seeded the (currently inactive) REVISION_LIFECYCLE report definition with
-- access_policy referencing 'documents.revision.view', a code that has never existed in the
-- permissions catalog (the real code is 'documents.revision.preview'). Fix before this report
-- definition is ever activated -- otherwise no one could ever pass its access check.
UPDATE report_definitions
SET access_policy = '{"permission":"documents.revision.preview"}'::jsonb,
    updated_at = now()
WHERE code = 'REVISION_LIFECYCLE'
  AND access_policy = '{"permission":"documents.revision.view"}'::jsonb;

-- 3) 'documents.document.view_all' was independently seeded by two migrations (V248, then
-- V278 as a WHERE-NOT-EXISTS no-op since V248 already ran first) with two different
-- name/group_key/description/display_order values. V278's values reflect the later, deliberate
-- "document_control_access" grouping used by its sibling permissions -- normalize the live row
-- to that intended shape. This only updates descriptive columns; no grant is affected.
UPDATE permissions
SET name = 'View All Document Records',
    group_key = 'document_control_access',
    description = 'View all document masters and revisions regardless of ownership, workflow participation, business unit, or department. This permission is read-only.',
    display_order = 778
WHERE code = 'documents.document.view_all';

-- 4) 'documents.document.view_audit' description (V171) still reads as if this permission is
-- the primary/blanket gate for a Document/Revision's Audit Trail tab. Since the HDR-AUTH-001
-- authorization change (AuditTrailService.requireEntityAuditView), a direct stakeholder
-- (Author, Co-author, Reviewer/Approver, Admin/DCO) sees the tab automatically without this
-- permission -- it is now only consulted as a fallback for indirect/broad viewers. Update the
-- description so it no longer misleads an Admin configuring access.
UPDATE permissions
SET description = 'View the Audit Trail tab for a document or revision. Direct stakeholders (Author, Co-author, Reviewer/Approver, Admin/DCO) see it automatically without this permission; it is only required for indirect/broad viewers.'
WHERE code = 'documents.document.view_audit';
