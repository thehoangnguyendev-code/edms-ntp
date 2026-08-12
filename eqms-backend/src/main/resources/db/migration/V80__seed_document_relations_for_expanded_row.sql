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
-- =============================================================================


-- ─── Step 1: Insert Related Document relationships ────────────────────────────
-- RELATED = documents that must be used/referenced together

-- SOP.0001 (Quality Control Testing Procedure) ↔ SPEC.0001 (Raw Material Specification)
-- Reason: QC testing procedure references raw material specs
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SOP.0001'),
       (SELECT id FROM documents WHERE document_number = 'SPEC.0001'),
       'RELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0001')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'SPEC.0001')
      AND relation_type = 'RELATED'
);

-- SOP.0001 (Quality Control Testing Procedure) ↔ FORM.0001 (Batch Production Record Form)
-- Reason: QC testing uses batch production record forms
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SOP.0001'),
       (SELECT id FROM documents WHERE document_number = 'FORM.0001'),
       'RELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0001')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'FORM.0001')
      AND relation_type = 'RELATED'
);

-- SOP.0002 (Equipment Cleaning Procedure) ↔ SPEC.0001 (Raw Material Specification)
-- Reason: Cleaning procedure depends on material specs for residue limits
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SOP.0002'),
       (SELECT id FROM documents WHERE document_number = 'SPEC.0001'),
       'RELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0002')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'SPEC.0001')
      AND relation_type = 'RELATED'
);

-- SOP.0003 (Admin SOP for Internal Audit) ↔ FORM.0002 (Admin Corrective Action Form)
-- Reason: Internal audit SOP uses corrective action forms
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SOP.0003'),
       (SELECT id FROM documents WHERE document_number = 'FORM.0002'),
       'RELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0003')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'FORM.0002')
      AND relation_type = 'RELATED'
);

-- SPEC.0001 (Raw Material Specification) ↔ SPEC.0002 (Admin Lab Calibration Specification)
-- Reason: Material specs reference calibration specs for testing equipment
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SPEC.0001'),
       (SELECT id FROM documents WHERE document_number = 'SPEC.0002'),
       'RELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SPEC.0001')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'SPEC.0002')
      AND relation_type = 'RELATED'
);

-- FORM.0001 (Batch Production Record Form) ↔ SOP.0001 (Quality Control Testing Procedure)
-- Reverse direction for bidirectional visibility
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'FORM.0001'),
       (SELECT id FROM documents WHERE document_number = 'SOP.0001'),
       'RELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'FORM.0001')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0001')
      AND relation_type = 'RELATED'
);

-- FORM.0002 (Admin Corrective Action Form) ↔ SOP.0003 (Admin SOP for Internal Audit)
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'FORM.0002'),
       (SELECT id FROM documents WHERE document_number = 'SOP.0003'),
       'RELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'FORM.0002')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0003')
      AND relation_type = 'RELATED'
);


-- ─── Step 2: Insert Correlated Document relationships ─────────────────────────
-- CORRELATED = documents that share a common regulatory or quality context

-- POL.0002 (Document Control Policy) ↔ SOP.0004 (Admin Document Review SOP)
-- Reason: Document control policy is the governance for document review SOP
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'POL.0002'),
       (SELECT id FROM documents WHERE document_number = 'SOP.0004'),
       'CORRELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'POL.0002')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0004')
      AND relation_type = 'CORRELATED'
);

-- POL.0003 (Admin Data Entry Policy) ↔ FORM.0002 (Admin Corrective Action Form)
-- Reason: Data entry policy governs how corrective action forms are filled
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'POL.0003'),
       (SELECT id FROM documents WHERE document_number = 'FORM.0002'),
       'CORRELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'POL.0003')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'FORM.0002')
      AND relation_type = 'CORRELATED'
);

-- SOP.0001 (Quality Control Testing Procedure) ↔ POL.0001 (Quality Management Policy)
-- Reason: QC testing procedure implements the quality management policy
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SOP.0001'),
       (SELECT id FROM documents WHERE document_number = 'POL.0001'),
       'CORRELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0001')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'POL.0001')
      AND relation_type = 'CORRELATED'
);

-- SOP.0004 (Admin Document Review SOP) ↔ POL.0002 (Document Control Policy)
-- Reverse direction for bidirectional correlated visibility
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SOP.0004'),
       (SELECT id FROM documents WHERE document_number = 'POL.0002'),
       'CORRELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SOP.0004')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'POL.0002')
      AND relation_type = 'CORRELATED'
);

-- SPEC.0001 (Raw Material Specification) ↔ POL.0001 (Quality Management Policy)
-- Reason: Material specs are governed by the quality management policy
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'SPEC.0001'),
       (SELECT id FROM documents WHERE document_number = 'POL.0001'),
       'CORRELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'SPEC.0001')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'POL.0001')
      AND relation_type = 'CORRELATED'
);

-- FORM.0002 (Admin Corrective Action Form) ↔ POL.0003 (Admin Data Entry Policy)
INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
SELECT gen_random_uuid(),
       (SELECT id FROM documents WHERE document_number = 'FORM.0002'),
       (SELECT id FROM documents WHERE document_number = 'POL.0003'),
       'CORRELATED', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_relations
    WHERE source_document_id = (SELECT id FROM documents WHERE document_number = 'FORM.0002')
      AND target_document_id = (SELECT id FROM documents WHERE document_number = 'POL.0003')
      AND relation_type = 'CORRELATED'
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
