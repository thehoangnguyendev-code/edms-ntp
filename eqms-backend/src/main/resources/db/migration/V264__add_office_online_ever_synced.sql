-- Complete Editing (lockOfficeOnlineEditing) intentionally clears storageItemId/storageDriveId/
-- storageEditUrl/storageProvider back to a clean "minio" state once the source is locked for
-- submission -- but that means those fields can no longer answer "did this revision ever use
-- Office Online before submit?" by the time it reaches Pending Review/Approval, so a later reject
-- can never tell whether to restore an Office Online working copy. This flag survives that reset.
ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS office_online_ever_synced BOOLEAN NOT NULL DEFAULT FALSE;
