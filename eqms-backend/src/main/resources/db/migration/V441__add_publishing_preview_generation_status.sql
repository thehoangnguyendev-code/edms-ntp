-- #4: Regenerating the published/preview PDF (RevisionService.regenerateSnapshot ->
-- PublishingPdfComposerService.composePreview, Microsoft Graph DOCX->PDF conversion, up to
-- 2-5 minute per-call timeouts) previously ran synchronously inside the request thread's own
-- @Transactional method, holding a DB connection for the whole round trip. Moving it to the same
-- async event + AFTER_COMMIT + REQUIRES_NEW pattern already used by the review-snapshot pipeline
-- (RevisionSnapshotAsyncService) needs a status/error/request-id trio of its own, mirroring
-- documents_revisions.snapshot_status/snapshot_error/snapshot_request_id for that other pipeline
-- -- kept on revision_publishing_metadata (not the revision itself) since this status is specific
-- to the Publishing preview, not the pre-publish review snapshot.
ALTER TABLE revision_publishing_metadata
    ADD COLUMN IF NOT EXISTS preview_generation_status VARCHAR(20) NOT NULL DEFAULT 'READY',
    ADD COLUMN IF NOT EXISTS preview_generation_error TEXT,
    ADD COLUMN IF NOT EXISTS preview_generation_request_id UUID;
