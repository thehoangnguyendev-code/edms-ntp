# Change record: Training Management, work package WP-0 (validation baseline and data baseline)

Date: 2026-10-16 · Environment: DEV only · Author: assistant · Owner decision: PLAN-TR-001 / SDS-TR-001 version 1.0 accepted by the owner on 2026-10-16 ("làm luôn đi").
Status: **delivered for QA review**. Nothing is approved; the owner's go for WP-1 is still to be given after review.

## What changed

**Documents only.** No source file, no migration, no configuration and no data was changed. No commit was made.

New files in `eqms-backend/docs/validation/`:

| File | Content | SDS-TR-001 §15.1 item |
|---|---|---|
| `TRAINING_URS_2026_10.md` | User requirements: purpose and boundary, 78 requirements with source, priority and test group | 0.2 |
| `TRAINING_RISK_ASSESSMENT_2026_10.md` | 28 risks scored S×P×D, controls, tests; ALCOA+ assessment | 0.3 |
| `TRAINING_TEST_STRATEGY_2026_10.md` | Test layers, a catalogue of test ids, 7 end-to-end scenarios, traceability URS ⇒ risk ⇒ design ⇒ test | 0.4 |
| `TRAINING_BASELINE_DATA_REPORT_2026_10.md` | Read-only DEV data report | 0.5 |
| `TRAINING_INFRASTRUCTURE_CHECK_2026_10.md` | Infrastructure check, removal plan of the trial UI, GitNexus impact | 0.6, 0.7, 0.8 |
| this file | Change record | 0.9 |

Also updated: `docs/governance/DECISION_LOG.md` (WP-0 entry), the project memory note for the Training plan.

## Evidence

- **Data baseline:** read-only `SELECT` statements on the DEV database, run through `psql` in the `eqms-postgres` container. The report holds counts, department codes, position names and document numbers only; no names, e-mails or passwords.
- **Impact analysis:** `gitnexus impact --direction upstream` on both indexed repositories (`eqms-backend`, `edms-ntp`).
- **Infrastructure check:** read of the code and of the running DEV containers (`eqms-clamav`, `eqms-minio`, `eqms-redis`, `eqms-mailhog` healthy).
- **Not executed:** no automated test, build or deployment was needed or run (no code changed).

## Findings that need a decision or action (details in the reports)

| # | Finding | Proposed handling | Who |
|---|---|---|---|
| F-1 | 14 documents belong to departments that are no longer active (EXEC, LAB, MAIN, QM); 3 of them require training | **D-35 (proposed):** allow a number from the document's department even if inactive; do not allow choosing an inactive department as organizer of a new activity | QA |
| F-2 | 432 of the 465 Active users have no employee code (297 `legacy.batch…`, 135 `baseline.nop…` are test and load accounts) | **D-36 (proposed):** only Active users with an employee code can be trained or listed | QA |
| F-3 | 10 Active users have the department text "Quality", which matches no department name | Never guessed; listed as unmapped; fixed by hand in Position Mapping | Data owner |
| F-4 | The link user ⇒ department and user ⇒ position is text, not a key | Match by name + report + manual fix (D-04) | WP-1, WP-3 |
| F-5 | `training.material.manage` is one of the permissions that let a person complete training today | Keep it for the MANUAL branch when permissions move (D-19) | WP-1 |
| F-6 | 7 documents/revisions already past Pending Training carry the training flag; 1 revision (SOP.0017) is in Pending Training now | **D-37 (proposed):** past revisions get no number; SOP.0017 stays MANUAL (D-28) | QA |
| F-7 | Entity `DocumentRevisionRecord` is CRITICAL (107 affected, 51 direct, 8 processes); `NewDocumentView` 425, `TrainingTab` 138, `RevisionTrainingView` 141 are CRITICAL | Additive, conditional changes only; full regression of Document Control before and after every slice (WP-5 plan) | Owner informed |
| F-8 | The model of "delegated department" scope in Access Profiles is not yet read | WP-1 reads `ObjectAccessRule` and decides | WP-1 |
| F-9 | No notion of non-working days in the system | Own table (D-14) | WP-1 |
| F-10 | The index shows 0 callers for `TrainingInformationTab` and `LegacyImportView` | Check by hand before changing them | WP-5 |

## Defects found

None in code (no code was run or changed). Findings above are data and design points.

## Deviations and limits

- The numbers are from **DEV**; they say nothing about the production database. The baseline report must be run again there before WP-3 and WP-5.
- The risk scores are the author's assessment; QA must review them.
- EU-GMP and Annex 11 clause numbers in the documents are the author's understanding; QA must check them against the official text.
- D-35, D-36, D-37 are new **proposals** from this work package; they are not decisions yet.
- Infrastructure items marked "unclear" (delegated department scope, backup scope) are not resolved here.

## Not built (this work package builds nothing)

All of WP-1 onward; the Training screens; the migrations; the port to Document Control.

## Rollback

Delete the six new files and the WP-0 entry of the Decision Log. Nothing else depends on them.

## Next step

QA reviews the five documents and signs the URS, the risk assessment and the test strategy; QA confirms the delegated decisions (PLAN-TR-001 section 13.2) and D-35 to D-37; the owner then gives the go for **WP-1** (database foundation, settings, permissions, signature meanings, approval-assignment model).
