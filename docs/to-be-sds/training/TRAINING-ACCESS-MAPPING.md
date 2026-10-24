# Training Management: SOP.0003.02 step → permission → suggested profile

Status: **DRAFT for QA approval.** Source: migration V626 (sample Permission Sets and Access Profiles) and `TrainingApprovalService` / `TrainingAccess`.
The SOP names positions (QM, head of QA, head of department). The system never checks a position name: a step is done by a person who holds the
permission, and review/approval steps are done by a person the submitter designates among the eligible holders. Nobody holds these sets or profiles
until an Administrator assigns them (Security & Authorization), after QA approves this table.

## 1. Step mapping

| Step in the flow chart (SOP.0003.02, 5.2) | Permission needed | Sample Permission Set | Suggested profile |
|---|---|---|---|
| Document impact: choose positions to be trained on a new/upgraded document | `training.document_impact.manage` | Training - Organizer | Department Coordinator |
| Create the activity, issue the Training Number, plan, notify, postpone, cancel | `training.code.allocate`, `training.activity.organize` | Training - Organizer | Department Coordinator |
| Designate who reviews/approves a step | `training.approval.designate` | Training - Organizer | Department Coordinator |
| Review training content and tests (chart: Departments) | `training.content.review` (designated) | Training - Content Review | Content Reviewer |
| Approve training content and tests (chart: QM; text 5.3.5: head of QA) — see D-32 | `training.content.approve` (designated) | Training - Content Approve | Content Approver, QA Manager |
| Trainer qualification: granted by QA on any topic | `training.trainer.qualified` | Training - Qualified Trainer | none; QA grants per person |
| Trainer check (qualified, or exception) | `training.trainer.exception.approve` (designated) | Training - Exception Approve | QA Manager |
| Print the paper pack | `training.paper.print` | Training - Organizer | Department Coordinator |
| Receive the attendance list and the results sent to QA (the revision is completed in Document Control after the list) | `training.attendance.receive` | the person who receives them (named by the profile, never by a position name in code) | DCO of QA |
| Conduct training, record attendance | `training.activity.conduct` | Training - Trainer | Trainer |
| Record assessment | `training.assessment.record` | Training - Trainer | Trainer |
| Type in paper attendance and scores | `training.paper.transcribe` | Training - Trainer | Trainer |
| Verify the transcription against the scan (not the typist) | `training.paper.verify` | Training - QA Closing | QA Records Officer |
| Trainee confirms attendance | `training.self.view` | Training - My Training | Employee (everyone) |
| QA confirms completion → personal Training Record | `training.activity.close` (designated) | Training - QA Closing | QA Records Officer |
| Training matrix: prepare / approve (not the same person) | `training.matrix.manage` / `training.matrix.approve` | Matrix Prepare / Matrix Approve | Department Coordinator / QA Manager |
| Training requirement: prepare / review / approve | `training.requirement.prepare` / `.review` / `.approve` | Requirement Prepare / Review / Approve | Department Coordinator / Content Reviewer / QA Manager |
| Job assignment, transfer (leads to initial training) | `training.job_assignment.manage` | Training - Job Assignment | Department Coordinator |
| Job assignment before the matrix is complete (exception) | `training.job_assignment.exception.approve` (designated) | Training - Exception Approve | QA Manager |
| Specimen signature: upload / confirm | `training.signature.manage` / `training.signature.confirm` | Signature Manage / Signature Confirm | Department Coordinator / QA Records Officer |
| Export a personal record as PDF | `training.record.export` | Training - QA Closing | QA Records Officer |
| Void a record line (reason + signature) | `training.record.void` | Training - Void Records | QA Manager |
| Other departments' data | `training.scope.all` | Training - All Departments | QA Records Officer, QA Manager, Administrator |
| Settings, topics, position mapping, notices, background jobs | `training.settings.*`, `training.admin.manage`, `training.audit.view` | Training - Administration | Administrator |

Read-only screens (activities, records, matrices, requirements, assignments, signatures, compliance): Permission Set *Training - View*, included in every profile except Employee.

## 2. Suggested profiles (made by V626, no user assigned)

| Profile | Permission Sets |
|---|---|
| Employee | My Training |
| Department Coordinator | My Training, View, Organizer, Matrix Prepare, Requirement Prepare, Job Assignment, Signature Manage |
| Trainer | My Training, View, Trainer |
| Content Reviewer | My Training, View, Content Review, Requirement Review |
| Content Approver | My Training, View, Content Approve |
| QA Records Officer | My Training, View, All Departments, QA Closing, Signature Confirm |
| QA Manager | My Training, View, All Departments, Matrix Approve, Requirement Approve, Exception Approve, Content Approve, Void Records |
| Administrator | My Training, View, All Departments, Administration |

## 3. For QA to decide

1. Does each profile match the real duty? Sets are single-duty so any combination is possible.
2. D-32: who approves content, QM (chart) or head of department and head of QA (text)? Today both are permission holders, so the profile assigned decides it.
3. Segregation of duties: the service already refuses the same person preparing and approving; QA may also want to forbid holding both profiles on one user.
4. D-10 is changed (V627): the topic condition "head of the organising department" is replaced by the permission `training.trainer.qualified` (Permission Set *Training - Qualified Trainer*, in no profile). QA grants it to named trainers. Planned sessions whose trainer relied on the old rule now need it or a trainer exception.
5. Whether `training.record.void` belongs to QA Manager or to a separate profile.

## 4. Not done / not verified

- Not verified in the application: V626 was checked only by a rolled-back run on the DEV database (19 sets, 8 profiles, 35 links). The migration is applied when the backend starts.
- Not assigned to any user; no Decision Log entry or change record yet; no `detect_changes` run.
