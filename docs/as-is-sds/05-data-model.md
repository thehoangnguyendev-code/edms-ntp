# 05 — Data Model (AS-IS, field/table/FK detail)

Evidence: direct entity + migration read. See `04-domain-model.md` for the conceptual relationship summary.

## DocumentRecord — table `documents`
`entity/DocumentRecord.java`

| Field | Column | Type/notes |
|---|---|---|
| id | id | UUID PK |
| lockVersion | lock_version | `@Version` bigint NOT NULL (added by `V380`) |
| documentNumber | document_number | varchar(80) NOT NULL **UNIQUE** |
| documentName | document_name | varchar(255) NOT NULL (DB column originally named `title` in `V6`; later renamed) |
| titleLocalLanguage | title_local_language | varchar(255) nullable |
| version | version | varchar(40) NOT NULL — semantic version string, **distinct from `lockVersion`** |
| status | status_code | `@ManyToOne` → `DocumentStatusDefinition.code`, NOT NULL, **FK-enforced** |
| documentType | document_type_id | `@ManyToOne` → DocumentType, NOT NULL |
| businessUnit / department | business_unit_id / department_id | `@ManyToOne`, NOT NULL |
| author / owner | author_user_id / owner_user_id | `@ManyToOne` → UserAccount, NOT NULL |
| openedBy / lastModifiedBy | opened_by_user_id / last_modified_by_user_id | `@ManyToOne`, nullable |
| subType | sub_type | varchar(255) — **plain string, NOT an FK** to `DocumentSubType`. UNKNOWN whether intentional decoupling or a gap. |
| hasRelatedDocuments / hasCorrelatedDocuments | has_related_documents / has_correlated_documents | boolean NOT NULL — cached flags mirroring `DocumentRelation` existence |
| effectiveDate / validUntil / reviewDate | effective_date / valid_until / review_date | DATE nullable |
| requiresTraining / trainingPeriodDays / reasonForSkippingTraining | — | boolean / Integer / varchar(1024) |
| obsoletedBy/obsoletedAt, cancelledBy/cancelledAt | — | `@ManyToOne` UserAccount + Instant, nullable |

No soft-delete flag. No hard-delete mechanism observed in the entity itself.

## DocumentRevisionRecord — table `document_revisions`
`entity/DocumentRevisionRecord.java`, origin `V9__create_revision_management_schema.sql`

- `document` → `document_id` NOT NULL FK to `documents(id)`. **`ON DELETE CASCADE`** in the origin migration. No application code path performing `DELETE FROM documents` was found — see delete-strategy summary below.
- `parentRevision` → `parent_revision_id`, self-referential, **`ON DELETE SET NULL`**, nullable.
- `status` → `status_code`, `@ManyToOne` → `RevisionStatusDefinition.code`, NOT NULL, **FK-enforced**.
- `lockVersion` — `@Version`, added by `V380` alongside Document/ControlledCopy.
- `documentNumber`, `documentName`, `titleLocalLanguage` — **denormalized point-in-time snapshot** of the parent Document's identifying fields at revision-creation time (protects historical revisions from later Document renames).
- `revisionNumber` / `revisionName` (auto-computed as `documentName + "_" + revisionNumber` in `syncRevisionName()`).
- `reviewRequirement` (`@Enumerated(STRING)`, NOT NULL, default `REQUIRED`) — **IMPLEMENTATION-DISCOVERED snapshot pattern**: source comment states this is "a snapshot of the Sub-Type workflow rule; never recompute for an in-flight revision" — copies `DocumentSubType.reviewRequirement` at creation rather than joining live. This is why changing a Sub-Type's review policy later doesn't retroactively alter in-flight revisions.
- File/source metadata: `fileName/filePath/previewFilePath/fileType/fileSize`, plus a full source-storage-provenance block (`sourceStorageProvider/Bucket/ObjectKey/VersionId`, `sourceFileChecksum`, `sourceUploadedAt`) and a parallel published/Office-Online storage block (`storageProvider`, `storageSiteId/DriveId/ItemId`, `storageWebUrl/EditUrl/EditPermissionId/ViewUrl/ViewPermissionId/PdfUrl`, `storageSyncStatus`, `storageLastSyncedAt`).
- `editingStatus` (varchar(30), default `"IN_PROGRESS"`) and `sourceLocked` (boolean, default false) — **plain strings/booleans, not FK-enforced**, same non-FK pattern as ControlledCopyRecord's status.
- Snapshot/async-job correlation: `snapshotStatus`, `snapshotError`, `snapshotRequestId`, `snapshotSourceChecksum`.
- Lifecycle actor/timestamp pairs: `publishedBy/publishedAt`, `submittedBy/submittedOn`, `rejectedBy/rejectedAt`, `obsoletedBy/obsoletedAt`, `cancelledBy/cancelledAt`.
- `impactAnalysisId` (UUID, nullable) — correlation id, **not** an FK-mapped relationship; target entity UNKNOWN from this file alone.

