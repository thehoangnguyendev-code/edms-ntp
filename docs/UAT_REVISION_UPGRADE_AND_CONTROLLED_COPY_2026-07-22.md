# UAT report — revision upgrade and controlled-copy distribution

**Test date:** 22 July 2026  
**Environment:** local EQMS (`frontend:3000`, `backend:5000`, PostgreSQL, MinIO)  
**Result:** Passed after three targeted defect corrections and regression checks.

## Scope

This UAT used live, retained test data to verify two controlled-document workflows:

1. Upgrade an Effective document to a new revision, take it through authoring, review, approval, and publishing to Effective.
2. Request, distribute, and securely view a controlled copy of that new Effective revision.

The test data has deliberately not been deleted so it remains available in the application for review.

## Retained test records

| Item | Value |
|---|---|
| Document | `SOP.0029` — **UAT Snapshot Lifecycle 20260722** |
| Document ID | `90559baf-a1cd-4093-8953-17b1e4d662cd` |
| Previous revision | `1.0.0` — now **Obsoleted** |
| New revision ID | `f8075d2f-4068-4aa9-bae0-997b15a2de51` |
| New revision | `2.0.0` — **Effective** |
| Controlled copy | `CC.SOP.0029.001` |
| Controlled-copy ID | `25bbe367-8cc4-44ee-a24a-58b205d415ca` |
| Distribution batch | `CCB.SOP.0029.B001` (`fc48c82c-320a-48fc-b4a0-1389e52e4f53`) |
| Recipient | User C (Reviewer/Approver Test) |
| Distribution location | UAT Controlled Copy Cabinet A |
| Expiry | 23 July 2026, calculated from the actual distribution time |

Open **Document Control → Document Revisions → All Revisions**, search for `SOP.0029`, and open revision `2.0.0`.  The controlled copy is available from **Controlled Copies** by its copy number above.

## Roles used

| Account | UAT responsibility |
|---|---|
| `user.a.test` | DCO: upgrade, submit for review, publishing workspace/preview, publish, request and distribute controlled copy |
| `user.b.test` | Author: complete authoring/editing |
| `user.c.test` | Reviewer and controlled-copy recipient: complete review and verify recipient access |
| `user.f.test` | Approver: complete approval |

## Test 1 — upgrade to a new revision

| # | Action | Expected result | Evidence / result |
|---:|---|---|---|
| 1 | DCO upgraded the existing Effective revision `1.0.0`. | A new Draft inherits a controlled working source without changing the already-effective source. | Draft `1.0.1` was created from `1.0.0`; its source was stored as a separate MinIO revision object. |
| 2 | Author completed editing with an electronic-signature reason. | The source is locked for the next workflow phase. | Passed. The initial attempt without a reason was correctly rejected with `Signing reason is required`; it was resubmitted with a reason. |
| 3 | DCO generated the review PDF, then submitted the revision for review with e-signature. | A PDF snapshot exists before review and status becomes Pending Review. | Passed. Preview endpoint returned a non-empty PDF (539,434 bytes before final publishing). |
| 4 | Reviewer completed review with e-signature. | Status advances to Pending Approval and reviewer action is traceable. | Passed. |
| 5 | Approver completed approval with e-signature. | Status advances to Ready for Publishing. | Passed. |
| 6 | DCO published the approved revision with e-signature. | New revision becomes Effective, preceding revision becomes Obsoleted, and current PDF is available. | Passed. Revision `2.0.0` is Effective; `1.0.0` is Obsoleted. The final PDF endpoint returns a valid PDF response. |

### Electronic-signature evidence

The immutable electronic-signature record contains the following sequence for revision `f8075d2f-4068-4aa9-bae0-997b15a2de51`:

1. `user.b.test` — `PREPARED`
2. `user.a.test` — `SUBMITTED_FOR_REVIEW`
3. `user.c.test` — `REVIEWED`
4. `user.f.test` — `APPROVED`
5. `user.a.test` — `PUBLISHED`

The audit trail also records `UPGRADE`, `COMPLETE_EDITING`, `GENERATE_PUBLISHING_PREVIEW`, `SUBMIT_FOR_REVIEW`, `REVIEW_COMPLETE`, `APPROVE_COMPLETE`, `PUBLISH`, and `EFFECTIVE_SNAPSHOT_REGENERATED` actions with actor, status transition, timestamp, and e-signature indicator where applicable.

## Test 2 — request and distribute a controlled copy

| # | Action | Expected result | Evidence / result |
|---:|---|---|---|
| 1 | DCO requested one internal controlled copy of Effective revision `2.0.0`. | Request creates a traceable copy in Ready for Distribution. | Passed. `CC.SOP.0029.001` was created in batch `CCB.SOP.0029.B001`. |
| 2 | DCO distributed the batch using e-signature and a mandatory distribution comment. | Copy becomes Distributed, recipient/location are stored, a final per-copy PDF is generated, and expiry starts at distribution. | Passed. Status is `DISTRIBUTED`; recipient is User C; expiry is 23 July 2026. |
| 3 | Verify storage protection and file integrity. | Distributed PDF is immutable and has a recorded checksum. | Passed. MinIO reports PDF content, object-lock mode `COMPLIANCE`, retention until 22 July 2031, and checksum `8e2007e57560c9af0776795042fee55004242d50040d161a82315e7af0abee47`. |
| 4 | Verify recipient access and portal preview. | Recipient can view the controlled copy; portal preview requires its access token and preview password, not an EQMS bearer session. | Passed. Recipient access was verified and anonymous token/password preview returned 540,683 bytes with the same SHA-256 checksum as the retained MinIO object. |
| 5 | Verify distribution notification. | The recipient receives an in-app controlled-copy notification. | Passed. `user.c.test` received `controlled_copy.distributed` / **Controlled copy available**. |

The document’s controlled-copy policy was also verified: portal viewing is enabled, direct download is disabled, and view-only mode is enabled.

## Defects found, corrective changes, and regression result

| Defect found during UAT | Targeted correction | Regression result |
|---|---|---|
| Upgrading created revision metadata but did not copy the effective source file to an independent working object. | `RevisionService` now clones the source file into the new revision’s own MinIO object in both upgrade entry points. | New draft source was present and the lifecycle completed to Effective. |
| An asynchronous snapshot worker could save a stale revision entity after Publish and temporarily overwrite the current workflow status. | `RevisionSnapshotAsyncService` now reloads the latest revision/metadata before saving both success and failure snapshot state. | Backend rebuilt and deployed; final revision remained Effective after the snapshot process completed. |
| Token/password controlled-copy preview endpoint was not in the token-only security allowlist. | Added `/controlled-copies/*/preview/file` to `SecurityConfig` token-only endpoints. | Anonymous controlled-copy preview succeeded and checksum matched the stored object. |

## Build and service verification

- Backend image rebuilt successfully with `mvn -DskipTests clean package` during Docker build.
- Backend container reached Docker health status `healthy` after the final deployment.
- Final API/database verification confirmed revision `2.0.0` is Effective and copy `CC.SOP.0029.001` is Distributed and assigned to User C.

## UAT conclusion

Both workflows passed with retained, inspectable data.  The upgrade preserves the prior Effective record, creates a new controlled source for the new revision, generates review/effective PDFs, and records all regulated workflow signatures.  The controlled copy is distributed as a separately rendered, immutable, view-only PDF with recipient access, expiry, notification, and audit evidence.
