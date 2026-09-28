-- Normalize any stray-case relation_type values to the canonical uppercase form, then lock the
-- column down with a CHECK constraint so the case-sensitivity bug (RevisionService querying
-- "Related" while every write path used "RELATED") can never silently reappear.
UPDATE document_relations
SET relation_type = UPPER(relation_type)
WHERE relation_type <> UPPER(relation_type);

ALTER TABLE document_relations
    ADD CONSTRAINT document_relations_relation_type_check
    CHECK (relation_type IN ('RELATED', 'CORRELATED'));
