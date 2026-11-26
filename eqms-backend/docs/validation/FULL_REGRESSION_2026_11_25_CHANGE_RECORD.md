# Full frontend/backend regression — 2026-11-25

Status: verification complete; this is executed test evidence, not QA release approval.

## Authorized scope and invariant

Owner requested rerunning all frontend/backend tests and fixing failures without
changing business logic. Application permissions/object scope, lifecycle and
parent-child effects, email recipient rules, audit/signature requirements,
persisted artefact versions/checksums and async generation remain unchanged. The
printed last-trained date is displayed with the existing date utility; newly
generated PDF fingerprints continue to be computed from their formatted content.

TC-DOC-064 now creates an unprivileged
recipient-only user instead of choosing an arbitrary active seed user who may
also have the DCO permission. The negative assertion is retained and its fixture
precondition explicitly asserts no `documents.workspace.manage` permission. The
test-created user is deactivated in cleanup; historical references are retained.
No notification service, permission implementation or schema migration is edited.

Additional fixes after the configured-snapshot full run:

- ControlledCopyEndToEndIntegrationTest and UncontrolledCopyValidityIntegrationTest
  write policy fixtures directly, bypassing service cache eviction. They now evict
  the exact test cache entry immediately before/after fixture writes and in cleanup.
  `evictIfPresent` is intentional: a transaction-aware after-commit eviction would
  never execute when the enclosing test transaction rolls back. Download/print
  refusal assertions are retained, with explicit disabled-policy preconditions.
- ControlledCopyListAuthorizationIntegrationTest creates a transaction-local
  unprivileged requester and a copy for another recipient for the negative test;
  it no longer skips merely because all existing requesters have blanket access.
  Preconditions assert the requester lacks blanket visibility and is not the recipient.
- DocumentListVisibilityParityIntegrationTest reads UUIDs first and hydrates only
  returned and sampled records. Every returned record is still checked, as is the
  existing outside-list sample when the list is complete; page/user/sample limits
  are unchanged. Unknown IDs now fail instead of escaping the entity-list loop.
- Surefire retains one Spring test context: older contexts' schedulers/outbox
  workers are closed before a different fixture context operates on the same DB.
  There is no change to application cache behavior or deployment configuration.
- AuditObjectRegistry registers the already-emitted TRAINING_COMPLIANCE key under
  the existing Training Compliance menu, as technical print evidence. Raw audit
  entity/action strings, persistence and mandatory audit behavior are unchanged.
- TrainingPrintService.gaps uses DateTimeFormatUtils.display for lastDone (an ISO
  date produced by TrainingRows from a SQL date) instead of cutting ISO text. The
  source date and the compliance/annual-training rules are unchanged.
- DocumentLifecycleBaselineTest counts audit rows for the newly created Document,
  rather than all objects in the database. Independent scheduler audit events no
  longer cause a false failure. The one CREATE event, DRAFT state and absence of
  an electronic signature are still asserted.
- ReportTemplateDatabaseTest includes the schedule_number column added in V798,
  configures its authorization-engine dependency (active manager allowed, inactive
  actor denied), and injects audit failures into the current nine-argument logAs
  overload. The existing rollback, immutable-file, version and scope assertions
  remain. It registers its own real chart renderer so PDF checks also pass when
  the class runs alone, independent of another test's static registration.
- ReportDocumentSourcesDatabaseTest expects the current 23 source types, including
  Permission Holders, and checks distinct codes. All provider SQL/filter/lookup
  checks still run against PostgreSQL.
- MinioStorageLiveTest creates its own clean, locked records object through the
  real storage service in a disposable MinIO. It no longer skips on a new server
  because an unrelated earlier verification object is absent. Domain rejection,
  template routing, EICAR refusal and version-specific deletion refusal remain.

GitNexus impact for the edited test classes/methods and AuditObjectRegistry/KINDS:
LOW, no direct callers or affected application processes. TrainingPrintService.gaps
has one direct caller at LOW risk; its class has two. This is a
fixture correction, not a new rule about who receives obsolete notifications.

## Environment and baseline

