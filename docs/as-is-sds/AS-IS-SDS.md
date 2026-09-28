# AS-IS Software Design Specification — Master Index

Reverse-engineered from source code in `d:\edms-project`. QF reference documents (`QF-DMS-FRS-V01-draft07.md`, `QF-DMS-SDS-V01-draft07.md`) are used only for terminology/workflow-shape hints, never as evidence of actual behavior. See `01-system-overview.md` for the classification scheme (`QF-MATCH`/`QF-DEVIATION`/`IMPLEMENTATION-DISCOVERED`/`IMPLEMENTATION-GAP`/`QF-INTERNAL-CONFLICT`/`UNKNOWN`).

This baseline is now **reconciled**: all 22 sections exist, cross-checked against each other for staleness and contradiction. No open cross-file contradictions were found as of this pass (see `21-known-unknowns-conflicts.md` §5 and `22-traceability-index.md`'s contradiction check).

| # | File | Status |
|---|---|---|
| 01 | [System Overview](01-system-overview.md) | Done |
| 02 | [Architecture](02-architecture.md) | Done — DB engine (PostgreSQL+Flyway+HikariCP) and dead-code/live-code async findings reconciled in |
| 03 | [Module Catalog](03-module-catalog.md) | Done — "pending" markers for Audit/Notifications/E-signature/Publishing removed, cross-linked to their now-complete sections |
| 04 | [Domain Model](04-domain-model.md) | Done |
| 05 | [Data Model](05-data-model.md) | Done |
| 06 | [Role & Authorization Model](06-role-authorization-model.md) | Done (Document/Revision/Controlled Copy actor scopes; `DocumentWorkflowSetting` SoD enforcement sites still UNKNOWN, tracked in 21) |
| 07 | [Workflows](07-workflows.md) | **Done** — standalone BA/QA-readable spec for all 3+12+9 requested Document/Revision/Controlled Copy workflows |
| 08 | [State Machines](08-state-machines.md) | Done — Document, Document Revision, Controlled Copy all confirmed; intro no longer describes Revision/Controlled Copy as placeholders |
| 09 | [Business Rules](09-business-rules.md) | **Done** — 73 canonical rules with stable IDs (BR-DOC/REV/CC/AUTH/SIG/AUD/NOTIF/STORAGE/CONC), each with QF mapping and confidence |
| 10 | [Hidden Implementation Rules](10-hidden-implementation-rules.md) | Done — 32 items, running ledger |
| 11 | [Cross-Workflow Dependencies](11-cross-workflow-dependencies.md) | **Done** — canonical map incl. the two independent Controlled-Copy-obsolete cascade implementations, documented as divergence-risk not defect |
| 12 | [Transaction & Concurrency](12-transaction-concurrency.md) | Done |
| 13 | [Async / Scheduler / Events](13-async-scheduler-events.md) | Done |
| 14 | [Notifications](14-notifications.md) | Done |
| 15 | [Audit Trail](15-audit-trail.md) | Done |
| 16 | [Electronic Signature](16-electronic-signature.md) | Done |
| 17 | [File Storage](17-file-storage.md) | Done |
| 18 | [External Integrations](18-external-integrations.md) | Done |
| 19 | [Error / Retry / Recovery](19-error-retry-recovery.md) | Done |
| 20 | [UI/API/Service Mapping](20-ui-api-service-mapping.md) | Done — one item (Document Obsolete button-gating source) remains UNKNOWN, tracked in 21, not silently dropped |
| 21 | [Known Unknowns & Conflicts](21-known-unknowns-conflicts.md) | Reconciled — items sorted into still-UNKNOWN vs. RESOLVED (with resolution recorded), Decision Log candidates preserved |
| 22 | [Traceability Index](22-traceability-index.md) | **Done** — QF concept → Workflow ID → Business Rule ID → state transition → backend/frontend implementation → classification |

## What this baseline confirms (headline findings, reconciled)
- **Architecture deviation**: QF's fixed 7-role matrix is replaced by a DB-backed permission-code + policy-engine model; role names are descriptive metadata only (`06` §6.0, BR-AUTH-001).
- **Confirmed cascades**: Revision→Effective obsoletes the prior EFFECTIVE sibling + its distributed controlled copies (BR-REV-014); Document Obsolete cascades to non-terminal Revisions (BR-DOC-008) and distributed Controlled Copies (BR-DOC-009) via **two independent code paths** (BR-CC-013, divergence-risk not defect); Revision Obsolete→Controlled Copy is a **synchronous in-transaction call**, never event/scheduler-driven.
- **Confirmed dead code**: `RevisionWorkflowAction.OBSOLETE` (BR-REV-019), `RevisionSnapshotAsyncService`/`RevisionSnapshotEvent`, `AsyncEmailRequestedEvent`, `MfaOtpEmailRequestedEvent` — four separate built-but-never-wired mechanisms, confirmed absent from the frontend as well where applicable.
- **Confirmed concurrency gap**: Controlled Copy recall's async finalize lacks the terminal-state guard distribute/cancel have (BR-CC-007) — confirmed unmitigated by the frontend too.
- **Confirmed storage finding**: several "storage provider" options are simulated only (BR-STORAGE-002).
- **Confirmed notification gaps**: 5+ QF-referenced notification types have no live trigger found (BR-NOTIF-001/002/003, BR-CC-017).
- **E-signature**: password-only by hardcoded design, MFA hardcoded disabled (BR-SIG-001/002) — flagged for a named Decision Log entry, not a defect.
- **Audit/signature immutability** is convention-based, not DB-enforced (BR-AUD-002).
- **Database**: confirmed PostgreSQL + Flyway (`02`), resolving a previously-open UNKNOWN.

## Reconciliation pass summary
- Stale "pending"/"in progress" language was removed from `02`, `03`, `08` and replaced with confirmed status, cross-linked to the sections that resolved it.
- `21-known-unknowns-conflicts.md` was restructured into: still-genuinely-UNKNOWN (20 items), RESOLVED-with-recorded-resolution (5 items), system-acknowledged-limitations (not defects), and Decision Log candidates (10 items) — no UNKNOWN was silently deleted.
- No cross-file contradiction was found; the one apparent tension (Controlled Copy `OBSOLETE`/`OBSOLETED` status-code naming) was investigated directly against migration files and confirmed as a sequential fix (`V74`→`V120`/`V121`/`V123`), not a live conflict.
- Terminology was checked for consistency: `OBSOLETED` (status) vs. `OBSOLETE`/`Obsolete` (action-type/audit label, distinct fields) is used consistently across `07`/`08`/`09`/`11`; `CLOSED_CANCELLED` and `READY_FOR_DISTRIBUTION` are used consistently as the exact literal codes throughout.

## Not yet covered by this SDS
Publishing Workspace/Template internals beyond the confirmed async-open-workspace and synchronous-preview-compose paths; Dashboards/Reports modules; Settings/Admin controllers beyond incidental coverage; full permission-catalog/Access-Profile data enumeration; frontend coverage outside the 5 flagged workflows and their shared API/service layer; `DocumentWorkflowSetting` SoD-flag enforcement call sites; legacy `DocumentWorkflowPoolMember` live-path status. All tracked in `21-known-unknowns-conflicts.md`.

## Note on system identity
This system is a custom Java/React implementation, not a ServiceNow deployment. Any QF SDS content describing ServiceNow-platform-native behavior (native RBAC, native audit-attribute capture, platform backup/replication) is out of scope for AS-IS verification unless an equivalent custom mechanism is found in code — none was found in this pass (`01`, `02`).
