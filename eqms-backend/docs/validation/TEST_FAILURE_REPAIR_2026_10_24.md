# Test failure repair — 2026-10-24

Owner request: repair the four FE failures and the one BE failure reported before commit 82e2393.

## Invariants and scope

- Preserve the dashboard's existing Donut default. Explicitly select Bar before testing Bar; keep both directions and mutually exclusive charts asserted.
- Explorer navigation tests retain real rendering, navigation and API mocks; disable only animation presence/exit scheduling in this functional suite. Production animation and UI are unchanged.
- TrainingLinkService keeps actor/document authorization before reading training metadata, all lifecycle/completion rules and the ISO machine-date contract. Read the attendance timestamp as its JDBC type, derive LocalDate in the approved site zone, and never slice display text. No DB, audit, signature, artifact, parent/child transition or async mutation is introduced.
- GitNexus upstream impact of TrainingLinkService.describe: LOW, two direct callers (forDocument/forRevision), zero indexed processes. Test helpers/files are not indexed; impact lookup returned not found rather than a proven zero impact.

## Evidence and limitations

- Original FE report: two obsolete Bar-default expectations, plus two Explorer folder waits failing during the full concurrent suite. The Explorer issue is suspected animation/RAF scheduling contention; do not claim a production navigation defect without runtime evidence.
- Original BE DateFormatGuardTest identifies TrainingLinkService slicing attendance_sent_at text. Existing date-display change record states API/native DB values remain machine types and the site zone is Asia/Ho_Chi_Minh.
- Add unit evidence for both sides of site midnight, null attendance date, and denial before database reads. Record execution results after running targeted and full tests.
- Referenced system evidence conventions and standard change-record template are absent from this checkout. This scoped record follows the available validation records; it does not establish GMP compliance or release approval.
- Execution: targeted FE suites passed 27/27; full FE suite passed 910/910 (report generated at target/fe-repair-full.json, not committed). TypeScript npx tsc --noEmit --pretty false passed.
- Execution: TrainingLinkServiceTest (4), DateFormatGuardTest (6), DateTimeFormatUtilsTest (7) passed. No guard rule was removed or allowlisted to hide the failure.
- Regression: reran the same seven BE suites used before the push plus TrainingLinkServiceTest: 61/61 passed. Repeated the two targeted FE suites after the last assertion changes: 27/27 passed.
- GitNexus detect-changes returned no indexed changes despite the explicit three-file Git diff. This is an index coverage limitation, not proof of no impact; the source method's upstream impact and Git diff were checked separately. No commit or push is included in this repair request.

Rollback: revert these source/test changes; no schema or business data rollback is needed.
