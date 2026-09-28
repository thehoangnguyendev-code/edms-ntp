# 17 — File Storage (AS-IS)

Evidence: direct read of `service/FileStorageService.java`, `service/MinioObjectStorageService.java`, `service/RevisionUploadFileValidator.java`, `service/RevisionUploadSecurityAuditService.java`, `entity/RevisionOfficeWorkspaceAccess.java`, `service/RevisionSharePointSyncWorker.java`, `entity/ControlledCopyEvidenceFile.java`.

## Physical storage backends
`service/FileStorageService.java` is the central facade. The `provider` field of the persisted `integrations.storage` system config selects the backend **per-call** (re-read fresh, not cached at startup):
- **`minio`** — real, working integration via `MinioObjectStorageService` (MinIO Java SDK).
- **`nas`** — real SMB/CIFS via `org.codelibs.jcifs.smb`, with a local-staging-directory fallback if unreachable.
- **`local`** (default) — plain `Files.copy` under `storage/revisions`, `storage/controlled-copies/...`, rooted at the working directory.
- **`aws-s3`, `azure-blob`, `google-cloud`, `google-drive`, `onedrive`, `sharepoint`, `dropbox`** — **`IMPLEMENTATION-DISCOVERED`, materially significant: these are SIMULATED ONLY.** `resolveLocalTargetDirectory`/`testConnection`/`resolvePath` only validate config fields are non-blank, log a "Simulating ... Upload" message, and write to a local directory named after the provider. **No real AWS/Azure/GCP/Dropbox/Drive/OneDrive SDK client exists anywhere in the codebase.** An administrator who selects "AWS S3" in system configuration gets no real S3 upload — silently. This should be raised as a Decision Log item: is this intentional placeholder/roadmap functionality, or a configuration surface that could mislead an operator into believing off-site storage is active?

