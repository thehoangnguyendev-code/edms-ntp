# Obsolete rollback notification assurance — 2026-11-13

## Request and scope

User requested fixing the two failing BE tests reported with commit `7c9a0262`, with particular scrutiny of notification behavior when Obsolete rolls back. Changes are limited to two test classes; no production service, permission, endpoint, migration or lifecycle rule is changed.

The referenced change-record template and `docs/system/00_EVIDENCE_CONVENTIONS.md` are absent in this checkout. This record captures the scope, invariant, source/test evidence and limits explicitly.

## Invariants

- Existing actor, authorization, object scope and single-use signature validation remain unchanged.
- A rolled-back Document Obsolete must leave Document ACTIVE, its Effective Revision EFFECTIVE and the distributed Controlled Copy DISTRIBUTED.
- Business audit and electronic-signature rows of the rolled-back action must not remain.
- An Obsolete event published inside a transaction must not cause notification dispatch if that transaction rolls back.
- Unrelated committed notifications, including those reaching the same user later, remain valid and must not be mistaken for this action's work.
- No file/artifact generation or checksum behavior is changed.

## Findings and changes

### Notification appearance assertion

Source-confirmed: `NotificationPolicyService.updateAppearance` accepts six-digit hex colors as well as legacy named tones. Governance decision D26f explicitly permits this behavior. The invalid-tone test still expected the older named-color-only error wording.

The test now asserts `IllegalArgumentException` and the documented `#RRGGBB` guidance, retaining its invalid icon/tone inputs and no-save check. The server validation is unchanged.

### Rollback observation scope

Test-confirmed baseline: the original TC-DOC-072 passed alone (`obsolete-rollback-before.log`) but failed in the previous combined run. It reused the same author as other tests and checked event type plus timestamp. A previous async listener can legitimately finish after the next test starts; timestamp alone cannot identify an attempt. The dispatcher `never()` check also matched every document's event.

The notification helper now restricts rows to the unique document numbers created by the current test instance, using the related entity number or the dispatcher metadata's documentNumber. Retry/failure checks and `never()` dispatch assertions are similarly scoped to the exact document. No assertion was removed to obtain a pass.

### Stronger rollback coverage

- Original fault injection: assert the intended Controlled Copy audit exception caused the rollback, and that it occurred before DocumentObsoletedEvent publication.
- New integration scenario: call the real Obsolete service inside an outer transaction, assert the real producer published its document-specific event, then explicitly roll the transaction back. This exercises the actual `@TransactionalEventListener(AFTER_COMMIT)` boundary rather than merely failing before event registration.
- Insert a real unrelated notification for the same user inside the observation window and verify it exists. The rollback checks must still succeed. This fixture alone is removed by exact ID in a finally block.
- Both rollback paths verify the parent/child statuses, absence of retained business audit/signature rows, absence of target-document in-app/failure work in bounded observation windows, and no target-document NotificationDispatcher invocation. The existing positive commit tests continue to require real notifications for their own documents.

## Impact and test evidence

GitNexus: TC-DOC-072, notificationsFor, newActiveDocument and DocumentObsoleteNotificationTest resolved LOW with zero indexed production callers/flows. NotificationWordingAndChannelsTest was not indexed; direct source review confirmed the edit is confined to its invalid-input assertion. No production symbol was edited.

Focused run: **20 tests passed** across DocumentObsoleteNotificationTest (10) and NotificationWordingAndChannelsTest (10), including the new after-event rollback scenario.

Regression: the same 88 BE test classes selected before the push completed successfully: **841 tests, 0 failures, 0 errors, 41 skipped** (800 executed tests passed). Read-only SQL after the focused runs found zero document.obsoleted notifications whose document number starts with the rollback fixture prefix TCDOC072. GitNexus detect_changes reported LOW / zero affected production flows, with source changes confined to the two test files. Local logs: `target/obsolete-rollback-before.log`, `target/obsolete-notification-fix-tests.log`, `target/obsolete-notification-regression.log`, `target/obsolete-notification-detect.log`.

Integration context requires an outbox encryption key. Runs used a fresh random 32-byte key injected only into the Maven child process through Spring properties. No real server key was read, logged or committed. Integration tests use the existing dev PostgreSQL fixture setup; their lifecycle records are test data and not production validation evidence.

Limits: bounded local integration tests do not prove multi-instance safety, SMTP delivery, crash recovery or GMP compliance. Production code and Docker containers were not redeployed or restarted.

## Rollback

Revert these two test-file changes and this record only. No DB migration or production behavior rollback is required; preserve unrelated workspace changes.
