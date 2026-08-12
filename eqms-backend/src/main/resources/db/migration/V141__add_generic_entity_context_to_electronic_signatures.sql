ALTER TABLE electronic_signatures
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(80),
    ADD COLUMN IF NOT EXISTS entity_id UUID;

UPDATE electronic_signatures
SET entity_type = CASE
        WHEN revision_id IS NOT NULL THEN 'revisions'
        WHEN document_id IS NOT NULL THEN 'documents'
        ELSE entity_type
    END,
    entity_id = COALESCE(revision_id, document_id, entity_id)
WHERE entity_type IS NULL OR entity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_electronic_signatures_entity ON electronic_signatures(entity_type, entity_id, signed_at);