## MinIO integration (`MinioObjectStorageService`)
- `io.minio.MinioClient`, configured per-call from `integrations.storage` JSON (endpoint/access key/secret/bucket/retention years), falling back to `app.minio.*` properties.
- **GMP WORM compliance enforced at the bucket level**: `ensureBucket` creates the bucket with `objectLock(true)`; `enableVersioningAndLock` turns on Versioning + Object Lock in **COMPLIANCE mode** with configurable retention (`app.minio.retention-years`, default 5 years). `validateComplianceConfiguration` (called from `testConnection`) actively re-verifies versioning is ENABLED and lock mode/duration are sufficient, throwing `IllegalStateException` otherwise.
- **Deletion is deliberately disabled**: `delete()`/`deletePrefix()` unconditionally throw `IOException("... disabled because GMP/WORM retention is enabled")` — intentional immutability, `QF-MATCH` with 21 CFR Part 11 non-erasure expectations and the "never delete records" business rule (the strongest such enforcement found anywhere in the system — cross-reference `05-data-model.md`'s delete-strategy summary).
- **Checksums**: every `store()` computes SHA-256 of the staged file, stores it as object user-metadata, returns it in `StoredObject.sha256()`. `FileStorageService.readFile(pathString, expectedSha256)` can verify integrity on read (`IOException("Data integrity breach detected...")` on mismatch) — but this is **opt-in**, only invoked when a caller supplies `expectedSha256`. **UNKNOWN** whether every read path actually passes it — not exhaustively traced.
- Loopback-endpoint hardening: refuses a persisted `localhost`/`127.0.0.1`/`::1` endpoint if the compiled-in default is non-loopback, preventing a stale local config from silently breaking production calls.
- Secret masking safety: re-reads the raw persisted secret when the caller-passed config carries the display mask string, preventing the literal mask from ever being used as a real secret key.

## Distinct storage for source DOCX vs. published PDF rendition
Confirmed distinct object keys (not just distinct DB fields):
- `storeRevisionSourceFile` → keyed by **revision UUID**, not mutable revision number — code comment explicitly notes revision numbers get promoted (e.g. 0.0.1→1.0.0) while the file/checksum/Office-Online workspace must stay stable.
- `storeRevisionPreviewFile`/`storeRevisionPublishingPreviewFile` → review-round PDF renditions, **a distinct object key per round + snapshot id** — never overwritten, backing the `revision_snapshot_history` audit trail (`05-data-model.md`).
- `storeRevisionPublishedPdf` → the final published rendition, separate key again.
- `storeControlledCopyPdf`/`storeControlledCopyEvidence` → separate `controlled-copies/files/...` vs `controlled-copies/evidence/...` namespaces.
Every path returns a SHA-256 checksum from the store call. **UNKNOWN** whether it's persisted into every corresponding entity column across all call sites — not exhaustively traced, though `ControlledCopyEvidenceFile` confirmed persists both `originalSha256` and `watermarkedSha256`.

## `RevisionUploadFileValidator` — source file trust boundary
Explicit javadoc: **"Browser-provided MIME types are deliberately ignored."** Rules, in order:
1. File required, non-empty.
2. Size ≤ `SystemConfigurationService.getDocumentMaxFileSizeMb()` (admin-configurable).
3. Extension allowlist: filename must end `.docx` — only extension checked, not client `Content-Type`.
4. **ZIP magic-byte signature check** (`PK\x03\x04`) — content sniffing, not extension trust, for the container format.
5. **OOXML structural validation**: re-parsed as ZIP; rejects &gt;10,000 entries (zip-bomb entry-count guard) and &gt;200MB uncompressed total (zip-bomb size guard); rejects path-traversal entry names and duplicate entries; requires `[Content_Types].xml` and `word/document.xml` present.
6. **Unsafe content blocklist**: rejects `word/vbaproject.bin` (VBA macros), `word/activex/*`, `word/embeddings/*`, `customui/*` outright; scans content-type overrides for macro-enabled/vbaproject strings.
7. **XXE-hardened XML parsing**: `DocumentBuilderFactory` with secure processing, DOCTYPE disallowed, external entities disabled, no XInclude, no entity expansion; each required XML entry capped at 20MB.
8. Validates root namespace/element of `[Content_Types].xml` and `word/document.xml`.
9. **Malware scan**: delegates to `ClamAvScanService` (internals not read this pass); result must be `clean()` or upload rejected (`MALWARE_DETECTED`). `GlobalExceptionHandler` maps `VirusScanUnavailableException` → **503**, i.e. **fail-closed**: if ClamAV itself is down, upload is refused, not silently un-scanned.
10. Computes SHA-256 of validated content, returns it with a `malwareScanPerformed` flag.

`RevisionUploadSecurityAuditService.recordRejected(...)` persists every rejected upload attempt in a **new, independent transaction** (`REQUIRES_NEW`) — survives even if the calling transaction rolls back, capturing reason code, filename, client-declared content-type, size. This is a deliberate, GMP-appropriate audit-durability decision (see `15-audit-trail.md`).

## Microsoft Graph / SharePoint Office Online editing
- `entity/RevisionOfficeWorkspaceAccess.java`: per-user, per-revision workspace grant (`accessRole`, `accessMode`, `grantStatus` default `PENDING`, `grantedAt`/`revokedAt`). **Deliberately stores a Graph permission id, never a sharing URL** — javadoc: URLs can carry bearer-like tokens and must never persist in audit data. Security-conscious design decision.
- `service/RevisionSharePointSyncWorker.syncRevisionAsync` (`@Async("integrationExecutor")` + `@Transactional`): calls `MicrosoftGraphStorageService.syncRevisionFile`, writes site/drive/item ids + URLs + `storageSyncStatus`/`storageLastSyncedAt` back onto the revision. **On any exception, sets `storageSyncStatus="FAILED"` and swallows the exception (log.warn only)** — the same "swallow and log" pattern already confirmed for `PublishingPdfComposerService` in `08-state-machines.md` §8.4d, now confirmed a second time in a different subsystem. No retry/backoff here; no scheduled re-sync sweep for `FAILED` status found (**UNKNOWN** whether one exists elsewhere).
- **Confirmed concurrency gap**: no optimistic-conflict/co-authoring-collision handling in this worker — it always overwrites `storageItemId`/URLs/status unconditionally; a concurrent sync or a co-author's edit racing this async write just has the later `save()` win, with **no version check against the Graph item's own etag prior to writing back**. `IMPLEMENTATION-GAP` candidate — flag for Decision Log: is content-level co-authoring merge (Word's own mechanism) sufficient, making this metadata-only race acceptable, or does it need hardening?
- `MicrosoftGraphStorageService.isConfigured()` requires tenantId/clientId/clientSecret/driveId all present and not the placeholder value — a real safeguard against shipping stub Azure AD secrets to production.

## Controlled Copy evidence files
`entity/ControlledCopyEvidenceFile.java`: uploaded when reporting a copy "Damaged." Retains **both** the original upload (`originalFileName/ContentType/FileSize/StoredPath/Sha256`) and the possibly-watermarked working copy (`fileName/ContentType/FileSize/StoredPath`, `watermarkedSha256`, `watermarked` flag) — javadoc: "The original object is retained in MinIO for traceability" even after watermarking. Storage: `controlled-copies/evidence/...` MinIO key (or local fallback). Inherits the same WORM Object Lock/versioning guarantee as everything else in `MinioObjectStorageService` — no weaker retention path found for evidence specifically. Cross-reference `05-data-model.md`: this entity's FK to `ControlledCopyRecord` was deliberately hardened from CASCADE to RESTRICT (`V337`) for exactly this evidentiary-integrity reason.

## UNKNOWNs
- Whether every checksum returned by storage calls is persisted and re-verified on read across all Revision/Controlled-Copy code paths.
- `OfficeOnlineConfigurationService`'s exact config field list (parallel to `MicrosoftGraphStorageProperties`) — not read this pass.
- `ClamAvScanService` internals (scan mechanism, timeout behavior).
- Whether any scheduled reconciliation job exists for `storageSyncStatus=FAILED` SharePoint syncs.
