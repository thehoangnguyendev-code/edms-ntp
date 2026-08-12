-- =============================================================================
-- V96: Backfill historical revision metadata from parent documents
--
-- Goals:
--   1. Align legacy document_revisions rows with the parent documents.
--   2. Restore missing author/business unit/department references.
--   3. Recreate missing revision workflow participants from document workflow
--      participants so co-authors/reviewers/approvers render correctly.
-- =============================================================================

UPDATE document_revisions r
SET
    document_number = COALESCE(NULLIF(r.document_number, ''), d.document_number),
    document_name = COALESCE(NULLIF(r.document_name, ''), d.document_name),
    title_local_language = COALESCE(NULLIF(r.title_local_language, ''), d.title_local_language),
    document_type_id = COALESCE(r.document_type_id, d.document_type_id),
    business_unit_id = COALESCE(r.business_unit_id, d.business_unit_id),
    department_id = COALESCE(r.department_id, d.department_id),
    author_user_id = COALESCE(r.author_user_id, d.author_user_id),
    owner_user_id = COALESCE(r.owner_user_id, d.owner_user_id),
    opened_by_user_id = COALESCE(r.opened_by_user_id, d.opened_by_user_id),
    last_modified_by_user_id = COALESCE(r.last_modified_by_user_id, d.last_modified_by_user_id),
    description = COALESCE(NULLIF(r.description, ''), d.description),
    knowledge_base = COALESCE(NULLIF(r.knowledge_base, ''), d.knowledge_base),
    is_template = COALESCE(r.is_template, d.is_template),
    has_related_documents = COALESCE(r.has_related_documents, d.has_related_documents),
    has_correlated_documents = COALESCE(r.has_correlated_documents, d.has_correlated_documents),
    effective_date = COALESCE(r.effective_date, d.effective_date),
    valid_until = COALESCE(r.valid_until, d.valid_until),
    updated_at = NOW()
FROM documents d
WHERE r.document_id = d.id
  AND (
      r.document_number IS DISTINCT FROM d.document_number
      OR r.document_name IS DISTINCT FROM d.document_name
      OR r.title_local_language IS DISTINCT FROM d.title_local_language
      OR r.document_type_id IS DISTINCT FROM d.document_type_id
      OR r.business_unit_id IS DISTINCT FROM d.business_unit_id
      OR r.department_id IS DISTINCT FROM d.department_id
      OR r.author_user_id IS DISTINCT FROM d.author_user_id
      OR r.owner_user_id IS DISTINCT FROM d.owner_user_id
      OR r.opened_by_user_id IS DISTINCT FROM d.opened_by_user_id
      OR r.last_modified_by_user_id IS DISTINCT FROM d.last_modified_by_user_id
      OR r.description IS DISTINCT FROM d.description
      OR r.knowledge_base IS DISTINCT FROM d.knowledge_base
      OR r.is_template IS DISTINCT FROM d.is_template
      OR r.has_related_documents IS DISTINCT FROM d.has_related_documents
      OR r.has_correlated_documents IS DISTINCT FROM d.has_correlated_documents
      OR r.effective_date IS DISTINCT FROM d.effective_date
      OR r.valid_until IS DISTINCT FROM d.valid_until
  );

INSERT INTO revision_workflow_participants (
    id,
    revision_id,
    participant_type,
    user_id,
    sequence_order,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    r.id,
    p.participant_type,
    p.user_id,
    p.sequence_order,
    NOW(),
    NOW()
FROM document_revisions r
JOIN document_workflow_participants p
    ON p.document_id = r.document_id
   AND p.participant_type IN ('CO_AUTHOR', 'REVIEWER', 'APPROVER')
LEFT JOIN revision_workflow_participants existing
    ON existing.revision_id = r.id
   AND existing.participant_type = p.participant_type
   AND existing.user_id = p.user_id
WHERE existing.id IS NULL;