- Source at start: ebda4bbf400cd0b6f7998153baf015838c52f702. Existing repository
  cleanup (.gitignore and staged nested Git metadata deletions) is unrelated and
  preserved. This task does not stage, commit, push or restart the applications.
- Windows, Node 22.12.0, npm 11.11.0, Java 23.0.1, PostgreSQL 17; migrations V856.
- Frontend: full Vitest run using three workers, all tests included.
- Backend: full Maven test run, no test selection/exclusion. Test-scoped outbox
  key supplied through process environment only, never printed or committed.
- Initial host run against the dev DB was stopped when unavailable Docker-only
  Redis and dependence on the live data made it unsuitable for an isolated run.
- A fresh separate database was migrated successfully but exposed numerous old
  tests' documented assumptions about already-configured active dictionaries,
  access profiles, sample documents/copies and users. Its exploratory result was
  3177 tests, 15 assertion failures, 51 errors, 92 skipped; this is not a green run.
- A second separate database is a pg_dump/pg_restore snapshot of the configured
  dev database. Copied job queues/outbox were emptied before application contexts
  started; SMTP is routed to local MailHog in this test database. It uses dedicated
  test Redis on 127.0.0.1:16379. The live application's configuration, queues and
  Redis are not changed. After verification both test databases and the temporary
  pg_dump file were removed. All four labelled disposable test containers and
  their owned anonymous volumes were removed; application containers were untouched.

## Results

- Frontend full run: 2367/2367 passed, zero failed/skipped tests.
- Backend configured-snapshot baseline full run: 3177 tests, 5 failures, zero
  errors, 65 skipped. Failures were two controlled-copy policy fixture cache cases,
  one uncontrolled-copy policy fixture cache case, missing audit registry metadata
  and the display-date guard. These findings drove the changes listed above.
- Backend clean full rerun after corrections: 3177 tests, one failure, zero
  errors, 62 skipped. The remaining failure was the global audit counter above;
  the entire DocumentLifecycleBaselineTest class then passed 23/23 after fixing it.
- All 62 opt-in cases were subsequently enabled using disposable PostgreSQL
  (127.0.0.1:55439/async_test), chart renderer (13100), MinIO (19000), test Redis
  (16379) and the local ClamAV. These exposed the Report fixture issues above.
  The nine opt-in classes ran 68 cases (including six unconditional cases), zero
  skipped after fixture fixes; ReportTemplateDatabaseTest was finally rerun alone:
  29/29 passed, including audit-failure rollback and real PDF/chart generation.
- Consolidated latest results across all backend classes: 3177 tests, zero
  failures, zero errors, zero skipped. This is the full clean suite plus affected
  class/opt-in reruns, not a claim that a single final full Maven command was green.
- Obsolete notification coverage: DocumentObsoleteNotificationTest 10/10 passed,
  zero skipped; controlled-copy end-to-end 14/14, copy list authorization 5/5 and
  uncontrolled-copy validity 4/4 passed. No notification recipient rule was changed.
- The list/detail parity test kept its coverage while runtime fell from 325.9s
  in the snapshot baseline to 64.77s in the full rerun by avoiding full hydration.
- Frontend rerun on the later source: 2367/2367 passed; hashes of all 1672 tracked
  frontend source/config files remained unchanged during that run.
- Ten later frontend translation edits were preserved and checked with 26 affected
  test files: 240/240 passed. A fresh source hash comparison showed no further
  changes during this recheck. TypeScript and production Vite build passed on this
  latest source. The build retains a non-failing large-chunk warning.
- Git diff whitespace check passed. GitNexus detect_changes (unstaged and compare
  against main) reports 37 files/97 symbols/17 processes on the final comparison,
  overall CRITICAL, including the separate chat's
  shared frontend/i18n edits. This task made no frontend edits; individual upstream
  impacts for this task's edited symbols were LOW as reported before editing.

Evidence is outside Git at `%TEMP%/eqms-full-regression-20261125/` (Vitest JSON,
Maven logs, fresh-database reports and isolated infrastructure diagnostics).
`backend-consolidated-summary.json` and `backend-consolidated-reports/` preserve
the latest result of every one of the 448 backend test classes.
The older evidence/template paths referenced by the validation skill are absent
in this checkout; this record states the executed scope and limitations directly.
