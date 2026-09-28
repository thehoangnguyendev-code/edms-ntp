# 04 — Domain Model (AS-IS, conceptual)

Evidence: direct entity-class trace (see `05-data-model.md` for field-level detail and migration citations).

## Core lifecycle chain
- **Document** (`DocumentRecord`, table `documents`) is the master/header record. 1 Document → N **DocumentRevision** (`DocumentRevisionRecord`, table `document_revisions`) via `document_revisions.document_id`. Per the origin migration's backfill, a Document never exists without at least one Revision.
- **DocumentRevision** is self-referential via `parentRevision` (`document_revisions.parent_revision_id → document_revisions.id`, `ON DELETE SET NULL`) — links a new revision to the prior one it supersedes (linear history in practice, structurally allows a tree).
- **DocumentRevision** 1 → N **ControlledCopy** (`ControlledCopyRecord`, table `controlled_copies`) via `revision_id`; a ControlledCopy also carries its own `document_id` back-reference (denormalized redundancy alongside the Document→Revision→ControlledCopy FK path).
- **ControlledCopy** is self-referential via `replacedControlledCopy` (`controlled_copies.replaced_controlled_copy_id → controlled_copies.id`) — set only on the *new* record created by a Reissue ("replace Lost/Damaged") action, pointing back at the original. The reverse lookup (find the replacement for an original) is not a mapped relationship, only a repository query.

## Distribution batching
- **ControlledCopyDistributionBatch** groups multiple Controlled Copy requests raised together for one Document/Revision. 1 Batch → N ControlledCopy via `controlled_copies.distribution_batch_id` (nullable — not every copy belongs to a batch).
- **ControlledCopyDistributionJob** is an async unit-of-work for one batch action (distribute/recall/cancel): N Jobs → 1 Batch.
- **ControlledCopyDistributionJobItem** is one per-copy line item within a Job: N Items → 1 Job, each referencing exactly one ControlledCopy.
- **ControlledCopyBatchStatusDiscrepancy** is an alert/log entity (not a correction mechanism) referencing one Batch when its stored status disagrees with the status derived from member copies — for manual QA review only, by explicit design (see `08-state-machines.md` §8.4.3).

## Workflow participants and history
- **Document** 1 → N **DocumentWorkflowParticipant** — role assignments scoped to the Document header, each referencing one **UserAccount**.
- **DocumentRevision** 1 → N **RevisionWorkflowParticipant** — per-revision role instantiation, carrying `actionStatus`/`actedAt`/`signatureSessionId` (this is where the e-signature linkage lives at the revision level).
- **DocumentRevision** 1 → N **RevisionWorkflowHistory** — append-only audit trail of `fromStatus`→`toStatus` transitions plus actor and comment.
- **DocumentRevision** 1 → N **RevisionWorkingNote** — free-text collaboration notes tied to a `workflowStage`; the **only** entity in the traced set using a soft-delete pattern (`deletedBy`/`deletedAt`) rather than hard delete or pure accumulation.
- **DocumentRevision** 1 → N **RevisionSnapshotHistory** — one row per generated review-snapshot PDF, correlating an async generation request to the storage object version it produced.
- **DocumentRevision** 1 → 1 **RevisionPublishingMetadata** — publishing-workspace state (selected template, preview/published PDF paths + checksums), plus a `@ManyToOne` to `PublishingTemplate`.
- **DocumentRevision** 1 → 1 **DocumentRevisionTemplateLineage** — immutable provenance record when a revision is created from a controlled-document template; also references the source template's Document and Revision (a 3-way link between the new revision and the template revision it originated from). DB triggers reportedly protect it post-insert (exact migration not verified this pass).

## Cross-document relationships
- **DocumentRelation** is a genuine association entity (own PK, own audit columns) between two Document rows: `sourceDocument`/`targetDocument`, both `ON DELETE CASCADE` to `documents.id`, plus a `relationType` discriminator string (related vs. correlated, corresponding to the `hasRelatedDocuments`/`hasCorrelatedDocuments` cached flags on Document/Revision). Unique on `(source_document_id, target_document_id, relation_type)`.

## Reference / lookup entities
- **DocumentType** and **DocumentSubType** (N→1 DocumentType) classify documents; DocumentSubType carries the `reviewRequirement` policy value **snapshotted** onto each `DocumentRevisionRecord` at creation time (not joined live — see `05` for the exact `IMPLEMENTATION-DISCOVERED` snapshot pattern).
- **DocumentStatusDefinition / RevisionStatusDefinition / ControlledCopyStatusDefinition** are parallel fixed lifecycle-code lookup tables. Document and Revision status are FK-enforced against these; **Controlled Copy status is NOT FK-enforced** (confirmed structurally, see `05`) — this asymmetry is the root cause of the discrepancy-scanner's existence.
- **ControlledCopyExpiryLimit**, **ControlledCopyPlaceholderField**, **ControlledCopyPolicySetting** are configuration entities (max expiry per DocumentType/Department, admin-defined cover-page placeholders, and a singleton policy-toggle row), not transactional data.
- **ControlledCopyEvidenceFile** (N→1 ControlledCopyRecord) holds uploaded evidence (e.g., destruction witness photo); explicitly protected from cascade delete at the DB level (see `05` — the strongest direct schema-level evidence of the "never delete GMP records" principle).

## Relationship diagram (prose ER)
```
DocumentType ──< DocumentSubType
DocumentType, BusinessUnit, Department, UserAccount(author/owner) ──< DocumentRecord
DocumentRecord ──< DocumentRevisionRecord >── DocumentRevisionRecord (parentRevision, self-ref)
DocumentRecord ──< DocumentWorkflowParticipant >── UserAccount
DocumentRecord ══ DocumentRecord (DocumentRelation: source/target, self-referential via join entity)
DocumentRevisionRecord ──< RevisionWorkflowParticipant >── UserAccount
DocumentRevisionRecord ──< RevisionWorkflowHistory
DocumentRevisionRecord ──< RevisionWorkingNote  (soft-delete)
DocumentRevisionRecord ──< RevisionSnapshotHistory
DocumentRevisionRecord ──1 RevisionPublishingMetadata ──> PublishingTemplate
DocumentRevisionRecord ──1 DocumentRevisionTemplateLineage ──> (source template Document + Revision)
DocumentRevisionRecord ──< ControlledCopyRecord >── ControlledCopyRecord (replacedControlledCopy, self-ref)
ControlledCopyRecord >── ControlledCopyDistributionBatch ──< ControlledCopyDistributionJob ──< ControlledCopyDistributionJobItem >── ControlledCopyRecord
ControlledCopyDistributionBatch ──< ControlledCopyBatchStatusDiscrepancy
ControlledCopyRecord ──< ControlledCopyEvidenceFile   (RESTRICT on delete — hardened, V337)
```

See `05-data-model.md` for exact column names, constraints, cascade rules, and citations.