**Data-integrity gap candidate**: no unique constraint on `(document_id, revision_number)` was found in the origin migration or later ones reviewed — only non-unique indexes. The DB does **not** structurally prevent two revisions of the same document sharing a revision_number; if enforced at all, it's application-layer only. Flagged in `21-known-unknowns-conflicts.md`.

No soft-delete flag.

## ControlledCopyRecord — table `controlled_copies`
`entity/ControlledCopyRecord.java`, origin `V47__create_controlled_copies.sql`

- `document` → `document_id` NOT NULL FK, **no `ON DELETE` clause** (RESTRICT by default) — unlike `document_revisions`' CASCADE. Confirms: no cascade path from Document/Revision deletion into Controlled Copy.
- `revision` → `revision_id` NOT NULL FK, same RESTRICT-by-default behavior.
- `distributionBatch` → `distribution_batch_id`, nullable FK (added `V87`).
- **Denormalized/snapshot fields** (confirms hypothesis): `controlledCopyNumber` (unique), `copyNumber`, `totalCopies`, `documentNumber`, `documentTitle`, `revisionNumber`, `businessUnitName`, `departmentName` — copied at copy-creation time rather than joined live, so a printed/displayed copy's identity is fixed even if the source Document is later renamed or moved.
- `status` (varchar(40) NOT NULL) and `statusCode` (varchar(40) NOT NULL) — **plain String columns, confirmed NOT FK-enforced** against `ControlledCopyStatusDefinition`/`controlled_copy_statuses` — matches the architectural finding in `08-state-machines.md` §8.4.3b. Two parallel string fields exist side by side (legacy label vs. machine-code split), both unconstrained at the DB level.
- `customPlaceholderValues` — `@JdbcTypeCode(SqlTypes.JSON)` → `jsonb` column; per-copy values for `ControlledCopyPlaceholderField` definitions.
- Consumption counters: `downloadCount`/`printCount` (int, default 0), `lastDownloadedAt` — updated via atomic conditional bulk UPDATE (`consumeDownload`/`consumePrint`), deliberately bypassing `@Version` (see `12-transaction-concurrency.md`).
- `accessToken` (varchar(128), **UNIQUE**), `accessTokenIssuedAt`, `previewPasswordHash` — external/portal preview access fields (see `06-role-authorization-model.md` §6.3, anonymous token access path).
- Recall/destroy/lost-damaged block, expiry block (`validUntil`, `effectiveDate`, `hasExpiryDate`, `expiryDate`, `expiryReminderSentAt`).
- `replacedControlledCopy` → `replaced_controlled_copy_id`, self-referential `@ManyToOne` — set only on a Reissue's new record.
- `lockVersion` — `@Version`, added `V380`; source comments explicitly state it does **not** protect `consumeDownload`/`consumePrint`.

No soft-delete flag.

## ControlledCopyDistributionBatch — table `controlled_copy_distribution_batches`
`entity/ControlledCopyDistributionBatch.java`, origin `V87`
- `document`/`revision` — NOT NULL FKs, no `ON DELETE` clause (RESTRICT by default).
- Same denormalized-snapshot pattern (`documentNumber`, `documentTitle`, `revisionNumber`) as ControlledCopyRecord.
- `status`/`statusCode` — plain unconstrained strings, same non-FK pattern.
- `copies` — `@OneToMany(mappedBy="distributionBatch")`, **no `orphanRemoval`, no `CascadeType.REMOVE`** (default Hibernate cascade = none) — consistent with "never delete": removing a batch would not cascade-delete member copies at the JPA layer, and the underlying FK has no `ON DELETE CASCADE` either.
- **No `@Version` field** — Batch is NOT optimistic-lock protected, unlike Document/Revision/ControlledCopy. `IMPLEMENTATION-DISCOVERED` — consistent with why the Batch entities rely on async re-fetch + explicit terminal-state checks rather than JPA version conflicts (`12-transaction-concurrency.md`).

## ControlledCopyDistributionJob / JobItem
`entity/ControlledCopyDistributionJob.java` / `ControlledCopyDistributionJobItem.java`
- Job: `batch_id` NOT NULL FK; `requestedBy` NOT NULL FK; `actionType` (default `"DISTRIBUTE"`), `status`, `totalItems/succeededItems/failedItems`, timestamps. No `@Version`.
- JobItem: `job_id` NOT NULL FK; `controlled_copy_id` NOT NULL FK; `status`, `attempts`, `lastErrorCode`, `lastErrorMessage` (TEXT), timestamps.

