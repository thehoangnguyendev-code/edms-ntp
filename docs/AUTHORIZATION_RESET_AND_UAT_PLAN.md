# Authorization Reset and Documents UAT Implementation Plan

**Status:** Baseline implemented in the local Docker UAT database at Flyway migration `V207`; lifecycle scenario evidence remains to be completed.

## 1. Objective

Replace the mixed legacy/test authorization assignments with one clean Documents authorization baseline that can be tested end to end:

- Permission Catalog uses one canonical code per business action.
- Permission Sets package only action capabilities.
- Access Profiles package Permission Sets, department scope, and workflow roles.
- Workflow assignment and lifecycle state still control record-level actions.
- SoD prevents incompatible action combinations on the same Revision.
- Test users have exactly the access required for a positive or negative test; no overlapping legacy profiles.

## 2. Reset Scope

### Data that will be cleaned

- Permission Set items and Permission Sets used by legacy Documents/test configurations.
- Access Profile to Permission Set assignments.
- Access Profile workflow-role assignments.
- User to Access Profile assignments for the UAT test accounts.
- Legacy Documents test profiles and old Documents test SoD constraints.
- Documents catalog entries that are retired aliases after code enforcement is aligned.

### Data that will not be deleted

- Document Masters, Revisions, Controlled Copies, source files, audit trail, e-signature records, and notifications.
- Business Unit, Department, Document Type, user account identity, and password hashes.
- Non-Documents module catalog entries until their own contract is approved.
- Production data. The reset script is a local Docker UAT runbook, not an automatic production Flyway migration.

## 3. Implementation Phases

| Phase | Work | Deliverable | Exit criterion |
|---|---|---|---|
| 0. Backup | Export authorization tables from the Docker UAT database | Timestamped SQL backup | Recovery script can restore pre-reset data. |
| 1. Contract alignment | Align backend, frontend catalog, workflow policy and capability API with the approved Documents contract | Completed: canonical UI/API checks | No current UI/BE code mismatch remains for the 41 Documents catalog permissions. |
| 2. Catalog cleanup | Retire non-canonical aliases and seed any missing approved canonical permissions | Completed: `V207` | Office Online aliases were migrated to canonical Revision permissions without dropping grants. |
| 3. Baseline security data | Remove old Documents UAT profile assignments and create new Permission Sets/Access Profiles/SoD constraints | Completed: deterministic UAT baseline | Each test user has only its intended profile(s). |
| 4. Test data | Create a Document Master, Revision sequence and Controlled Copy Batch in the required states | UAT records | Every lifecycle/action test has a known record. |
| 5. Verification | Execute positive/negative authorization matrix via API and UI | Test evidence | All expected allow/deny results pass. |

## 4. Canonical Documents Permission Sets

| Code | Purpose | Core permissions |
|---|---|---|
| `PS_UAT_DOCUMENT_READER` | Read a published document in scoped departments | module/view, document/view, preview published; download only when separately granted |
| `PS_UAT_DOCUMENT_DOWNLOADER` | Add permitted published-file download | `documents.document.download_published` |
| `PS_UAT_DOCUMENT_AUTHOR` | Create and author document revisions | create/edit master, upload source, edit/sync online, complete authoring, submit review |
| `PS_UAT_DOCUMENT_COAUTHOR` | Collaborate in draft online only | document/revision view, edit online; explicitly excludes upload source and complete authoring |
| `PS_UAT_DOCUMENT_REVIEWER` | Review assigned revisions | document/revision view, preview source, review, reject review |
| `PS_UAT_DOCUMENT_APPROVER` | Approve assigned revisions | document/revision view, preview source, approve, reject approval |
| `PS_UAT_DOCUMENT_DCO` | DCO document workflow operations | module/master access, complete training, publish, revision cancel/upgrade, master cancel/obsolete |
| `PS_UAT_CONTROLLED_COPY_DCO` | DCO controlled-copy operations | request, approve/reject request, prepare/distribute, recall, lost/damaged, replace, expire, destroy, view/preview/download/evidence actions |
| `PS_UAT_DOCUMENT_SECURITY_ADMIN` | Documents authorization configuration | security permission-set/profile/workflow/object-rule/SoD management plus document admin actions |
| `SYSTEM_SUPER_ADMIN` | Local UAT recovery access profile | global effective access; assigned only to `admin` |

## 5. Canonical Access Profiles and Scope

