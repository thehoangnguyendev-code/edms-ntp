# PLAN-TR-003 - Electronic signature at each change of state of a Training Activity, and proposals for the rest of the module

Status: first part implemented on DEV on 2026-10-24 (changes of state of a Training Activity). The second part (proposals) waits for a decision of the owner.

Source of the evidence: the code of `TrainingActivityService` and the services of the module, the E2E scripts `e2e20_start_and_signatures.py`, `e2e21_matrix.py`, `e2e23_flows.py`.
This page records what the system does; it is not an approval by Quality.

## 1. Every change of state of a Training Activity is signed

| Change of state | Who signs | Meaning code (`electronic_signature_meanings`) | Before 2026-10-24 |
|---|---|---|---|
| Pending Document Approval -> Planned | nobody: the document approval of Document Control (its own signatures) opens the activity | - | same |
| Planned -> Notified (notify the participants) | the organizer | `TRAINING_ACTIVITY_NOTIFIED` (new, V645) | not signed |
| Notified -> Planned (reopen the content) | the organizer, with a reason | `TRAINING_CONTENT_REOPENED` | signed |
| Notified -> In progress (start of the first session) | the organizer / conductor | `TRAINING_SESSION_STARTED` (new, V645) | not signed (the "held" button) |
| (In progress, no change of state) Send the attendance list to QA (SOP.0003 5.3.6, APD.0117) | the organizer | `TRAINING_ATTENDANCE_SENT` (new, V646) | not a step |
| In progress -> Pending QA Confirmation (send the results to QA) | the organizer | `TRAINING_SUBMITTED_FOR_CONFIRMATION` (new, V645) | not signed |
| Pending QA Confirmation -> Completed | QA (not the person who prepared the list) | `TRAINING_COMPLETED` | signed |
| Pending QA Confirmation -> In progress (return for correction) | QA, with a reason | `TRAINING_RETURNED_FOR_CORRECTION` | signed |
| any open state -> Cancelled | the organizer, with a reason | `TRAINING_ACTIVITY_CANCELLED` | signed only after the notice; now always |

Steps that are not changes of state but were already signed and stay so: the attendee list confirmed, the content reviewed, the content approved, the self-reading confirmed and verified,
the trainer exception approved, the roll-call, the check-in of a trainee, the test signed by the trainee.

The start of a later session of an activity already in progress is not a change of state of the activity and is not signed again.

## 2. Proposals: what else in the module should be signed

Decision needed for each line. "Now" says what protects the action today.

| # | Action | Now | Proposal | Why |
|---|---|---|---|---|
| 1 | The trainer confirms the attendance of a session (all the lines) | Each line is recorded without signature when done one by one; the roll-call and the trainee check-in are signed | One signature when the attendance of the session is closed (meaning `TRAINING_ATTENDANCE_CONFIRMED` is used by the roll-call only) | The attendance list is the record that SOP.0003 5.3.7 asks to be signed in the "Signature" column |
| 2 | The trainer records a score or a result | Audit Trail only | Signed (`TRAINING_ASSESSMENT_RECORDED`, new) | A result decides a suspension of work (5.3.7) |
| 3 | Release of a test for another try | Reason and Audit Trail | Signed | It changes a result path |
| 4 | Content exemption (no material, no test) | Reason and Audit Trail | Signed by the organizer; reviewer sees it | It waives a control of PLAN-TR-002 |
| 5 | Correction of an attendance recorded by mistake | Reason and Audit Trail | Signed | It changes a record |
| 6 | Postponement of a session after the notice | Reason and Audit Trail; the trainees are told | Signed | The people were notified; a date of a controlled plan changes |
| 7 | Supplementary training for the absent or the failed | Reason and Audit Trail | Keep the reason; the sign comes with the confirmation of the new list | The new activity is signed like any other at its own steps |
| 8 | Topics, curriculums, position mapping (Training Properties tabs other than the settings) | Audit Trail | Signed when a topic or a mapping used by a matrix changes | A matrix is approved with signature; what it reads should not change without one |
| 10 | The trainee check-in with the code or the QR | Implemented 2026-10-24: the trainee signs with the password (meaning `TRAINING_ATTENDED`); the signature is kept on the attendance (`attend_signature_id`) and the list APD.0117 says "Ký điện tử khi điểm danh / Signed at check-in" | - | SOP.0003 5.3.7: the signature of the trainee in the list |
| 9 | Trainer qualification and exceptions | Exception approval signed | Also sign the declaration of a qualification | It lets a person train |

Not proposed: the checklist of Preparation, the print of a paper pack, the upload of a material: they are working steps with their own audit.

## 3. Open points

- The reason for each signature is typed by the person; the screen proposes none.
- The signing meanings `TRAINING_SESSION_STARTED`, `TRAINING_ACTIVITY_NOTIFIED`, `TRAINING_SUBMITTED_FOR_CONFIRMATION` exist in the database after V645; their display on the signature
  list of the activity follows the existing screens.

## 4. Order of APD.0117 (decided 2026-10-24)

1. Before the training: the list (sections 1 to 3, the signature boxes empty), the confirmation of the list preparer (section 4).
2. The training: the attendance is recorded and signed in the column "Signature" of section 3 (check-in with a signature, roll-call with one signature, or one by one).
3. **Send attendance list to QA** (signed step, `POST /training/activities/{id}/send-attendance-list`): needs every session held or postponed and every person recorded (present, online, absent). From then on the revision can be completed
   in Document Control ("Complete Training"), without waiting for the results; the day of the training is the completion day. People who were absent are taught in a make-up activity of their own.
4. Later the trainer scores the tests; the results are sent to QA (step "Send results to QA", signed; it sends the attendance list too when it was not sent) and the system gives Passed or Failed from the score (70%);
   QA confirms the completion (section 6). The columns of the result and of the re-training result of the list are filled from these results.
5. The people who hold the permission `training.attendance.receive` in the scope of the department are told of the list and of the results. The permission names no position: the profile that gives it
   (for example to the document control officer of QA) is a matter of Security.
