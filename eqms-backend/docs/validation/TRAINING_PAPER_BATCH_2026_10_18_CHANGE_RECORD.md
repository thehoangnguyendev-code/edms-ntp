# Training Management: paper first, matrix completion, batch export, copies (V611 to V623)

Date: 2026-10-18. Owner requests: run training on paper or in one room as well as on screen (PLAN-TR-001 section 17, SDS-TR-001 section 18); a matrix completion grid per position; batch export of personal records; log of copies sent to departments; two specimen signatures; initial training record for the signatories of a document; rename of the activity title to Training Title. Later the same day: exam copies with the APD.0009 footer (V624), the day the attendance list goes to QA, and training reviews of a person (V625), built on the owner's instruction that the software supports the SOP and the manual part is kept (DECISION_LOG entry TRAINING-HYBRID-2026-10-18). Not an approval of any GMP decision: the proposals D-39 to D-58 in `DECISION_LOG.md` still need a named QA or owner decision, except the points the owner decided in the session on 2026-10-18 (second specimen signature required, signatories get the initial record, one column for each position).

## Invariants

- Server decides everything that matters: the state of a matrix cell, the pass result of a score, who may print, type, check or approve, the copy number of a print. The screen only asks and shows.
- A printed paper pack, a transcription line, a copy sent or received, a batch export and a specimen image cannot be changed or deleted after they are written (database triggers, V616, V617, V620, V621, V622).
- A transcription is applied only after a different person has checked it against the scan and signed (electronic signature, meaning `TRAINING_TRANSCRIPTION_VERIFIED`). The same rule for the batch export (the approver is not the preparer) and for the quick roll-call (the trainer signs once; a trainee is never marked by themselves).
- Every write goes to the Audit Trail with the actor, the object and the reason. No new permission is granted to any role by a migration; the DEV test grant is a separate script.
- Lifecycle of a training activity, numbering, immutability of training records and storage of files are unchanged. The only change to existing behaviour is listed under "Existing behaviour changed".

## Implementation

- Migrations: V624 (exam pack kind), V625 (personnel reviews and items, signature meaning). V611 to V615 (material purpose and link, session location, planned absence, external training and observation), V616 (delivery mode, paper packs, `training.paper.print`), V617 (transcription and its lines, `training.paper.transcribe` and `.verify`, signature meaning), V618 (sign mode `TRAINER_ATTESTED`; the table of non-working days already existed from V594), V619 (column `training_activities.training_title`), V620 (session preparation, copy distribution), V621 (batch export), V622 (second specimen image), V623 (source `SIGNATORY_INITIAL` of a training record).
- Backend services: `TrainingMatrixCompletionService`, `TrainingPaperService`, `TrainingTranscriptionService`, `TrainingRollCallService`, `TrainingCalendarService`, `TrainingPreparationService`, `TrainingCopyService`, `TrainingRecordExportBatchService`; changes to `TrainingActivityService`, `TrainingSpecimenService`, `TrainingRecordExportService`, `TrainingDocumentIntegrationService`, `TrainingPrintService`, `MyTrainingQueryService`, `TrainingApprovalService`.
- Frontend: the Training features are now in folders by area (`activities`, `matrices`, `requirements`, `jobs`, `records`, `specimens`, `compliance`, `my-training`, `shared`), Training Compliance has the tabs Summary, Matrix completion and Gap list, the Record Exports screen has the tabs One person and Department and year, and the shared `Select` now accepts `aria-label`.
- Impact: GitNexus was not available in the session, so `impact` and `detect_changes` were not run; the callers were searched by hand with the source search tools. Shared code touched: `Select` (additive prop), `TrainingActivityService` (many callers inside Training only).

## Existing behaviour changed

- `training_activities.title` is now `training_title`; the API field is `trainingTitle`. The sort key of the activity list is `trainingTitle`.
- A new specimen signature version must have two images. Older versions keep one.
- The My Training "Waiting for my signature" list and the approval list know the batch export as a new kind of work.
- APD.0014 now prints the qualification (latest education record) and the date the person joined the company.

## Defects found and fixed during the walkthrough

- Adding a session to an activity failed since V613: the insert listed 13 columns and had 12 placeholders. Fixed (V613 had been checked by build only, not by a call).
- The Non-working days service used a column that does not exist in the table from V594 (`name`); it now uses `reason`.
- The shared `Select` ignored `aria-label`; the new controls therefore had no accessible name. Fixed.

