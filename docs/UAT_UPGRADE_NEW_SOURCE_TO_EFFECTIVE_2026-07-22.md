# UAT report — Upgrade revision with a new source file

**Executed:** 22 July 2026 (Asia/Ho_Chi_Minh)  
**Result:** Passed after two targeted backend corrections  
**Scope:** Upgrade an existing Effective document, upload a genuinely new source file, route it through review, approval and publishing, and verify the PDF preview ownership rules.

## Test record created in EQMS

| Item | Value |
| --- | --- |
| Document Master | `SOP.0029 — UAT Snapshot Lifecycle 20260722` |
| Document Master ID | `90559baf-a1cd-4093-8953-17b1e4d662cd` |
| Prior revision | `2.0.0` — revision ID `f8075d2f-4068-4aa9-bae0-997b15a2de51` |
| New Effective revision | `3.0.0` — revision ID `28520f30-307d-41b5-bb3e-a287ef05caad` |
| Real new source file | `docs/DOCUMENT_WORKFLOW_RUNTIME_GUIDE_UPDATED.docx` (42,388 bytes) |
| Source SHA-256 | `2880c985d9c28e654db2c77382ed3366234adfabba555a605e78c3ef179a2dfa` |
| Direct revision URL | `http://localhost:3000/documents/revisions/28520f30-307d-41b5-bb3e-a287ef05caad` |
| Direct Document Master URL | `http://localhost:3000/documents/90559baf-a1cd-4093-8953-17b1e4d662cd` |

## Test actors

| Account | Role used in the test |
| --- | --- |
| `user.a.test` | DCO: created Upgrade and published it |
| `user.b.test` | Author: uploaded the new source, completed authoring and submitted it |
| `user.c.test` | Reviewer: completed Review |
| `user.f.test` | Approver: completed Approval |

## Sequential execution and results

1. The DCO created an Upgrade from the existing Effective revision 2.0.0.
   - The created Draft had no `fileName`, `sourceStorageObjectKey`, checksum or preview.
   - This proves that the new revision did not clone or reuse the predecessor's source file.

2. The Author deliberately attempted **Complete Editing** before uploading a source.
   - The operation was blocked with HTTP 400 and the message: `Upload the new revision source file before completing authoring.`
   - The draft remained unchanged, with no review snapshot generated.

3. The Author uploaded `DOCUMENT_WORKFLOW_RUNTIME_GUIDE_UPDATED.docx`.
   - The source was stored under the isolated revision source path for the UAT revision.
   - The source checksum above was persisted.
   - The source preview was generated successfully.

4. The Author completed editing and submitted the revision for review.
   - The source was locked.
   - A Review Snapshot PDF was generated and used for Review.

5. The Reviewer completed Review, then the Approver completed Approval.
   - At each state transition, the current review snapshot was regenerated and made ready before the next workflow action.

6. The DCO generated the publishing package and published the revision.
   - The background publishing job completed successfully.
   - Revision `3.0.0` is now `Effective`.
   - Its published metadata records the DCO as publisher and the publication time `22/07/2026 23:23:19`.

## Defects found during UAT and corrections applied

| Defect | Correction | Retest |
| --- | --- | --- |
| Completing editing without a source produced a server error instead of a validation response. | The workflow guard now raises a request validation error (HTTP 400), not a server-state exception. | Passed: author receives the expected blocking message and cannot advance the Draft. |
| The asynchronous publishing worker tried to obtain the interactive web security context, so Publish failed after the request had returned. | The worker now uses the captured publishing user for the final publish action and a system-safe revision projection when resolving publishing placeholders and generating the final snapshot. | Passed: job `f543d7a0-0079-404f-8eec-4d2f181d963f` completed and the revision reached Effective. |

## PDF ownership and preview verification

All checks below were executed as the DCO over the running API after Effective status was reached.

| Endpoint / screen rule | HTTP | PDF magic | Bytes | SHA-256 | Result |
| --- | ---: | --- | ---: | --- | --- |
| Detail Revision 3.0.0: `GET /revisions/28520f30-307d-41b5-bb3e-a287ef05caad/preview` | 200 | `%PDF` | 338,100 | `d50a1b7da3ee87d6719fd41218ab147cf2c935132a25a69fe03115f3d76d870f` | Correct: own published PDF of the current revision. |
| Detail Revision 2.0.0: `GET /revisions/f8075d2f-4068-4aa9-bae0-997b15a2de51/preview` | 200 | `%PDF` | 539,996 | `c113f421719e4a05d367ec3afabe7e1eb2b55e95453f9a0557078361172c9965` | Correct: historic revision returns its own different published PDF. |
| Document Master: `GET /documents/90559baf-a1cd-4093-8953-17b1e4d662cd/preview` | 200 | `%PDF` | 338,100 | `d50a1b7da3ee87d6719fd41218ab147cf2c935132a25a69fe03115f3d76d870f` | Correct: matches current Effective 3.0.0 exactly, not the obsolete revision. |

## Implementation changes

- Upgrade Drafts no longer clone source-file metadata or storage keys from the predecessor.
- An Author cannot complete authoring or create an Office Online copy until that new Draft has its own uploaded source.
- The revision creation UI labels the source operation as **Upload Revision** when no source exists, and **Replace Source File** only after a source exists.
- Document Master preview resolution no longer falls back to a revision's generic preview; it uses only the current Effective revision's published PDF.
- Background publishing has no dependency on a request-thread authentication context and now logs failed jobs for investigation without changing revision state.

## Build verification

- Backend Docker build: passed (`mvn -DskipTests clean package` within the Docker build).
- Backend container health: passed.
- Frontend production build: passed (`npm run build`, Vite build completed).

## GMP controls verified

- The predecessor's source was not copied into the Upgrade Draft.
- Source, review snapshot and published PDF are distinct controlled artifacts.
- Review and approval were electronically signed by their assigned actors.
- The current Document Master points only to the current Effective published PDF.
- The obsolete revision remains retrievable as its own immutable historic PDF, preserving traceability.
