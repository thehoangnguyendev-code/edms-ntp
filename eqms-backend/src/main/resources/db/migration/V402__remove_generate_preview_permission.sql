-- documents.revision.generate_preview is retired: review-snapshot generation is now fully
-- server-triggered (RevisionService#requestReviewSnapshotGeneration on Submit for Review,
-- automatically retried by RevisionSnapshotRetryScheduler on failure) -- there is no manual
-- user action left that this permission could gate. It was already orphaned in practice before
-- this migration: no active workflow_action_policies row referenced it (GENERATE_REVIEW_SNAPSHOT/
-- REGENERATE_SNAPSHOT@DRAFT had already drifted to require documents.revision.submit_review), and
-- the "Retry Snapshot" FE button it nominally backed could never appear (snapshotStatus was never
-- actually set to FAILED/GENERATING by any code path before this change).
DELETE FROM permission_set_items
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'documents.revision.generate_preview');

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'documents.revision.generate_preview');

DELETE FROM permissions WHERE code = 'documents.revision.generate_preview';