## DocumentRelation — table `document_relations`
`entity/DocumentRelation.java`, origin `V8__document_draft_participants_and_relations.sql`
- Genuine association entity (own PK, own audit columns) — `sourceDocument`/`targetDocument`, both **`ON DELETE CASCADE`** to `documents.id`.
- `relationType` (varchar(20) NOT NULL) — exact enumerated values UNKNOWN from entity alone.
- `UNIQUE (source_document_id, target_document_id, relation_type)`.
- **Flag**: `ON DELETE CASCADE` here implies the schema was originally built assuming Document rows *could* be deleted (harmless in this direction — cleanup of link rows only — but notable alongside the same pattern on `document_revisions.document_id`, see summary below).

## DocumentWorkflowParticipant — table `document_workflow_participants`
`entity/DocumentWorkflowParticipant.java`, origin `V8`
- `document_id` NOT NULL, **`ON DELETE CASCADE`**; `user_id` NOT NULL, **`ON DELETE CASCADE`**.
- `participantType` (varchar(20)), `sequenceOrder` (int, default 0).
- `UNIQUE (document_id, participant_type, user_id)`.

## RevisionWorkflowParticipant — table `revision_workflow_participants`
`entity/RevisionWorkflowParticipant.java`, origin `V9`
- `revision_id` NOT NULL, **`ON DELETE CASCADE`**; `user_id` NOT NULL, **`ON DELETE CASCADE`**.
- `participantType`, `sequenceOrder`, `actionStatus` (default `"PENDING"`), `actionComment` (TEXT), `actedAt`, `signatureSessionId` (raw UUID column, **not FK-mapped** — target entity UNKNOWN from this file alone).
- `UNIQUE (revision_id, participant_type, user_id)`.

## RevisionWorkflowHistory — table `revision_workflow_history`
`entity/RevisionWorkflowHistory.java`
- `revision_id` NOT NULL, **`ON DELETE CASCADE`**.
- `actionType`, `fromStatus`/`toStatus` (plain strings, not FK), `comment`, `actedBy` (nullable FK).
- No unique constraint; append-only audit log.

## RevisionWorkingNote — table `revision_working_notes`
`entity/RevisionWorkingNote.java`
- `revision_id` NOT NULL FK (`optional=false`); `noteText` (TEXT NOT NULL); `workflowStage`; `createdBy` (NOT NULL FK); `createdAt` (NOT NULL).
- **Soft-delete**: `deletedBy` (nullable FK) / `deletedAt` (nullable) — the **only** entity in the traced set using soft-delete. No `@Version`, no `updated_at` — a note is created once and only ever soft-deleted, never edited.

## RevisionSnapshotHistory — table `revision_snapshot_history`
- `revision_id` NOT NULL FK (`optional=false`); `reviewRound` (int NOT NULL); `objectKey`; `versionId`; `checksum`; `sourceChecksum` (checksum of the locked source used to produce the snapshot); `generationRequestId` (UUID, async correlation); `triggerAction`; `generatedAt`; `generatedBy`. Append-only, immutable provenance per snapshot regeneration.

## RevisionPublishingMetadata — table `revision_publishing_metadata`
- `revision_id` — **`@OneToOne`, NOT NULL, UNIQUE** — true 1:1.
- `publishingTemplate` (nullable FK) + `publishingTemplateVersion` (snapshot of template version at selection time).
- Preview block: `selectedPublishingLayout`, `publishingPreviewPdfPath/Checksum/VersionId`, `conversionEngine`, `previewGeneratedAt/By`.
- Published block: `publishedPdfPath/Checksum/VersionId`, `publishedAt`, `publishedBy`.

## DocumentRevisionTemplateLineage — table `document_revision_template_lineage`
- `targetRevision` — **`@OneToOne`, NOT NULL, UNIQUE**.
- `sourceTemplateDocument` / `sourceTemplateRevision` — NOT NULL FKs (3-way link between new revision and the template revision it originated from).
- Denormalized/immutable snapshot: `sourceTemplateRevisionNumber`, `sourceFileChecksum`, `sourceStorageProvider/Bucket/ObjectKey/VersionId`, `targetFileChecksum`, `placeholderSnapshot` (jsonb).
- `selectedBy` (NOT NULL FK), `selectedAt`, `createdAt`. Source comment claims DB triggers protect this row post-insert — **exact migration not verified this pass** (`V363__harden_controlled_document_templates.sql` is a plausible candidate by name, not opened — UNKNOWN).

