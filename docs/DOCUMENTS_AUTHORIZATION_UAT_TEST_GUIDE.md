# Documents Authorization UAT Test Guide

## Test Accounts

All accounts below are active and use password `Test@12345` in the local Docker UAT environment.
The reset normalizes password-expiry and lock state without changing password hashes, so each account can use authenticated APIs immediately after login.

Quality profile scope uses the canonical lookup codes `QAU` (Business Unit: Quality Unit) and `QA` (Department: Quality Assurance). Production uses `OPER` and `PROD`.

| User | Purpose | Access Profile |
|---|---|---|
| `user.a.test` | DCO | `AP_UAT_DCO_QUALITY` |
| `user.b.test` | Author | `AP_UAT_AUTHOR_QUALITY` |
| `user.c.test` | Reviewer | `AP_UAT_REVIEWER_QUALITY` |
| `user.d.test` | Co-author | `AP_UAT_COAUTHOR_QUALITY` |
| `user.e.test` | Quality Reader | `AP_UAT_READER_QUALITY` |
| `user.f.test` | Approver | `AP_UAT_APPROVER_QUALITY` |
| `viewer.ops1` | Production Reader | `AP_UAT_READER_PRODUCTION` |

After the authorization reset, log out then log in again before each test account is used.

## Test Record Setup

1. Log in as `user.a.test`.
2. Go to `Document Control -> All Documents -> New Document`.
3. Create a Quality document and set `user.b.test` as Author and `user.d.test` as Co-author.
4. Save and proceed to create the first Revision.
5. Select `user.c.test` as Reviewer and `user.f.test` as Approver, then save.
6. Record the Document Number and Revision Number. Use this same record for the tests below.

Completed lifecycle evidence: `SOP.0020`, Revision `1.0.0` is a Quality document authored by `user.b.test`, reviewed by `user.c.test`, approved by `user.f.test`, and published by `user.a.test`. Its final independent states are Document Master `ACTIVE` and Revision `EFFECTIVE`.

Technical snapshot rule: review-snapshot generation in `DRAFT` inherits the DCO/Document Admin `documents.revision.submit_review` capability. It is not an independently assignable human permission. If no Publishing Template is configured, the snapshot is marked `READY` so the workflow can continue, but no PDF preview file is available.

## Authoring Tests

| Test | Login | Expected result |
|---|---|---|
| A1 | `user.b.test` | Upload Revision is visible and succeeds for the Draft Revision. |
| A2 | `user.a.test` | Upload Revision is not available; DCO must not upload source files. |
| A3 | `user.d.test` | Edit File Online is allowed after Author uploads source. |
| A4 | `user.d.test` | Upload/replace source and Complete Authoring are denied. |
| A5 | `user.b.test` | Complete Authoring succeeds with an electronic signature. |
| A6 | `user.b.test` | Submit for Review is denied. Author can only upload/edit and Complete Editing. |
| A7 | `user.a.test` | After Author has completed editing, DCO prepares the technical snapshot and Submit for Review succeeds with an electronic signature. Revision becomes `PENDING_REVIEW`. |

## Review and Approval Tests

| Test | Login | Expected result |
|---|---|---|
| R1 | `user.c.test` | Review and Reject buttons are available only while the Revision is `PENDING_REVIEW` and this user is the current Reviewer. |
| R2 | `user.e.test` | Review and Reject are not available even though the user can read Quality documents. |
| R3 | `user.c.test` | Complete Review succeeds with an electronic signature. Revision becomes `PENDING_APPROVAL`. |
| P1 | `user.f.test` | Approve and Reject Approval are available only while `PENDING_APPROVAL` and this user is current Approver. |
| P2 | `user.b.test` | Approve is denied. Author-versus-Approver SoD applies even if an approval assignment is attempted. |
| P3 | `user.f.test` | Approve succeeds with an electronic signature. Revision becomes `PENDING_TRAINING` or `READY_FOR_PUBLISHING`, depending on Requires Training. |

## Training and Publishing Tests

| Test | Login | Expected result |
|---|---|---|
| T1 | `user.a.test` | When Revision is `PENDING_TRAINING`, DCO can record training completion with an electronic signature. The DCO set includes both `documents.revision.complete_training` and `documents.training.complete`. |
| T2 | `user.b.test` | Training completion is denied. |
| U1 | `user.a.test` | When Revision is `READY_FOR_PUBLISHING`, DCO can Publish with an electronic signature. |
| U2 | `user.f.test` | Publish is denied; Approver is not Publisher/DCO. |
| U3 | `user.a.test` | After Publish, Document Master is `ACTIVE` and the published Revision is `EFFECTIVE`. Verify these are displayed as separate statuses. |

## Department and Download Tests

| Test | Login | Expected result |
|---|---|---|
| V1 | `user.e.test` | Can open and preview an Effective Quality document. |
| V2 | `user.e.test` | Download is denied because the Reader profile has no Downloader Permission Set. |
| V3 | `viewer.ops1` | Cannot view a Quality document because its profile scope is Production. |
| V4 | `viewer.ops1` | Can preview an Effective Production document when one exists. |

## Controlled Copy Tests

Create a Controlled Copy Batch from the Effective Quality Revision, then verify the four independent Controlled Copy states.

| Test | Login | Status | Expected result |
|---|---|---|---|
| C1 | `user.a.test` | `READY_FOR_DISTRIBUTION` | DCO can Distribute Batch or Cancel Batch Distribution. |
| C2 | `user.a.test` | `DISTRIBUTED` | DCO can Recall; the result is `OBSOLETED`. |
| C3 | `user.a.test` | `OBSOLETED` | DCO can record destruction/evidence; the batch remains `OBSOLETED`. |
| C4 | `user.a.test` | `CLOSED_CANCELLED` | Distribution and recall actions are denied. |

## Evidence to Capture

For each passed or failed test, retain:

- Username and timestamp.
- Document Number, Revision Number, and Controlled Copy Batch Number where relevant.
- Object status before and after the action.
- Screenshot of the button/capability result.
- Electronic signature record for every successful user-triggered business action.
- Error message or denial reason for negative tests.
