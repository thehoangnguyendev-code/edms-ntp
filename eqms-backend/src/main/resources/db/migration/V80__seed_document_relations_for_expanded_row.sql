-- =============================================================================
-- V80: Seed document_relations data for ExpandedDocumentRow functionality.
--
-- Problem: Some documents have has_related_documents=true or
-- has_correlated_documents=true but the document_relations table is empty.
-- This causes the expand arrow to appear in the UI with no data inside.
--
-- Solution: Insert realistic cross-references between documents that
-- logically relate to each other in an EQMS context, then ensure the
-- boolean flags on documents are consistent with actual relation rows.
--
-- Fixed (DC-XF-89): the original version of this migration looked up each
-- document by document_number via a scalar subquery and inserted the result
-- directly into source_document_id/target_document_id (NOT NULL columns). On
-- a fresh/empty database none of these seed document_numbers exist yet, so
-- both subqueries returned NULL and the INSERT violated the NOT NULL
-- constraint (SQLSTATE 23502), making it impossible to migrate a brand-new
-- database from scratch. This version resolves every document_number once
-- via a CTE and only inserts a relation when BOTH documents actually exist --
-- on a fresh database the CTE is empty, every INSERT's SELECT naturally
-- produces zero rows via the inner join, and the migration is a no-op instead
-- of a crash. On an existing database with this seed data already present,
-- behavior is unchanged.
-- =============================================================================

WITH doc_ids AS (
    SELECT document_number, id
    FROM documents
    WHERE document_number IN (
        'SOP.0001', 'SOP.0002', 'SOP.0003', 'SOP.0004',
        'SPEC.0001', 'SPEC.0002',
        'FORM.0001', 'FORM.0002',
        'POL.0001', 'POL.0002', 'POL.0003'
    )
)

-- ─── Step 1: Insert Related Document relationships ────────────────────────────
-- RELATED = documents that must be used/referenced together
, related_pairs (source_number, target_number) AS (
    VALUES
        -- SOP.0001 (Quality Control Testing Procedure) ↔ SPEC.0001 (Raw Material Specification)
        -- Reason: QC testing procedure references raw material specs
        ('SOP.0001', 'SPEC.0001'),
        -- SOP.0001 (Quality Control Testing Procedure) ↔ FORM.0001 (Batch Production Record Form)
        -- Reason: QC testing uses batch production record forms
        ('SOP.0001', 'FORM.0001'),
        -- SOP.0002 (Equipment Cleaning Procedure) ↔ SPEC.0001 (Raw Material Specification)
        -- Reason: Cleaning procedure depends on material specs for residue limits
        ('SOP.0002', 'SPEC.0001'),
        -- SOP.0003 (Admin SOP for Internal Audit) ↔ FORM.0002 (Admin Corrective Action Form)
        -- Reason: Internal audit SOP uses corrective action forms
        ('SOP.0003', 'FORM.0002'),
        -- SPEC.0001 (Raw Material Specification) ↔ SPEC.0002 (Admin Lab Calibration Specification)
        -- Reason: Material specs reference calibration specs for testing equipment
        ('SPEC.0001', 'SPEC.0002'),
        -- FORM.0001 (Batch Production Record Form) ↔ SOP.0001 (Quality Control Testing Procedure)
        -- Reverse direction for bidirectional visibility
        ('FORM.0001', 'SOP.0001'),
        -- FORM.0002 (Admin Corrective Action Form) ↔ SOP.0003 (Admin SOP for Internal Audit)
        ('FORM.0002', 'SOP.0003')
)
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(), src.id, tgt.id, 'RELATED', NOW(), NOW()
FROM related_pairs p
JOIN doc_ids src ON src.document_number = p.source_number
JOIN doc_ids tgt ON tgt.document_number = p.target_number
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations dr
    WHERE dr.source_document_id = src.id
      AND dr.target_document_id = tgt.id
      AND dr.relation_type = 'RELATED'
);

-- ─── Step 2: Insert Correlated Document relationships ─────────────────────────
-- CORRELATED = documents that share a common regulatory or quality context
WITH doc_ids AS (
    SELECT document_number, id
    FROM documents
    WHERE document_number IN (
        'SOP.0001', 'SOP.0004',
        'SPEC.0001',
        'FORM.0002',
        'POL.0001', 'POL.0002', 'POL.0003'
    )
), correlated_pairs (source_number, target_number) AS (
    VALUES
        -- POL.0002 (Document Control Policy) ↔ SOP.0004 (Admin Document Review SOP)
        -- Reason: Document control policy is the governance for document review SOP
        ('POL.0002', 'SOP.0004'),
        -- POL.0003 (Admin Data Entry Policy) ↔ FORM.0002 (Admin Corrective Action Form)
        -- Reason: Data entry policy governs how corrective action forms are filled
        ('POL.0003', 'FORM.0002'),
        -- SOP.0001 (Quality Control Testing Procedure) ↔ POL.0001 (Quality Management Policy)
        -- Reason: QC testing procedure implements the quality management policy
        ('SOP.0001', 'POL.0001'),
        -- SOP.0004 (Admin Document Review SOP) ↔ POL.0002 (Document Control Policy)
        -- Reverse direction for bidirectional correlated visibility
        ('SOP.0004', 'POL.0002'),
        -- SPEC.0001 (Raw Material Specification) ↔ POL.0001 (Quality Management Policy)
        -- Reason: Material specs are governed by the quality management policy
        ('SPEC.0001', 'POL.0001'),
        -- FORM.0002 (Admin Corrective Action Form) ↔ POL.0003 (Admin Data Entry Policy)
        ('FORM.0002', 'POL.0003')
)
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(), src.id, tgt.id, 'CORRELATED', NOW(), NOW()
FROM correlated_pairs p
JOIN doc_ids src ON src.document_number = p.source_number
JOIN doc_ids tgt ON tgt.document_number = p.target_number
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations dr
    WHERE dr.source_document_id = src.id
      AND dr.target_document_id = tgt.id
      AND dr.relation_type = 'CORRELATED'
);


-- ─── Step 3: Sync has_related_documents flag from actual relation rows ────────
-- Set to true only when actual RELATED relations exist for the document
UPDATE documents d
SET
    has_related_documents = EXISTS (
        SELECT 1 FROM document_relations r
        WHERE r.source_document_id = d.id AND r.relation_type = 'RELATED'
    ),
    updated_at = NOW()
WHERE has_related_documents != EXISTS (
    SELECT 1 FROM document_relations r
    WHERE r.source_document_id = d.id AND r.relation_type = 'RELATED'
);


-- ─── Step 4: Sync has_correlated_documents flag from actual relation rows ─────
UPDATE documents d
SET
    has_correlated_documents = EXISTS (
        SELECT 1 FROM document_relations r
        WHERE r.source_document_id = d.id AND r.relation_type = 'CORRELATED'
    ),
    updated_at = NOW()
WHERE has_correlated_documents != EXISTS (
    SELECT 1 FROM document_relations r
    WHERE r.source_document_id = d.id AND r.relation_type = 'CORRELATED'
);