## ControlledCopyEvidenceFile — table `controlled_copy_evidence_files`
- `controlled_copy_id` NOT NULL FK — **confirmed `ON DELETE RESTRICT`** per `V337__preserve_controlled_copy_evidence_on_delete.sql`, which explicitly drops any pre-existing `ON DELETE CASCADE` variant of this FK and replaces it with RESTRICT. Migration comment: "Controlled-copy evidence is GMP-relevant evidence and must not disappear implicitly when a controlled-copy row is removed. Force an explicit referential-integrity failure instead of cascading the evidence rows." **This is the single strongest direct schema-level evidence of the "never delete GMP records" principle actually being enforced at the DB level** — everywhere else it's a code-level convention only.
- Original + watermarked file pairs: `fileName/contentType/fileSize/storedPath` (working copy) vs. `originalFileName/originalContentType/originalFileSize/originalStoredPath/originalSha256` (source upload) plus `watermarkedSha256`/`watermarked` — retains both pre- and post-watermark checksums for traceability.

## Reference / lookup entities
- **DocumentType** (`document_types`): `shortCode`/`name` (both unique), `currentSequence` (document-numbering counter), `active` (boolean, default true — deactivates *future use*, does not soft-delete existing referencing rows).
- **DocumentSubType** (`document_sub_types`): `documentType` (NOT NULL FK), `reviewRequirement` (source-of-truth for the snapshot pattern above), `active` (same caveat).
- **DocumentStatusDefinition / RevisionStatusDefinition / ControlledCopyStatusDefinition**: identical shape — `code` (PK), `label` (unique), `sortOrder`, `terminal` (`is_terminal`). Source comments state these are code/migration-owned fixed vocabularies, admin-configurable for actor/permission/scope/SoD/policy but not for CRUD add/rename/delete — **this is stated as an architectural convention only; no DB-level constraint (trigger/REVOKE) was found enforcing it.**
- **ControlledCopyExpiryLimit**: `documentType`/`department` (nullable, wildcard-scoping), `durationValue`/`durationUnit`, `active`, `isSystem`. `createdBy`/`updatedBy` are **raw UUID columns, not FK-mapped** to UserAccount — UNKNOWN if intentional.
- **ControlledCopyPlaceholderField**: `fieldKey` (unique), `label`, `description`, `active`.
- **ControlledCopyPolicySetting**: singleton row (fixed id `00000000-0000-0000-0000-000000000201`) — boolean toggles for distribution/security/recall policy (allowEmailDistribution, allowDownload, allowPrint, downloadOnce, printOnce, watermarkEnabled + 4 watermark-content flags, allowManualRecall, allowReportLostDamaged, allowReplacementForLostDamaged, redirectDeliveryToDco/dcoRecipientUserId).
- **ControlledCopyBatchStatusDiscrepancy**: `batch` (NOT NULL FK), `batchNumber`, `expectedStatusCode`/`actualStatusCode` (plain strings), `status` (`STATUS_OPEN`/`STATUS_RESOLVED`), `detectedAt`/`lastCheckedAt`/`resolvedAt` — open/resolved workflow, not delete-based.

## Delete-strategy summary (cross-entity)
| Pattern | Entities |
|---|---|
| No delete mechanism observed at all (pure accumulate) | ControlledCopyRecord, DocumentRevisionRecord, RevisionWorkflowHistory, RevisionSnapshotHistory, DocumentRevisionTemplateLineage, ControlledCopyDistributionJob/JobItem |
| Soft-delete flag present | **RevisionWorkingNote only** (`deletedBy`/`deletedAt`) |
| DB-level `ON DELETE CASCADE` present (structural; no observed app code exercising a parent delete) | `document_revisions.document_id`, `document_relations.source/target_document_id`, `document_workflow_participants.document_id/.user_id`, `revision_workflow_participants.revision_id/.user_id`, `revision_workflow_history.revision_id` |
| DB-level cascade explicitly removed/hardened to RESTRICT for evidentiary integrity | `controlled_copy_evidence_files.controlled_copy_id` (V337, explicit GMP-evidence rationale) |
| No `@OneToMany` with `orphanRemoval`/`CascadeType.REMOVE` found anywhere reviewed | Confirmed for `ControlledCopyDistributionBatch.copies` (the only mapped `@OneToMany` collection encountered) |

**QF cross-check**: QF states "The system shouldn't enable the deletion of records from any state." No application code path performing a hard delete of Document/Revision/Controlled Copy was found in this pass (`QF-MATCH` on observed behavior). However, the schema itself still carries `ON DELETE CASCADE` on several FKs from the original 2024-era migrations (`V6`–`V9`) that were never hardened the way `controlled_copy_evidence_files` was in `V337` — meaning a hard delete of a `documents` row, if ever issued outside the application (e.g., direct DB/DBA action), would still cascade away Revisions, Participants, and Relations. This is a **structural risk, not a demonstrated application-level violation** — flagged in `21-known-unknowns-conflicts.md` as a candidate hardening item, not a defect (no code path exercises it).
