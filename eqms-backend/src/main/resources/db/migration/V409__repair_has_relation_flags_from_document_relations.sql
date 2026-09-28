-- Data repair: the denormalised documents.has_related_documents / has_correlated_documents flags
-- (and their per-revision snapshots on document_revisions) drifted out of sync with the actual
-- document_relations rows.
--
-- Root cause (fixed in the same change): editing Related/Correlated Documents on an already-Active
-- document via the "configure next revision" path (DocumentService.replaceActiveDocumentRelations)
-- wrote/removed document_relations rows but never updated the boolean flags, so the All Documents /
-- Revisions list columns and the "Related Document = Yes/No" filter showed a stale value while the
-- expandable detail (which reads document_relations live) showed the real relation.
--
-- document_relations is keyed by source_document_id (the document, not a revision), so every
-- revision of a document shares one relation set -- each revision's flag must equal its document's.

UPDATE documents d
SET has_related_documents = EXISTS (
        SELECT 1 FROM document_relations r
        WHERE r.source_document_id = d.id AND r.relation_type = 'RELATED')
WHERE d.has_related_documents <> EXISTS (
        SELECT 1 FROM document_relations r
        WHERE r.source_document_id = d.id AND r.relation_type = 'RELATED');

UPDATE documents d
SET has_correlated_documents = EXISTS (
        SELECT 1 FROM document_relations r
        WHERE r.source_document_id = d.id AND r.relation_type = 'CORRELATED')
WHERE d.has_correlated_documents <> EXISTS (
        SELECT 1 FROM document_relations r
        WHERE r.source_document_id = d.id AND r.relation_type = 'CORRELATED');

UPDATE document_revisions rev
SET has_related_documents = d.has_related_documents,
    has_correlated_documents = d.has_correlated_documents
FROM documents d
WHERE rev.document_id = d.id
  AND (rev.has_related_documents <> d.has_related_documents
       OR rev.has_correlated_documents <> d.has_correlated_documents);
