# 15 — Audit Trail (AS-IS)

Evidence: direct read of `service/AuditTrailService.java`, `repository/AuditLogRepository.java`, `config/AuditRequestTimingFilter.java`.

## Backing entity
`AuditLog` (via `AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog>`), with a child `AuditLogChange` table for structured before/after field diffs (one row per changed field: `fieldName`/`oldValue`/`newValue`/`changeOrder`).

## Fields captured per row
`eventTime`/`createdAt`/`updatedAt`, `entityType`/`entityName`/`entityId`, `actionType`/`action`, `fromStatus`/`toStatus`, `comment`/`reason`, `oldValue`/`newValue` (free-text summary), `ipAddress`, `userAgent`, `deviceBrowser`/`deviceModel`/`devicePlatform`/`devicePlatformVersion`/`deviceName`, `processingDurationSeconds` (from `AuditRequestTimingFilter`'s stashed start-time attribute), and an **actor snapshot** — `actedBy`/`userId`/`username`/`userFullName`/`employeeCode`/`roleName`/`positionName`/`departmentName` taken at write time (deliberately not a live FK join, so the record stays truthful if the user's name/role/department later changes — `QF-MATCH` with 11.10(e)'s "retain original information" intent). `signatureId`/`electronicSignatureApplied` link to the `ElectronicSignature` record when the action was e-signed.

`logExternal(...)` handles actions by an unauthenticated external recipient (controlled-copy links) — snapshots an `externalIdentifier` string as the actor instead of a `UserAccount` FK, explicitly documented as intentional so the trail stays truthful even if that person is later invited into EQMS proper.

## Tamper-proofing / append-only
No `update`/`delete`/`deleteBy*` method is declared on `AuditLogRepository`, and no call site anywhere in the service layer invokes deletion or mutation of an already-persisted `AuditLog`/`AuditLogChange` row — every write path is `persistAudit`/`persistChanges` → `save(log)` (a fresh insert).

**Precise caveat, do not overstate**: because the repository extends plain `JpaRepository`, the inherited `delete(...)`/`deleteById(...)` methods are still technically callable by any code holding a reference to the bean. Immutability here is **enforced by convention/absence of callers, not by a repository interface that structurally omits delete, nor by a DB trigger or constraint**. QF's SDS claims "Audit Trail records are system-generated and cannot be modified or deleted by standard users through the application interface" — this is `QF-MATCH` for the application's exposed behavior (no UI/API path deletes an audit row), but the underlying guarantee is weaker than QF's stronger 11.10(e) framing ("beyond the control of systems users and enabled at all times") would imply if read as a database-level guarantee. Flag as a Decision Log candidate: is convention-based immutability sufficient, or should the repository/DB be hardened (e.g., a read-only DB role, a `BEFORE DELETE` trigger)?

## Read-side access control
- `list()`/`getById()`/`listUsers()` require `requireAuditView()` — permission `audit.view` (or legacy aliases `audittrail.module.view`/`VIEW_AUDIT_TRAIL`) — the global Audit Trail module permission.
- `getByEntity(module, entityId)` uses `requireEntityAuditView`, which is **object-scoped, not just role-gated**:
  - For Controlled Copy / Controlled Copy Distribution Batch: access granted if the actor can access the copy's parent Document/Revision (`DocumentAuthorizationService.canAccessControlledCopy`), **or** if the actor matches one of the copy's own named roles (`matchesControlledCopyViewer`: recipientUser/recipientName-string/requestedBy/approvedBy/printedBy/distributedBy/recalledBy/destroyedBy/cancelledBy/obsoletedBy) — this is the mechanism letting a plain Controlled Copy recipient see that copy's own audit/signature tab without holding the global `audit.view` permission.
  - For Document: a document-scoped permission `documents.document.view_audit` is checked first (matching what `CapabilityService` uses to decide whether the FE shows the tab at all); only if the actor lacks it does the code fall back to requiring the global `audit.view`.
  - Otherwise: falls back to `requireScopedEntityView`, loading the Document or Revision and calling `requireCanViewDocument`/`requireCanViewRevision`.

**Cross-check against QF's role table** ("View Audit Trail: X for Admin/DCO/Author/Co-Author/Reviewer/Approver, only-Published for Receiver/View-Only"): the actual gate is **entitlement-based, never a literal role-string check** — consistent with `06-role-authorization-model.md`'s architectural finding that role names are descriptive metadata, not authorization keys. Whether the specific permission grants configured per QF role actually reduce to "only Published documents visible to Receiver/View-Only" was **not traced in this pass** — that requires inspecting `canAccessControlledCopy`/`requireCanViewDocument` plus live Access Profile/permission-set data, out of scope here. **UNKNOWN** — cannot confirm or deny the Receiver/View-Only "Published-only" restriction from `AuditTrailService` alone.

## Export
`writeExport` requires `audit.export` (distinct from `audit.view`) **and** a valid, current-user-owned electronic signature token (`requireValidExportSignature` → `tokenService.parseSignatureToken`, verifies `principal().userId().equals(actor.getId())`), and records an `ElectronicSignature` (`createEntitySignature("AuditTrail", ..., "AUDIT_RECORD_EXPORTED", ...)`) plus an `EXPORT` audit log entry. Exporting the audit trail is itself e-signed and audited — a closed-loop control matching 11.10(b)'s "export data and supporting regulatory information" requirement with an added integrity/accountability layer QF doesn't explicitly specify (`IMPLEMENTATION-DISCOVERED`, additive, not a deviation risk).

## `AuditRequestTimingFilter`
Trivial `OncePerRequestFilter` at `Ordered.HIGHEST_PRECEDENCE`: stashes `System.nanoTime()` as a request attribute so later audit writes can compute `processingDurationSeconds`. Captures nothing else — no request body, no headers beyond what `AuditTrailService` separately pulls (`X-Forwarded-For`, `User-Agent`) at write time.

## UNKNOWNs
- Whether Receiver/View-Only role's Access Profile actually restricts audit-trail visibility to Published documents only (QF's stated rule) — not traced past `AuditTrailService` in this pass.
- Whether any DB-level protection (trigger, read-only role) exists against the theoretically-callable inherited delete methods on `AuditLogRepository` — not found, likely absent, not exhaustively ruled out.
