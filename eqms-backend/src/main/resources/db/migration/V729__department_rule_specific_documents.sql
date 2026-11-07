-- A Department rule may name specific documents (owner decision 2026-11-02: "10 SOPs, A sees 2 of them, B sees 3").
-- The table is the list of documents of a rule of the target DOCUMENT; a rule has at most 200 (enforced by the service).
CREATE TABLE IF NOT EXISTS object_access_rule_documents (
    object_access_rule_id UUID NOT NULL REFERENCES object_access_rules (id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents (id),
    PRIMARY KEY (object_access_rule_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_oar_documents_document ON object_access_rule_documents (document_id);

ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_resource_type;
ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_resource_type
    CHECK (resource_type IN ('DOCUMENT_CATEGORY', 'DOCUMENT_TYPE', 'DOCUMENT_STATUS', 'DEPARTMENT', 'BUSINESS_UNIT', 'DOCUMENT'));
