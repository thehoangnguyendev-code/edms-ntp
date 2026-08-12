-- V81: Seed document relations for publish warning test data.
-- We want SOP-TEST-005 (Ready for Publishing) to have SOP-TEST-002 (Pending Review) as a Related Document.

DO $$
DECLARE
    v_source_id uuid;
    v_target_id uuid;
BEGIN
    SELECT id INTO v_source_id FROM documents WHERE document_number = 'SOP-TEST-005';
    SELECT id INTO v_target_id FROM documents WHERE document_number = 'SOP-TEST-002';

    IF v_source_id IS NOT NULL AND v_target_id IS NOT NULL THEN
        INSERT INTO document_relations (id, source_document_id, target_document_id, relation_type, created_at, updated_at)
        SELECT gen_random_uuid(), v_source_id, v_target_id, 'RELATED', NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM document_relations
            WHERE source_document_id = v_source_id
              AND target_document_id = v_target_id
              AND relation_type = 'RELATED'
        );

        -- Update has_related_documents flag for SOP-TEST-005
        UPDATE documents
        SET has_related_documents = true,
            updated_at = NOW()
        WHERE id = v_source_id;
    END IF;
END $$;
