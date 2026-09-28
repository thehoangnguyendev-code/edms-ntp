# 09 — Business Rule Catalog (AS-IS)

Extracted from `06-role-authorization-model.md`, `08-state-machines.md`, `10-hidden-implementation-rules.md`, `12`–`19`, `20-ui-api-service-mapping.md`. Each rule cites its confirming section rather than re-deriving evidence. Confidence is High where a rule was directly observed in code by at least one trace pass; Medium where confirmed but with a narrower/partial read; Low where inferred from adjacent evidence. Suspected gaps are recorded as gaps (`IMPLEMENTATION-GAP`/`UNKNOWN`), never rewritten as if they were intended rules.

## Document (BR-DOC)

**BR-DOC-001** — Lifecycle / High
IF a Document is created THEN it starts in status `DRAFT`.
Applies to: Document. Source: WF-DOC-01. QF: `QF-MATCH`. Evidence: `DocumentService.createDocumentDraft`, `08` §8.1.

**BR-DOC-002** — Validation / High
WHEN updating a Document's Sub-Type on an existing Draft, IF the request does not also supply `reviewerUserIds` THEN the existing reviewer list is re-validated against the new Sub-Type's review requirement, and the save fails if inconsistent.
Applies to: Document (Draft). Source: WF-DOC-02. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `DocumentService.updateDocumentDraft`, `08` §8.5.

**BR-DOC-003** — Data integrity / High
IF a Document is flagged as a Template THEN `requiresTraining` cannot be re-enabled while `ACTIVE`, even via direct request — it is forcibly nulled/false.
Applies to: Document (template). Source: WF-DOC-03. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `DocumentService.updateActiveWorkflowConfiguration`, `08` §8.5.

