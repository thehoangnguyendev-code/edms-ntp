# Training Module — Master Development Plan

**Status:** Draft for QA / Process Owner review  
**Scope:** Independent Training Management module with controlled integration to Document Control  
**Prepared:** 2026-09-21

## 1. Purpose and compliance baseline

The target module must manage training programmes, assignments, learner evidence, competency
records and compliance reporting. It must work independently, but must be able to create and
trace training obligations resulting from a controlled Document Revision.

This plan uses EU GMP Chapter 2 as the training-process baseline: approved programmes, initial
and continuing training appropriate to duties, periodic practical-effectiveness assessment and
retained training records. It uses the current Annex 11 as the computerised-system baseline:
quality risk management, validation, controlled access, audit trails, electronic signatures,
backup and retrievable records throughout retention.

Primary references:

- [EU GMP Chapter 2 — Personnel](https://health.ec.europa.eu/document/download/11f4f8e6-a6e9-4897-afe3-f21e1dc56cb8_en?filename=2014-03_chapter_2.pdf)
- [EU GMP Annex 11 — Computerised Systems](https://health.ec.europa.eu/document/download/8d305550-dd22-4dad-8463-2ddb4a1345f1_en)
- [EudraLex Volume 4 index](https://health.ec.europa.eu/medicinal-products/eudralex/eudralex-volume-4_en)

> The Annex 11 revision published for consultation must be treated as future-readiness input,
> not an effective requirement, until its final legal status is confirmed.

## 2. As-is assessment (source-confirmed)

### Frontend

- `eqms/src/features/training/` already contains screens for course inventory, materials,
  assignments, compliance, learner training and training records.
- Many screens still import `MOCK_*` data and perform client-side filtering/aggregation.
- `eqms/src/services/api/training.ts` describes a proposed API surface but uses loose `any`
  contracts.
- Training routes and basic permission guards already exist in
  `eqms/src/app/routes/TrainingRoutes.tsx`.

### Backend and document integration

- A focused `TrainingAuthorizationService` exists, but the source tree does not currently contain
  a complete Training controller/entity/repository/service domain.
- Document Revision already has a `Pending Training` stage, a training-information tab and
  signature-supported completion flow.
- Current document-training permissions include `documents.training.manage` and
  `documents.training.complete`.

### Consequence

The existing frontend is a valuable UI foundation, but it must not be treated as an implemented
GMP Training module until the server domain, controlled data model, server-side authorization,
audit evidence and validation package are delivered.

## 3. Decisions required before implementation

These are business and quality decisions. They must be approved by named QA / Process Owners;
implementation must not invent them.

1. What constitutes completion for Read & Understand, quiz, OJT, classroom and external training?
2. Passing score, maximum attempts, failed-attempt handling and retest rules.
3. Retraining triggers: periodic recurrence, role/department change, document revision, CAPA,
   deviation or manual assignment.
4. Exemption/waiver authority, mandatory evidence, expiry date and impact on compliance.
5. Extension authority, reason, approval and whether overdue status remains visible.
6. Document revision impact rule: close, preserve, supersede or reassign prior obligations.
7. Course/material obsolescence rules and effect on open assignments.
8. E-signature matrix: which actions require it, signature meaning and re-authentication policy.
9. Retention periods, archival medium, certificate policy and legal-hold requirements.
10. Offline training and historical-data import evidence requirements.

## 4. Target operating model

```text
Document Revision effective
        |
        +-- impact assessment
        |     +-- no training required -> rationale + approval + audit
        |     '-- training required
        |
Course Definition -> approved/effective Course Version
        |                    |
        |                    +-- immutable linked Document Revision snapshot
        |                    '-- assignment rules
        |
Assignment / Learning Plan -> learner activity -> assessment or OJT
        |                                        |
        '----------------------------------------+-> immutable Training Record
                                                       + e-signature + audit
```

### Invariants

- Course, material, assessment and policy are versioned. A completion record always points to the
  exact immutable version learned.
- A record is never recalculated from the current course or current document revision.
- Documents remain owned by Document Control. Training stores an authorized foreign key and a
  snapshot of revision metadata/checksum; it does not duplicate or mutate the controlled file.
- The server performs eligibility, assignment, lifecycle, search, sorting, pagination, compliance
  calculation and authorization. The frontend never infers access or policy outcomes.
- All GMP-relevant mutation is attributable, auditable, reasoned where policy requires, and
  protected from replay or silent overwrite.

## 5. Functional scope

| Area | Required capability |
|---|---|
| Course catalog | Draft, review, approve, make effective, revise, obsolete/archive courses |
| Training content | Controlled document links or managed materials; version, checksum, preview and access control |
| Assignment | Individual, bulk and rule-based assignment; due dates, reminders, escalation, exemption and extension |
| Learner workspace | My Training, read/acknowledge, quiz, attempt history, OJT evidence, e-signature and status |
| Instructor/OJT | Training sessions, attendance, trainer/evaluator qualification and trainer sign-off |
| Compliance | Matrix, overdue, expiring/retraining, per-course and per-department views |
| Records | Immutable completion record, dossier, approved certificate policy and controlled export |
| Document integration | Revision impact assessment, traceability and reconciliation of generated obligations |
| Administration | Taxonomy, templates, assignment policies, notification policy, permissions, retention and integrations |
| Quality operations | Audit trail review, failed-job reconciliation, deviation hooks, validation and periodic review |

## 6. Frontend plan

### 6.1 Target feature structure

```text
eqms/src/features/training/
  api/                  typed API adapters and query keys
  shared/
    components/         badges, server table, audit timeline, record evidence
    hooks/              capabilities, server filters and permissions
    types/              API DTOs and stable machine values
  courses/
    list/ detail/ editor/ workflow/ impact/
  materials/
    list/ detail/ versioning/
  assignments/
    list/ create/ rules/ bulk/
  learner/
    my-training/ activity/ assessment/ acknowledgement/
  sessions/
    roster/ attendance/ ojt/
  compliance/
    matrix/ dashboard/ overdue/ retraining/
  records/
    dossier/ certificates/ exports/
  administration/
    taxonomy/ templates/ policies/ integrations/
```

### 6.2 UI/UX rules

- Every page has independent `PageHeader`, breadcrumb and permission-aware actions.
- Use shared UI only: `FormSection`, `Select`, `TablePagination`, `FilterDrawer`, `Badge`, modal,
  toast, loading, empty/error and confirmation components.
- Tables use server-side pagination, filter and allowed-sort values; preserve query state in URL.
- Desktop uses tables/panels; tablet/mobile uses stacked cards and filter drawer. No critical action
  may become unreachable at a smaller breakpoint.
- Status is conveyed by label + icon + badge, never colour only.
- A learner completion follows a clear evidence flow: activity -> validation -> confirmation ->
  electronic signature where required -> server outcome.
- Replace each `MOCK_*` source only when its matching end-to-end API vertical slice is ready. Do
  not combine live and mock rows in the same regulated screen.

### 6.3 FE delivery slices

1. Typed client contracts, server tables and common status/audit components.
2. Course list/detail/editor and lifecycle.
3. Assignment list/create/bulk workflow and My Training.
4. Assessment, OJT/session and record evidence.
5. Compliance, dossiers and export jobs.
6. Administration and document-impact workspaces.

## 7. Backend architecture

```text
controller/training/
service/training/
  CourseService
  CourseWorkflowService
  AssignmentService
  LearnerActivityService
  AssessmentService
  TrainingRecordService
  DocumentTrainingIntegrationService
  ComplianceQueryService
  TrainingAdminService
  TrainingAuthorizationService
repository/training/
entity/training/
dto/training/
event/training/
worker/training/
```

### 7.1 Command invariant

For every mutation:

1. Authenticate actor and load the current object in one transaction.
2. Re-authorize actor, object/department scope and lifecycle preconditions in the server.
3. Validate invariant, expected optimistic-lock version and idempotency key.
4. Persist business state, immutable audit event and outbox event atomically.
5. Async worker re-reads state/version before notification, certificate, export or bulk completion.
6. Return server-calculated status, capabilities and stable reason codes.

### 7.2 Permission model

Replace broad catalog management with granular, server-enforced permissions:

- `training.module.view`
- `training.course.view`, `training.course.manage`, `training.course.review`,
  `training.course.approve`, `training.course.obsolete`
- `training.material.view`, `training.material.manage`
- `training.assignment.view`, `training.assignment.manage`, `training.assignment.cancel`,
  `training.assignment.extend`
- `training.session.manage`
- `training.record.view`, `training.record.manual-entry`, `training.record.export`
- `training.compliance.view`
- `training.admin.manage`
- `training.audit.view`

Each permission needs object scope: own, assigned audience, department, delegated department or
all. UI capability flags are hints only; every command is authorized again by BE.

## 8. Database design

All records use UUIDs, UTC timestamps, actor references, optimistic version where mutable and
explicit foreign keys. Migration names/numbers will be allocated only after the current migration
head is checked.

| Table | Purpose |
|---|---|
| `training_courses` | Stable course identity, unique code, owner, lifecycle state |
| `training_course_versions` | Immutable approved/effective course snapshot and assessment configuration |
| `training_course_document_links` | Version-to-Document Revision link, revision checksum and impact policy |
| `training_materials`, `training_material_versions` | Managed or linked material versions, storage checksum/version |
| `training_assessment_definitions`, `training_questions`, `training_question_options` | Version-bound assessments; answers not disclosed to learners |
| `training_assignment_rules`, `training_rule_targets` | Effective-dated audience/rule configuration and precedence |
| `training_assignments` | Learner obligation, source rule, due date, status and idempotency constraints |
| `training_assignment_events` | Immutable assignment timeline |
| `training_sessions`, `training_session_attendance`, `training_ojt_evidence` | Attendance and qualified OJT evidence |
| `training_attempts`, `training_attempt_answers` | Attempt/score snapshot and graded evidence |
| `training_records` | Immutable completion evidence and stable record code |
| `training_record_signatures` | Link to existing e-signature/token model; no plaintext secret/token |
| `training_exemptions`, `training_extensions` | Reason, approver, effective/expiry date and decision evidence |
| `training_document_impacts` | Document event, impact decision, rationale and generated batch link |
| `training_notification_jobs`, `training_export_jobs`, `training_outbox` | Durable asynchronous processing and retries |
| `training_audit_events` | Append-only GMP audit: old/new values, reason, actor, timestamp, correlation ID |

Essential indexes include learner/status/due-date, course-version/status, department/status/due-date,
linked revision, outbox job claims and keyset-pagination sort columns.

No GMP record is physically deleted. Delete is only permitted for approved-policy draft objects with
no regulated use; all other cases use archive/obsolete and retain history.

## 9. API plan

All collection APIs accept capped `page`, `limit`, typed filters, `sortBy` allow-list and `sortDir`.
They return:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 25, "total": 0, "totalPages": 0 },
  "facets": {}
}
```

### Primary endpoint groups

- `GET/POST /training/courses`; `GET/PUT /training/courses/{id}`
- `POST /training/courses/{id}/submit|approve|reject|make-effective|obsolete`
- `GET /training/course-versions/{id}`
- `GET/POST /training/materials` and controlled material/version endpoints
- `GET/POST /training/assignments`; `POST /training/assignment-batches`
- `POST /training/assignments/{id}/start|acknowledge|submit-attempt|complete|request-extension`
- `GET/POST /training/sessions`; attendance and OJT sign-off commands
- `GET /training/me/assignments` and `GET /training/me/assignments/{id}` (self-scope forced by BE)
- `GET /training/compliance/*`; async export endpoints returning export-job state
- `GET /training/records`, employee dossier and authorized certificate retrieval
- `POST /documents/revisions/{id}/training-impact-assessments`
- Internal events: `DocumentRevisionEffective`, `DocumentRevisionObsoleted`,
  `UserDepartmentChanged`, `UserDeactivated`

Mutating requests include `Idempotency-Key`. Conflicts return `409` with a stable reason code;
the server never silently overwrites an optimistic-lock conflict.

## 10. Document Control integration

1. An effective Document Revision publishes a durable `DocumentRevisionEffective` outbox event.
2. The Training integration worker re-reads the revision and evaluates approved rules using a
   revision snapshot, not mutable document data.
3. If training is required, it creates an idempotent assignment batch. If not required, it records
   rationale, approval and audit evidence.
4. A completion record stores `document_revision_id`, revision number and checksum.
5. A later Document Revision never rewrites prior assignments or records; it creates a new impact
   decision under the approved rule.
6. Document obsolescence triggers approved impact handling; it never deletes training history.
7. Both modules expose authorized deep links and traceability: Document Revision -> impact ->
   course/assignments/records, and the reverse path.

## 11. Administration scope

- Course type, delivery mode, competency/role taxonomy.
- Course templates and approved training-program templates.
- Assignment-rule builder: target, due-date formula, recurrence, escalation, conflict precedence.
- Assessment, retraining, exemption, extension, manual-entry and external-provider policies.
- Notification templates and schedules, preview/versioning and channel controls.
- Instructor/evaluator qualification directory.
- Retention/archive policy and controlled export/report definitions.
- Document-event outbox health, failed-job retry and reconciliation dashboard.
- Permission/scope matrix and audited role changes.
- Periodic-review dashboard: overdue, stale rules, failed jobs, inactive courses with open
  assignments and records approaching expiry.

## 12. Security and data integrity controls

- Server-side RBAC plus object/department scope for every query and command.
- Learner APIs force current-user scope; no client-supplied learner identifier may widen access.
- Enforce approved segregation of duties between author/reviewer/approver/instructor/evaluator.
- E-signature is permanently linked to record/action, identity, timestamp and meaning; use
  single-use tokens and replay prevention.
- Append-only audit for creation, change, completion, exemption, correction, deletion attempt and
  permission-sensitive read/export.
- File malware/type/size validation, checksum/object version, authorization recheck at download,
  signed short-lived download URLs and retention-aware storage.
- Encryption in transit/at rest, secret separation, rate limits, sort allow-list and PII-minimised
  exports.
- Backup/restore testing, archive retrieval testing, incident/deviation handling and reconciliation
  of DB/storage/worker failure.
- Design to ALCOA+: attributable, legible, contemporaneous, original, accurate, complete,
  consistent, enduring and available.

## 13. Validation and test evidence

### Required validation records

- Intended use and system boundary.
- User Requirements Specification (URS).
- Quality risk assessment and data-integrity assessment.
- Design specification and configuration specification.
- Traceability matrix: URS -> risk -> implementation -> test evidence.
- Test protocols/results, deviations, CAPA, release approval and training/SOP evidence.

### Test layers

- Unit: lifecycle, due date, recurrence, scoring, exemption and rule-precedence logic.
- Integration: authorization denial, wrong object scope, stale version, duplicate batch request,
  document-event replay and worker retry.
- Security: IDOR, forged completion, expired/wrong-owner/replayed signature token, restricted
  download and export leakage.
- End-to-end: Document Revision -> impact -> assignment -> learner completion -> signed immutable
  record -> compliance/export.
- Performance: server filtering/pagination at production-like volume; bulk assignment/export load.
- Failure injection: storage outage, notification failure, DB rollback after file operation,
  partial import and outbox retry.

## 14. Delivery roadmap

### Phase 0 — Governance and design baseline

Approve decisions in section 3, establish URS, lifecycle maps, risk assessment, scope matrix,
data classification, owner roles and validation strategy.

### Phase 1 — Core catalog

Deliver schema foundation, typed API contracts, Course/Version/Material lifecycle, audit and
e-signature integration. Replace course/material mocks with server data.

### Phase 2 — Assignment and learner workspace

Deliver manual/bulk/rule assignment, durable assignment batches/outbox, reminders, My Training,
acknowledgement and controlled learner state.

### Phase 3 — Assessment and evidence

Deliver quiz attempts, OJT/session attendance, evaluator controls, signature-supported completion
and immutable training records.

### Phase 4 — Document Control integration

Deliver impact assessment, event/outbox integration, revision snapshots, idempotent assignment
generation and reconciliation dashboard.

### Phase 5 — Compliance and administration

Deliver server-side matrix/dashboard, records/dossier/export, policy/rule administration,
operational monitoring and periodic review.

### Phase 6 — Migration, validation and release

Import legacy evidence with reconciliation, execute IQ/OQ/PQ-equivalent evidence, conduct QA UAT,
approve release, train operators and perform hypercare.

## 15. Definition of done per vertical slice

A feature is done only when it has:

1. An approved requirement and named business owner.
2. Server-side authorization, scope, validation and stable machine reason codes.
3. Versioned/immutable evidence where the process is GMP-relevant.
4. Audit/e-signature behavior aligned to approved policy.
5. Server-side filtering/sort/paging/aggregation for non-trivial lists.
6. Responsive shared-UI implementation with loading, empty, error and conflict states.
7. Positive, negative, authorization, concurrency and failure-path tests.
8. Updated traceability and validation evidence.

