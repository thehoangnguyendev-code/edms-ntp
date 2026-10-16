# Change record: refresh the revision source preview after upload

Date: 2026-10-16. Scope: RevisionCreateView Document tab. Requested by the owner: replacing or uploading a source file must show the newly stored file without a page reload.

## Invariants and scope

- The actor and permission/object-scope checks of the existing upload and OnlyOffice view-config endpoints remain authoritative.
- No lifecycle, parent/child, audit, electronic-signature, storage or async-generation behavior is changed. No API or DB migration is needed.
- A successful upload is followed by the existing forced revision snapshot refresh. The preview session is identified by that revision's server-returned id, source checksum, source storage version and upload timestamp.
- An unchanged source retains its current preview session. A failed upload retains the current preview and reports the existing upload error.

## Source-confirmed cause and change

RevisionCreateView refreshed metadata after upload but rendered the same DocumentTab instance for the same revision. DocumentTab passed only the revision id to OnlyOfficeDocumentViewer. The latter's polling did not guarantee an immediate refresh at the upload completion boundary. The existing versionToken prop was not wired to the upload result.

The backend already derives the OnlyOffice document key from source timestamps and checksum (OnlyOfficeDocumentEditService.buildDocumentKey). The correction is local to RevisionCreateViewContent: key DocumentTab by the stored source identity so React disposes the old viewer and its outstanding initialization before requesting a fresh, server-signed config.

Sources:
- eqms/src/features/documents/document-revisions/views/RevisionCreateView.tsx: handleReplaceRevisionFile, refreshRevisionFromBackend and DocumentTab rendering.
- eqms/src/features/documents/document-revisions/detail-revision/tabs/DocumentTab.tsx.
- eqms/src/features/documents/shared/components/OnlyOfficeDocumentViewer.tsx: initialization and cleanup.
- eqms-backend/src/main/java/com/eqms/service/RevisionService.java: source upload and getOnlyOfficeViewConfig.
- eqms-backend/src/main/java/com/eqms/service/OnlyOfficeDocumentEditService.java: buildDocumentKey.

## Impact and verification

- GitNexus index was repaired because a previous analysis was incomplete. After reindexing, upstream impact for RevisionCreateViewContent: LOW, 1 direct caller, 2 dependants, 0 indexed affected processes.
- Before the correction, the replacement regression test failed: the last DocsAPI.DocEditor config still held the old source key. Initial upload and failed-upload cases passed.
- After the correction: 30 tests passed across 4 files (source preview regression, NewDocumentView lifecycle, DetailDocumentView lifecycle, OnlyOfficeEditorPage).
- The new regression uses the real RevisionCreateView, DocumentTab and OnlyOfficeDocumentViewer, with mocked API/DocsAPI boundaries. It covers replacement, first source upload, lightweight upload responses, forced snapshot refresh, old-viewer cleanup and upload failure.

## Limits and handoff

This is test-confirmed with mocked network/OnlyOffice boundaries, not a claim of runtime or GMP validation. No real user document was uploaded or replaced for verification. Existing unrelated working-tree changes were preserved, including the TrainingInformationTab revisionId change in RevisionCreateView.

The project instructions refer to system/00_EVIDENCE_CONVENTIONS.md, the system As-Is files and validation/08_ONE_CHANGE_RECORD_TEMPLATE.md; those files were absent from this workspace and HEAD. This record follows the available local change-record structure and records source/test evidence directly. Governance decisions were read; the fix introduces no new business rule.

Rollback: remove only the source-identity key on DocumentTab and this change's regression tests. Historical files and audit data are unaffected.
