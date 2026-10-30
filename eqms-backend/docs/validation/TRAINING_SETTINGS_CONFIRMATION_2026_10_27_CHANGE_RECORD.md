# Training Properties: confirmation without reason

Decision: TRAINING-SETTINGS-AUDIT-WITHOUT-REASON-2026-10-27 in DECISION_LOG.md. The requester instructed that the audit contain old and new values; named QA assessment remains pending. This record does not establish GMP compliance.

## Invariants and scope

- The actor must have training.settings.manage; the server obtains the actor through CurrentUserService. Version checking, validation, locking and transaction boundaries remain unchanged.
- The audit event TRAINING_SETTINGS_UPDATED continues to record the actor and event time through AuditTrailService and lists each changed setting's old and new value. No reason is fabricated. A non-empty reason supplied by an existing API client is retained. Historical events are unchanged.
- This configuration change does not alter lifecycle transitions, parent-child effects, stored artifacts, signatures, or asynchronous generation. No schema migration is needed.
- GitNexus upstream impact was LOW for TrainingSettingsService.update (one direct caller), TrainingPropertiesView (zero), its save handler (one) and trainingSettingsApi.update (zero); no affected processes reported.

## Source and test evidence

- TrainingPropertiesView uses a confirmation-only modal and sends no reason. TrainingSettingsService accepts omitted or blank reasons and retains old/new change descriptions in its transactional audit call; the API type permits old clients to supply a reason.
- Frontend: TrainingPropertiesView.test.tsx: 3 passed, including confirmation without a fabricated reason. TypeScript npx tsc --noEmit passed.
- Backend: TrainingSettingsServiceTest: 4 passed; covers old/new audit without reason, stale-version rejection before write/audit, unauthorized actor rejection, and compatibility with a supplied reason. These are mocked unit tests, not evidence of actual database audit persistence.
- No browser or live database verification was performed. The current running backend has not been redeployed. The referenced 08_ONE_CHANGE_RECORD_TEMPLATE.md and docs/system evidence files are absent in this workspace; this follows the existing local change-record structure.

## Rollback and open item

Revert these source changes to restore the mandatory reason. No historical data or schema needs conversion. QA should assess the change before regulated use.
