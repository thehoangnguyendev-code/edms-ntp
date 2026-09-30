-- Per explicit product decision: Force Publish (the GMP-deviation override that let a Document
-- Master publish while a Related Document was not yet Effective) is removed entirely, no
-- replacement escape hatch. Publish now hard-blocks until every Related Document with a revision
-- in progress has itself reached Ready for Publishing, then publishes the whole linked package
-- together in one action (see RevisionService.publishRevision). This migration only removes the
-- now-dead permission/dependency rows seeded by V391/V403; no schema change is needed for the
-- batch-publish behavior itself (it reuses the existing documents/document_relations/revisions
-- tables and the existing documents.revision.publish permission, now also checked per Related
-- Document being published in the same batch).

DELETE FROM permission_dependencies
WHERE permission_code = 'documents.revision.force_publish'
   OR depends_on_code = 'documents.revision.force_publish';

DELETE FROM permission_set_items
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'documents.revision.force_publish');

DELETE FROM permissions WHERE code = 'documents.revision.force_publish';