## Verification (DEV, 2026-10-18)

- Build: `mvnw compile`, `tsc --noEmit`, Docker build of both images; migrations V611 to V623 applied.
- API walkthrough with real accounts (scripts and notes in `evidence/training_2026_10_18/`): create activity; session; participants; delivery mode Paper; preparation items; list confirmation with signature; content review and approval by two different people; notify; print pack (first copy, reprint without reason refused with 400, reprint with reason accepted); hold; quick roll-call (marks `TRAINER_ATTESTED`; second roll-call of the same person refused with 409); scan upload; transcription typed by admin (same idempotency key returns the same record; a second open transcription refused; the typist cannot verify: 400 segregation); approver.test1 verified and the score was applied as PASSED; assessment; submit; QA confirmation; records written.
- Matrix completion: positions, grid, print as PDF; summary. Batch export: preview, create, self approval refused, approval by another person, ZIP with two APD.0014 PDFs, content checked (qualification line empty because the sample person has no education record; join date printed).
- Copies: send; send again (no duplicate); the department of the receiver confirms; another department refused with 403; second receipt refused with 409. Non-working days: add; duplicate refused (409); weekend refused (400); remove. Specimen: one image refused (400), two images accepted and both opened, confirmed by another person.
- Browser (Edge, headless, DEV): Training Compliance (three tabs), Activities, the conduct screen with the Paper, Preparation and Results from paper blocks, the quick roll-call dialog with an absent trainee and the electronic signature dialog (toast "Roll-call recorded"; the absent person listed with the reason), the transcription dialog (scan chosen, scores typed, submitted) and the check by a second user in a second browser session (toast "Verified. Attendance and scores are recorded"), requirement list menu (View Details, Follow, Print PDF by status), requirement detail with the copy log, specimen upload dialog with two pickers, batch export dialog. At 390 px wide (Edge, mobile emulation) eight Training screens (Compliance three tabs, conduct, batch exports, copies received, requirements, specimens) showed no horizontal overflow, and the matrix completion grid turned into cards. No failed API call (status 400 or above) was recorded on any Training page for admin; approver.test1 had two 403 calls to `/settings/system`, which is outside Training.

- Exam pack (API and PDF): refused without an exam (409); a PDF exam printed for two trainees (cover page and stamped test page each, text checked: Training Number, trainee name, signature line, page x / y); reprint without reason refused (400), with reason accepted; the attendance and exam prints are numbered separately. Personnel review: opened; a second open review of the same kind refused (409); "not needed" without a reason refused (400); linking a training of the person accepted; closing with pending items refused (409); the employee cannot close (403); another person closed it with a signature; changes after closing refused (409). The new Training Reviews list, new-review dialog and detail page were opened in the browser; no failed API call.

- Training review follow-ups: a training created from an item (title and reason follow the event; linked at once; a second creation refused 409; an item that asks for no training refused 400; saving the item again with the same activity accepted although the employee is not yet on its list); the compliance summary counted the open review and the matrix completion listed it for the person; the suggestions list returned empty (nobody started in the last 60 days) and its SQL was run by hand with a wider window. The Create training button, the Open training reviews tile and the Review open badge were seen in the browser. The suggestion banner was not seen with data.

## Not verified

- The day the attendance list goes to QA: only the null case for an ordinary training was checked by call; the states for a new or revised document and the reminder job were not run (they need a document revision workflow and a day change). A DOCX exam was not tried.
- Signatory records at the approval of a document revision: only the SQL statement was run inside a transaction and rolled back (it returned four rows for an existing revision). The full document workflow was not run.
- Concurrency (two people printing or typing at once), load, the quick roll-call with an exam, the screens with a person that has fewer permissions, and unit tests for the new services. The Spring tests use the shared DEV database and were not run.
- Unrelated failing front-end tests exist in the working tree (`effectiveByType.test.tsx`); the Drawer test fails only when the whole suite runs in parallel and passes alone.

## Limitations and rollback

DEV evidence only, not released-environment validation. Rollback of the data model is forward-only (a new migration); the tables added here hold no business record before use. The screens and services can be removed without touching earlier Training records; the column rename would need a new migration to reverse.