| Access Profile | Permission Sets | Workflow role | Department scope | Assigned UAT user |
|---|---|---|---|---|
| `SYSTEM_SUPER_ADMIN` | System Super Admin | none | all | `admin` |
| `AP_UAT_DOCUMENT_SECURITY_ADMIN` | Document Security Admin | `QUALITY_ADMIN` | `ALL` / `QA` | `admin` |
| `AP_UAT_DCO_QUALITY` | Document DCO, Controlled Copy DCO | `DCO` | `QAU` / `QA` | `user.a.test` |
| `AP_UAT_AUTHOR_QUALITY` | Document Author | `DOCUMENT_AUTHOR` | `QAU` / `QA` | `user.b.test` |
| `AP_UAT_COAUTHOR_QUALITY` | Document Co-author | none | `QAU` / `QA` | `user.d.test` |
| `AP_UAT_REVIEWER_QUALITY` | Document Reviewer | `DOCUMENT_REVIEWER` | `QAU` / `QA` | `user.c.test` |
| `AP_UAT_APPROVER_QUALITY` | Document Approver | `DOCUMENT_APPROVER` | `QAU` / `QA` | `user.f.test` |
| `AP_UAT_READER_QUALITY` | Document Reader | none | `QAU` / `QA` | `user.e.test` |
| `AP_UAT_READER_PRODUCTION` | Document Reader | none | `OPER` / `PROD` | `viewer.ops1` |

`user.c.test` is intentionally Reviewer only and `user.f.test` is Approver only. This makes the reviewer/approver SoD test deterministic.

## 6. UAT Test Matrix

| ID | User | Record/lifecycle setup | Expected result |
|---|---|---|---|
| DOC-01 | `user.b.test` | Quality document, Revision `DRAFT` | Can upload source and complete authoring. |
| DOC-02 | `user.d.test` | Same Draft Revision as Co-author | Can edit online; cannot upload/replace source or complete authoring. |
| DOC-03 | `user.c.test` | Assigned Reviewer, Revision `PENDING_REVIEW` | Can Review or Reject regardless of Document Type. |
| DOC-04 | `user.e.test` | Not assigned as Reviewer | Cannot Review or Reject even if it can view the document. |
| DOC-05 | `user.f.test` | Assigned Approver, Revision `PENDING_APPROVAL` | Can Approve or Reject Approval. |
| DOC-06 | `user.b.test` | Same Revision, additionally assigned as Approver in a negative test | Must be denied by Author-versus-Approver SoD. |
| DOC-07 | `user.a.test` | Revision `PENDING_TRAINING` | Can record training completion. |
| DOC-08 | `user.a.test` | Revision `READY_FOR_PUBLISHING` | Can Publish; Document Master becomes `ACTIVE`, Revision becomes `EFFECTIVE`. |
| DOC-09 | `user.e.test` | Effective Quality document | Can Preview; cannot Download unless Downloader set is additionally assigned. |
| DOC-10 | `viewer.ops1` | Effective Quality document | Cannot View/Preview/Download because department scope is Production. |
| DOC-11 | `viewer.ops1` | Effective Production document | Can Preview; Download depends on Document Type/Access Policy. |
| CC-01 | `user.a.test` | Controlled Copy `READY_FOR_DISTRIBUTION` | Can distribute or cancel batch. |
| CC-02 | `user.a.test` | Controlled Copy `DISTRIBUTED` | Can recall; outcome is `OBSOLETED`. |
| CC-03 | `user.a.test` | Controlled Copy `OBSOLETED` | Can record destruction evidence; state remains `OBSOLETED`. |
| CC-04 | `user.a.test` | Controlled Copy `CLOSED_CANCELLED` | Distribution/review actions are denied. |

## 7. Data Safety and Run Order

1. Export the affected authorization tables before reset.
2. Apply source-code/migration changes in a clean build.
3. Run the UAT reset script manually against `eqms-database` in Docker.
4. Restart backend to refresh authentication/effective-permission state.
5. Log out and log in each UAT user to obtain a fresh JWT.
6. Execute the test matrix and retain screenshots/API responses as test evidence.

## 8. Acceptance Gates

- No UAT user has an old `*_TEST`, `*_LEGACY`, or `MIGRATED_*` Access Profile after reset.
- No retired alias is visible in Permission Set creation/edit UI.
- Each action checks its own object status: Document Master, Revision, or Controlled Copy.
- Every enabled human business action requires an e-signature record.
- The `admin` account remains recoverable as System Super Admin throughout the reset.
- Reset can be rerun without creating duplicate Permission Sets, profiles, assignments, workflow roles, or SoD constraints.