**BR-DOC-004** — Lifecycle / High
WHEN a user requests to Cancel a Document, IF the Document has **any** Revision of any status THEN the Cancel action is rejected (`IllegalStateException`) — Cancel is permitted only when zero Revisions exist.
Applies to: Document. Source: WF-DOC-04. QF: `IMPLEMENTATION-DISCOVERED` (precondition specificity beyond QF's text). Evidence: `DocumentService.cancelDocument`, `08` §8.2.

**BR-DOC-005** — Signature / High
WHEN a Document is Cancelled THEN no electronic signature is required.
Applies to: Document. Source: WF-DOC-04. QF: `QF-MATCH`. Evidence: `08` §8.2.

**BR-DOC-006** — Lifecycle / High
WHEN a user requests to Obsolete a Document, THEN the Document must currently be `ACTIVE`, must have an `EFFECTIVE` Revision, and must have no Revision in an in-progress status (`DRAFT`/`PENDING_REVIEW`/`PENDING_APPROVAL`/`PENDING_TRAINING`/`READY_FOR_PUBLISHING`) — otherwise the action is rejected.
Applies to: Document. Source: WF-DOC-05. QF: `QF-MATCH`. Evidence: `DocumentService.obsoleteDocument`, `08` §8.3.

**BR-DOC-007** — Signature / High
WHEN a Document is Obsoleted THEN a valid electronic signature (meaning `OBSOLETED`) is mandatory and is persisted as an `ElectronicSignature` row.
Applies to: Document. Source: WF-DOC-05. QF: `QF-MATCH`. Evidence: `08` §8.3, `16`.

**BR-DOC-008** — Lifecycle (cascade) / High
WHEN a Document is Obsoleted THEN every Revision of that Document not already in a terminal status (`OBSOLETED`/`CLOSED_CANCELLED`) is automatically transitioned to `OBSOLETED`, in the same transaction.
Applies to: Document → Revision. Source: WF-DOC-05, BR-REV-014. QF: `QF-MATCH` (BR_DOC02). Evidence: `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete`, `08` §8.3, `11-cross-workflow-dependencies.md`.

**BR-DOC-009** — Lifecycle (cascade) / High
WHEN a Document is Obsoleted THEN every Controlled Copy of that Document currently in `DISTRIBUTED` or `READY_FOR_DISTRIBUTION` is automatically transitioned to `OBSOLETED` with reason `DOCUMENT_OBSOLETED`, in the same transaction, **via a code path independent from the Revision-level Controlled-Copy-obsolete cascade** (see BR-CC-013).
Applies to: Document → Controlled Copy. Source: WF-DOC-05. QF: `QF-MATCH` on outcome. Evidence: `DocumentService.obsoleteDocument` (inline loop), `08` §8.3/§8.4c, `11`. **Divergence-risk flag**: two independent implementations exist for conceptually the same cascade — see BR-CC-013 and `11`.

**BR-DOC-010** — Concurrency / Medium
The Document Obsolete action's initial `fromStatus=="ACTIVE"` check and its final save are separated by several intervening reads/writes within the same transaction, protected only by `@Version` optimistic locking on the Document row — no explicit re-fetch/re-check pattern (unlike the Controlled Copy batch async paths) was found guarding this window.
Applies to: Document. Source: `12-transaction-concurrency.md`. QF: `UNKNOWN`/not addressed by QF. Confidence: Medium (a TOCTOU window is structurally present; whether it is exploitable in practice was not proven). Evidence: `08` §8.3, `12`.

## Document Revision (BR-REV)

**BR-REV-001** — Lifecycle / High
IF a Document Revision is uploaded THEN it starts in status `DRAFT`, and the parent Document is progressed to (or confirmed) `ACTIVE`.
Applies to: Revision, Document. Source: WF-REV-01. QF: `QF-MATCH` (BR_DOCR01). Evidence: `08` §8.1, `08` §8.4b; exact upload-vs-submit trigger timing `UNKNOWN` (`21`).

**BR-REV-002** — Data integrity / High
A Revision's `reviewRequirement` is a **snapshot** of its Document Sub-Type's review policy taken at Revision-creation time; it is never recomputed for an in-flight Revision even if the Sub-Type's policy later changes.
Applies to: Revision. Source: `05-data-model.md`. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `entity/DocumentRevisionRecord.reviewRequirement`, `05`.

**BR-REV-003** — Validation / High
WHEN a source file is uploaded for a Revision THEN it must pass extension allowlisting (`.docx`), ZIP magic-byte verification, OOXML structural validation (entry-count and size zip-bomb guards, path-traversal/duplicate-entry rejection), an unsafe-content blocklist (VBA macros, ActiveX, embeddings, custom UI), XXE-hardened XML parsing, and a malware scan — rejection is fail-closed if the malware scanner is itself unavailable.
Applies to: Revision (source file). Source: WF-REV-01. QF: `IMPLEMENTATION-DISCOVERED` (QF does not specify this level of validation). Evidence: `RevisionUploadFileValidator`, `17-file-storage.md`.

**BR-REV-004** — Authorization / High
WHEN a Co-Author attempts to upload/replace a Revision's controlled source file THEN the action is denied — only the Author may upload/replace the source; Co-Authors may edit online but not replace the source artifact.
Applies to: Revision. Source: `06-role-authorization-model.md` §6.3. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `DocumentAuthorizationService.canUploadRevisionSource`.

**BR-REV-005** — Signature / High
WHEN Complete Editing is performed on a `DRAFT` Revision THEN an electronic signature (meaning `PREPARED`) is required, and the source file becomes locked (`sourceLocked=true`).
Applies to: Revision. Source: WF-REV-02. QF: `QF-MATCH`. Evidence: `08` §8.4b, `16`.

**BR-REV-006** — Lifecycle / High
WHEN Submit for Review is performed THEN the Revision must already hold a `PREPARED` signature and have `sourceLocked=true`; the target status is computed from the presence of assigned Reviewers/Approvers/training requirement (`PENDING_REVIEW` if Reviewers exist, else `PENDING_APPROVAL`, else onward).
Applies to: Revision. Source: WF-REV-03. QF: `QF-MATCH`. Evidence: `08` §8.4b.

**BR-REV-007** — Authorization (concurrency) / High
WHEN multiple Reviewers (or Approvers) are assigned to a Revision THEN only the participant currently first-in-sequence with a `PENDING` action status may act — later-sequenced participants are denied until earlier ones complete, re-checked live at the moment of each action attempt (not just at initial page load).
Applies to: Revision. Source: WF-REV-04/06. QF: `QF-DEVIATION`/possibly `QF-MATCH` (QF workflow diagrams were images, not text-extracted — sequencing strictness not confirmable against QF text). Evidence: `RevisionWorkflowAuthorizationService.isPendingReviewer/isPendingApprover`, `RevisionService.requirePendingParticipant`, `06` §6.3, `12`.

**BR-REV-008** — UI/frontend / Medium
The frontend does not independently re-implement the Reviewer/Approver FIFO sequencing rule — it defers entirely to a server-computed capability decision. A client-side capability cache (5 seconds) can transiently display a stale "allowed" state to a second-in-sequence actor, but the backend still enforces BR-REV-007 on the actual mutation attempt.
Applies to: Revision (frontend). Source: `20-ui-api-service-mapping.md` item 5. QF: not addressed. Confidence: Medium (cache TTL and behavior confirmed; real-world race-window frequency not measured).

**BR-REV-009** — Lifecycle / High
WHEN a Reviewer or Approver Rejects THEN the Revision returns to `DRAFT`, both the Reviewer and Approver participant action states are reset to `PENDING` (not just the rejecting role's), the source file is unlocked, and the Office Online working copy is reopened.
Applies to: Revision. Source: WF-REV-05/07. QF: `QF-MATCH` on the Draft-return outcome; the "reset both roles" detail is `IMPLEMENTATION-DISCOVERED`. Evidence: `08` §8.4b.

**BR-REV-010** — Signature / High
WHEN a Reviewer or Approver Rejects THEN an electronic signature (meaning `REJECTED`) is required.
Applies to: Revision. Source: WF-REV-05/07. QF: `QF-MATCH`. Evidence: `08` §8.4b, `16`.

**BR-REV-011** — Authorization / Medium
WHEN `DocumentWorkflowSetting.reviewerNoApprove` is enabled for a Document THEN the same person who reviewed a Revision cannot also approve it; this is a site-wide configurable toggle, not a hardwired rule.
Applies to: Revision, Document config. Source: WF-REV-06. QF: not addressed. Confidence: Medium (the toggle's effect is confirmed; enforcement call site for the broader `DocumentWorkflowSetting` SoD flag family beyond this one is `UNKNOWN` — `21`). Evidence: `RevisionService.completeApproval`.

**BR-REV-012** — Lifecycle / High
WHEN Training Complete is performed THEN `revision.requiresTraining` must be true, `trainingCompletionDate >= trainingPlannedDate`, and the Revision transitions to `READY_FOR_PUBLISHING`.
Applies to: Revision. Source: WF-REV-08. QF: `QF-MATCH` (BR_TRG07). Evidence: `08` §8.4b.

**BR-REV-013** — Lifecycle / High
WHEN Publish is performed on a `READY_FOR_PUBLISHING` Revision THEN it transitions to `EFFECTIVE`; the parent Document is set/confirmed `ACTIVE`; an electronic signature (meaning `PUBLISHED`) is mandatory.
Applies to: Revision, Document. Source: WF-REV-09. QF: `QF-MATCH`. Evidence: `08` §8.4b, `16`.

**BR-REV-014** — Lifecycle (cascade) / High
WHEN a Revision is Published to `EFFECTIVE` THEN every **other** Revision of the same Document still marked `EFFECTIVE` (normally at most one) is automatically transitioned to `OBSOLETED` in the same transaction, and that superseded Revision's `DISTRIBUTED`/`READY_FOR_DISTRIBUTION` Controlled Copies are automatically transitioned to `OBSOLETED` with reason `NEW_REVISION_PUBLISHED`.
Applies to: Revision → Revision → Controlled Copy. Source: WF-REV-09, WF-REV-12. QF: `QF-MATCH` (BR_DOCR02/BR_DOCR16). Evidence: `RevisionService.publishRevisionRecord`, `08` §8.4b–8.4c, `11`.

**BR-REV-015** — Validation / High
WHEN Publish is requested and any Related Document lacks an `EFFECTIVE` Revision THEN Publish is blocked (`RelatedDocumentsNotEffectiveException`) **unless** the actor holds `documents.revision.force_publish` and supplies a non-blank override reason, in which case the action proceeds and is separately audited as `WARNING_OVERRIDE`.
Applies to: Revision. Source: WF-REV-09. QF: `IMPLEMENTATION-DISCOVERED` (not present in QF text). Evidence: `08` §8.4b.

**BR-REV-016** — Lifecycle / High
WHEN Cancel is requested on a Revision THEN it is permitted **only** while the Revision is `DRAFT`; a mandatory cancel reason and an electronic signature (meaning `CANCELLED`) are required; if this was the Document's only/last Revision, the parent Document may be auto-closed.
Applies to: Revision, Document. Source: WF-REV-10. QF: `QF-MATCH`. Evidence: `08` §8.4b, `11`.

**BR-REV-017** — Lifecycle / High
WHEN Upgrade Revision is performed on an `EFFECTIVE` Revision THEN a brand-new `DRAFT` Revision row is created (linked via `parentRevision`), and the source `EFFECTIVE` Revision is **not** itself modified — it remains `EFFECTIVE` until superseded later by BR-REV-014 at the new revision's eventual publish.
Applies to: Revision. Source: WF-REV-11. QF: `QF-MATCH`. Evidence: `08` §8.4b.

**BR-REV-018** — Concurrency / High
WHEN a second Upgrade Revision is attempted for a Document that already has an in-progress Revision THEN it is rejected (`ensureNoRevisionInProgress`).
Applies to: Revision, Document. Source: WF-REV-11. QF: not addressed. Evidence: `08` §8.4b.

**BR-REV-019** — Lifecycle (gap) / High
A direct, standalone "Obsolete this one Revision" user action does **not exist** on either the backend (the `OBSOLETE` workflow action and the `updateRevisionStatus`/`OBSOLETED` branch are both fully specified but have zero callers; no `/obsolete` endpoint exists on `RevisionController`) or the frontend (no such UI element found). Revision obsolescence only ever occurs as a side effect of BR-REV-014 (publish-supersede) or BR-DOC-008 (parent Document obsolete).
Applies to: Revision. Source: WF-REV-12. QF: `UNKNOWN` (cannot determine if this was intentionally never built or removed). Evidence: `08` §8.4c, `20` item 2, `21` (Decision Log candidate #2).

**BR-REV-020** — Error handling (gap) / Medium
WHEN the synchronous publishing-preview PDF regeneration (`regeneratePublishingSnapshotIfConfigured`) fails during a workflow transition (submit/review/approve/training/regenerate) THEN the exception is caught and logged (`log.warn`) only — the workflow transition itself still succeeds, with no user-visible failure or retry for the PDF step.
Applies to: Revision. Source: WF-REV-03/04/06/08. QF: not addressed. Confidence: Medium (confirmed as written; whether this has caused a real missing-PDF incident is unverified). Evidence: `08` §8.4d, `21` (Decision Log candidate #3).

**BR-REV-021** — Authorization (gap) / High
`uploadRevisionFile` is authorized via legacy permission helpers (`requireCurrentUserCanUploadRevision`, `requireRevisionFileAccess`) rather than the hybrid `RevisionWorkflowAuthorizationService`/`UPLOAD_SOURCE` workflow action that is otherwise defined for exactly this purpose.
Applies to: Revision. Source: WF-REV-01. QF: not addressed. Evidence: `08` §8.4d, `21` (Decision Log candidate #4).

## Controlled Copy (BR-CC)

**BR-CC-001** — Lifecycle / High
A Controlled Copy has exactly four confirmed lifecycle states: `READY_FOR_DISTRIBUTION`, `DISTRIBUTED`, `OBSOLETED`, `CLOSED_CANCELLED`.
Applies to: Controlled Copy. Source: WF-CC-01–06. QF: `QF-MATCH`. Evidence: `08` §8.4, `05`.

**BR-CC-002** — Data integrity / High
Controlled Copy `status`/`statusCode` are plain string columns, **not FK-enforced** against the `controlled_copy_statuses` lookup table (unlike Document/Revision status, which are FK-joined).
Applies to: Controlled Copy. Source: `05-data-model.md`. QF: not addressed. Evidence: `entity/ControlledCopyRecord`, `05`, `08` §8.4.3b.

**BR-CC-003** — Lifecycle / High
WHEN a Controlled Copy is requested THEN the source Revision must be `EFFECTIVE` and have a rendered PDF; the copy is created at `READY_FOR_DISTRIBUTION`; an electronic signature (meaning `CONTROLLED_COPY_REQUESTED`) is recorded once per batch, not per copy.
Applies to: Controlled Copy. Source: WF-CC-01. QF: `QF-MATCH`. Evidence: `08` §8.4, `16`.

**BR-CC-004** — Validation / High
WHEN distributing a Controlled Copy THEN a non-blank comment is mandatory.
Applies to: Controlled Copy. Source: WF-CC-02. QF: `QF-MATCH`. Evidence: `08` §8.4.

**BR-CC-005** — Lifecycle / High
IF a Controlled Copy is already `DISTRIBUTED` THEN it can **never** be Cancelled — batch-cancel silently filters such copies out as ineligible rather than failing the whole batch request; single-copy cancel is rejected outright.
Applies to: Controlled Copy. Source: WF-CC-03. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `08` §8.4.

**BR-CC-006** — Lifecycle / High
Recall is permitted only from `DISTRIBUTED` (or, for a batch, `DISTRIBUTED`/`OBSOLETED`); a non-blank recall reason is mandatory.
Applies to: Controlled Copy. Source: WF-CC-04. QF: `QF-MATCH`. Evidence: `08` §8.4.

**BR-CC-007** — Concurrency (gap) / High
Recall's async per-copy finalization (`finalizeRecalledCopy`) performs **no terminal-state guard** before mutating, unlike Distribute's and Cancel's finalize methods — confirmed both in the backend trace and (independently) in the frontend trace, which does not compensate for the gap either.
Applies to: Controlled Copy. Source: WF-CC-04, WF-CC-08. QF: not addressed. Evidence: `08` §8.4, `12`, `20` item 6, `21` (Decision Log candidate #5).

**BR-CC-008** — Validation / High
Destroy/Report-Lost-or-Damaged requires the copy be currently `DISTRIBUTED`, requires an evidence file if the reason is "Damaged," and requires the destruction executor to differ from the witness.
Applies to: Controlled Copy. Source: WF-CC-05. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `08` §8.4.

**BR-CC-009** — Storage / High
Controlled Copy evidence files are stored with **both** an original and a (possibly watermarked) working-copy checksum retained, and the FK from evidence file to Controlled Copy is hardened to `ON DELETE RESTRICT` (explicitly changed from an earlier `CASCADE`) specifically to prevent evidence from disappearing if the copy row were ever removed.
Applies to: Controlled Copy evidence. Source: WF-CC-05. QF: not addressed. Evidence: `entity/ControlledCopyEvidenceFile`, migration `V337`, `05`, `17`.

**BR-CC-010** — Lifecycle / High
Reissue (Replace Lost/Damaged) creates a **new** Controlled Copy record rather than mutating the original; the original is left untouched (still `OBSOLETED`); the link is one-directional (new→original via `replacedControlledCopy`), with no mapped reverse relationship.
Applies to: Controlled Copy. Source: WF-CC-06. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `08` §8.4, `05`.

**BR-CC-011** — Lifecycle (scheduled) / High
WHEN a Controlled Copy's `expiryDate` has passed AND it is still `DISTRIBUTED` THEN a daily scheduled job (02:00, distributed-lock-protected) automatically transitions it to `OBSOLETED` with reason `EXPIRED`.
Applies to: Controlled Copy. Source: WF-CC-07. QF: `QF-MATCH` on outcome. Evidence: `ControlledCopyExpiryScheduler`, `08` §8.4.

**BR-CC-012** — Notification (architectural inconsistency) / High
The 7-day expiry reminder email bypasses the `NotificationDispatcher` policy engine entirely (no recipient-rule resolution, no quiet-hours/digest, not linked via the catalog's `controlled_copy.expiring_soon` event code), unlike every other confirmed notification trigger in the system.
Applies to: Controlled Copy. Source: WF-CC-07. QF: not addressed. Evidence: `08` §8.4, `14`, `21` (Decision Log candidate #7, partial).

**BR-CC-013** — Lifecycle (cascade, duplication risk) / High
WHEN the source Revision of a Controlled Copy becomes `OBSOLETED` (via publish-supersede, BR-REV-014, or via the parent Document's obsolete cascade, BR-DOC-009) THEN the Controlled Copy transitions to `OBSOLETED` too, **but this cascade is implemented via two independent code paths depending on the trigger**: `RevisionService.obsoleteDistributedControlledCopies` (used for publish-supersede) vs. a separate inline loop in `DocumentService.obsoleteDocument` (used for document-level obsolete). Both apply the same net effect (Distributed/Ready-for-Distribution copies → Obsoleted) but are not the same call — a change to one path's logic would not automatically apply to the other.
Applies to: Controlled Copy. Source: WF-DOC-05, WF-REV-09, WF-REV-12. QF: `QF-MATCH` on outcome (BR_CON02). Evidence: `08` §8.4c, `11-cross-workflow-dependencies.md`, `21` (Decision Log candidate #1). **This is documented as a divergence-risk, not asserted as a defect — no evidence of actually inconsistent behavior between the two paths was found.**

**BR-CC-014** — Concurrency / High
Batch Distribute/Cancel/Recall status flips synchronously at request time; per-copy finalization work runs asynchronously after commit, always re-fetching each copy fresh from the database (never operating on an in-memory snapshot).
Applies to: Controlled Copy batch. Source: WF-CC-08. QF: not addressed. Evidence: `08` §8.4, `12`, `13`.

**BR-CC-015** — Error handling / High
On an `OptimisticLockingFailureException` during async batch finalization, the system re-checks who won the race via a **brand-new transaction** rather than trusting cached state, retries up to 3 times with linear backoff (250ms, 500ms) — the only such retry pattern anywhere in the codebase.
Applies to: Controlled Copy batch. Source: WF-CC-08. QF: not addressed. Evidence: `12`, `19`.

**BR-CC-016** — Recovery / High
Batch jobs left `PENDING` after a backend restart are automatically resumed by a `resumePendingJobs()` scheduler (confirmed present and identically shaped for all three batch action types: Distribute, Cancel, Recall), using an atomic DB claim to avoid duplicate processing across instances.
Applies to: Controlled Copy batch. Source: WF-CC-08. QF: not addressed. Evidence: `13`, `19`.

**BR-CC-017** — Notification (gap) / Medium
No confirmed live trigger exists for a "Controlled Copy Request → Document coordinator" notification, despite this being in QF's notification table and the catalog having no matching event code either.
Applies to: Controlled Copy. Source: WF-CC-01. QF: `IMPLEMENTATION-GAP`. Confidence: Medium (absence-of-evidence, not exhaustively proven absent across the whole codebase). Evidence: `14`, `21`.

## Authorization (BR-AUTH)

**BR-AUTH-001** — Authorization (architecture) / High
Authorization is driven by a DB-backed permission-code + policy-engine model, not a fixed role table; `WorkflowRole` names (e.g. "DCO", "Author") are descriptive/assignable metadata only and do not themselves grant access.
Applies to: all workflows. Source: `06-role-authorization-model.md` §6.0. QF: `QF-DEVIATION` (architecture). Evidence: `06` §6.0.

**BR-AUTH-002** — Authorization / High
Reviewer/Approver actions are gated by strict FIFO sequence order per BR-REV-007, re-checked live at the moment of each action attempt, independent of and in addition to optimistic locking.
Applies to: Revision. Source: `06` §6.3. QF: `QF-DEVIATION`/possibly `QF-MATCH`, unresolved (see BR-REV-007). Evidence: `06` §6.3.

**BR-AUTH-003** — Authorization / High
SYSTEM_SUPER_ADMIN is **not** exempt from Controlled Copy authorization/SoD checks — it must hold the required permission like any other user.
Applies to: Controlled Copy; other modules `UNKNOWN`. Source: `06` §6.3. QF: `IMPLEMENTATION-DISCOVERED` (stricter than a naive "Admin = full access" reading). Evidence: `ControlledCopyAuthorizationService.evaluateInternal`, `21` item 3.

**BR-AUTH-004** — Authorization / High
Controlled Copy anonymous/portal preview and download access is governed entirely by possession of a copy-specific access token plus a separately issued preview password — no EQMS login or permission check applies on this path.
Applies to: Controlled Copy (external access). Source: `06` §6.3. QF: `IMPLEMENTATION-DISCOVERED`. Evidence: `06` §6.3.

**BR-AUTH-005** — Data integrity (SoD) / High
Segregation-of-Duties conflicts are modeled as admin-configurable permission-code pairs (not fixed role pairs), scanned for violations both at the single-Access-Profile level and at the combined-multiple-profiles-per-user level.
Applies to: all workflows. Source: `06` §6.6. QF: `QF-DEVIATION` (architecture, more general than QF's implied fixed model). Evidence: `SodConstraint`/`SodConstraintService`, `06` §6.6.

## Signature (BR-SIG)

**BR-SIG-001** — Signature / High
Electronic signatures are captured via password re-entry only (`AUTHENTICATION_METHOD="PASSWORD"`, hardcoded, never configurable) — no separate PIN or MFA challenge is used as the signing mechanism.
Applies to: all e-signed actions. Source: `16-electronic-signature.md`. QF: `UNKNOWN`/interpretation-dependent re: 21 CFR 11.200(a). Evidence: `AuthService.verifySignature`, `ElectronicSignatureService`, `16`, `21` (Decision Log candidate #9).

**BR-SIG-002** — Signature / High
`MFA_DISABLED=true` is hardcoded in `AuthService`; MFA/OTP is currently bypassed system-wide though the underlying OTP mechanism is fully built and reachable if the flag were flipped.
Applies to: authentication, e-signature component. Source: `16`. QF: not addressed. Evidence: `AuthService`, `16`, `21` (Decision Log candidate #10).

**BR-SIG-003** — Signature / High
A signature token is single-use: replaying the same token in a different transaction is rejected via a database primary-key/unique constraint on the consumed-token record; the same token used twice within one logical action (same transaction) is treated as idempotent, not a replay.
Applies to: all e-signed actions. Source: `16`. QF: `QF-MATCH` (11.70 uniqueness intent). Evidence: `SignatureTokenConsumptionService`, `16`.

**BR-SIG-004** — Signature (gap, self-acknowledged) / Medium
A signature token issued for the Publishing Workspace's async accept-then-sign-later flow can still expire or be invalidated during a long queue wait or a backend restart before the async worker consumes it — an acknowledged, "tracked separately" residual gap per the code's own comments, not independently discovered.
Applies to: Publishing Workspace signing flow. Source: `16`. QF: not addressed. Confidence: Medium (self-acknowledged in code; not independently re-verified as still open in this pass). Evidence: `16`, `21` item 16.

**BR-SIG-005** — Signature / High
A Revision signature additionally captures a before/after document checksum and source-file-version id, binding the signature to the exact file content signed at that moment.
Applies to: Revision e-signatures. Source: `16`. QF: `QF-MATCH`-and-beyond (11.70). Evidence: `ElectronicSignatureService.createRevisionSignature`, `16`.

## Audit (BR-AUD)

**BR-AUD-001** — Audit / High
Every audit log row captures a snapshot of the actor's identity/role/department at write time (not a live FK join), so the record remains accurate even if the user's attributes change later.
Applies to: all audited actions. Source: `15-audit-trail.md`. QF: `QF-MATCH` (11.10(e)). Evidence: `AuditTrailService.persistAudit`, `15`.

**BR-AUD-002** — Audit (caveat) / High
No update/delete call site exists anywhere in the service layer for a persisted audit or e-signature row — audit/signature immutability in this system is **convention-based** (absence of callers), not enforced by a database trigger, constraint, or a repository interface that structurally omits delete.
Applies to: audit trail, electronic signatures. Source: `15`, `16`. QF: `QF-MATCH` at the application level; weaker than QF's DB-level framing would imply if read literally. Evidence: `15`, `16`, `21` item 20.

**BR-AUD-003** — Authorization (audit visibility) / High
Audit-trail read access is object-scoped, not merely role-gated: a Controlled Copy recipient can view that copy's own audit/signature history via a named-role match even without the global `audit.view` permission; a Document-scoped `documents.document.view_audit` permission is checked before falling back to the global permission.
Applies to: audit trail read access. Source: `15`. QF: `QF-MATCH` on intent; whether it precisely reduces to QF's "Receiver/View-Only sees only Published" rule is `UNKNOWN`. Evidence: `AuditTrailService.requireEntityAuditView`, `15`, `21` item 15.

**BR-AUD-004** — Audit / High
Exporting the audit trail requires a distinct `audit.export` permission and a valid, current-user-owned electronic signature token; the export itself is both signed (meaning `AUDIT_RECORD_EXPORTED`) and separately audit-logged.
Applies to: audit trail export. Source: `15`. QF: `QF-MATCH`-and-beyond. Evidence: `AuditTrailService.writeExport`, `15`.

## Notification (BR-NOTIF)

**BR-NOTIF-001** — Notification (gap) / Medium
No confirmed trigger exists for notifying an Author or Co-Author of their assignment to a Document/Revision, despite QF listing this as a required non-workflow notification.
Applies to: Document, Revision. Source: `14-notifications.md`. QF: `IMPLEMENTATION-GAP`. Confidence: Medium. Evidence: `14`, `21` (Decision Log candidate #8).

**BR-NOTIF-002** — Notification (gap) / High
The `document.periodic_review_due` event is defined in the notification catalog but has zero dispatch call sites anywhere in the codebase — Periodic Review reminders are not confirmed to fire.
Applies to: Document. Source: `14`. QF: `IMPLEMENTATION-GAP`. Evidence: `14`, `21`.

**BR-NOTIF-003** — Notification (gap) / High
No scheduler or dispatch call analogous to the Controlled Copy expiry reminder exists for a Document's Valid-Until 7-day/1-day reminder.
Applies to: Document. Source: `14`. QF: `IMPLEMENTATION-GAP`. Evidence: `14`, `21`.

**BR-NOTIF-004** — Notification / High
Mandatory (GMP) notification events always fire immediately on every enabled channel, bypassing recipient preference, quiet-hours, and digest settings; optional events respect those settings and may be deferred to an hourly digest flush.
Applies to: all policy-driven notifications. Source: `14`. QF: not addressed. Evidence: `NotificationDispatcher`, `14`.

## Storage (BR-STORAGE)

**BR-STORAGE-001** — Storage / High
MinIO-backed storage enforces GMP WORM compliance at the bucket level (Versioning + Object Lock in COMPLIANCE mode, configurable retention, default 5 years); deletion is unconditionally disabled at the code level (`delete()`/`deletePrefix()` always throw).
Applies to: all MinIO-stored files. Source: `17-file-storage.md`. QF: `QF-MATCH` (11.10(c)/(a), never-delete intent). Evidence: `MinioObjectStorageService`, `17`.

**BR-STORAGE-002** — Storage (misleading surface) / High
Several configurable "storage provider" options (AWS S3, Azure Blob, GCP, Google Drive, OneDrive, generic SharePoint, Dropbox) are simulated only — selecting them writes to a local directory rather than the named cloud service; no real SDK client exists for any of them.
Applies to: system storage configuration. Source: `17`. QF: not addressed. Evidence: `FileStorageService`, `17`, `21` (Decision Log candidate #6).

**BR-STORAGE-003** — Storage / High
Revision source files, review-round PDF renditions, and the final published PDF are stored at **distinct, never-overwritten object keys** — a revision's source is keyed by its immutable UUID (not its mutable revision number), and every review round's rendered snapshot gets its own key, backing the append-only `RevisionSnapshotHistory` audit trail.
Applies to: Revision file storage. Source: `17`. QF: `QF-MATCH`-and-beyond (11.10(c)). Evidence: `FileStorageService`, `17`.

**BR-STORAGE-004** — Concurrency (gap) / Medium
The Office Online/SharePoint sync worker overwrites revision storage metadata (item ids, URLs, sync status) unconditionally, with no version/etag check against the Graph item before writing back — a concurrent sync or co-authoring edit could have a stale write silently win at the metadata level (content-level merge is Word's own concern, out of this worker's scope).
Applies to: Revision Office Online sync. Source: `17`. QF: not addressed. Confidence: Medium (structural gap confirmed; real-world frequency/impact not measured). Evidence: `RevisionSharePointSyncWorker`, `17`.

## Concurrency (BR-CONC)

**BR-CONC-001** — Concurrency / High
Document, Document Revision, and Controlled Copy all carry a JPA `@Version` optimistic-lock column; `ControlledCopyDistributionBatch` (and Job/JobItem) do **not** — Batch-level concurrency relies entirely on async re-fetch and explicit terminal-state checks rather than optimistic locking.
Applies to: all core lifecycle entities. Source: `05`, `12`. QF: not addressed. Evidence: `05-data-model.md`, `12-transaction-concurrency.md`.

**BR-CONC-002** — Concurrency / High
Controlled Copy print/download quota consumption (`consumePrint`/`consumeDownload`) uses atomic conditional bulk UPDATEs rather than optimistic-lock-guarded read-modify-write, deliberately bypassing `@Version` to avoid race conditions on print/download-once policies without retry logic.
Applies to: Controlled Copy. Source: `12`, `17`. QF: not addressed. Evidence: `entity/ControlledCopyRecord` (comment), `12`.

**BR-CONC-003** — Concurrency / High
All twelve confirmed `@Scheduled` jobs either use a Redis-backed distributed lease (for jobs where multi-instance duplication would risk a regulated double-action) or an atomic database claim (for restart-recovery jobs) or are deliberately node-local with no lock (for non-regulated maintenance, e.g. SSE heartbeat, local rate-limit cleanup) — no scheduled job was found running unprotected where protection would matter.
Applies to: all scheduled jobs. Source: `13-async-scheduler-events.md`. QF: not addressed. Evidence: `13`.

---
**Rule count**: 73 canonical rules (10 BR-DOC, 21 BR-REV, 17 BR-CC, 5 BR-AUTH, 5 BR-SIG, 4 BR-AUD, 4 BR-NOTIF, 4 BR-STORAGE, 3 BR-CONC). Every rule traces to at least one already-confirmed section; none was newly invented for this catalog.
