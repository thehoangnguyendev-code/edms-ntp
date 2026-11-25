# Workspace demo update — 2026-11-25

Owner request: update local Docker applications and push all completed workspace
source, migrations and related documentation to the existing GitHub main branch.
This is a local demo update, not a QA approval for regulated production release.

## Included scope

Completed Training activity/session/document-source changes and migrations
V843–V856, notification events/placeholders, UI translations, Loading UI Branding,
video-preview test isolation, and Notifications Administration definition/route
cleanup. Their design/decision and change records are included in the same source
snapshot. No additional business behavior was implemented during deployment.

## Executed checks

- Git main and origin/main started synchronized; no merge conflicts. The owner
  confirmed other editing chats had completed. Source content hashes were checked
  again before staging and deployment.
- Frontend full run: 2367/2367 passed. After the final changes, the affected route,
  notifications and Training suites passed 126/126; i18n passed 8/8. TypeScript and
  final production build passed.
- Selected backend regression run: 610 tests, no assertion failures. Five tests in
  TrainingAdministrationPermissionTest initially could not initialize without the
  outbox key; all five passed on rerun with the existing key supplied only to the
  test process. NotificationPlaceholderContractTest now passes. These results are
  not a claim that every backend integration suite was rerun successfully.
- An earlier full backend attempt was interrupted while another chat was using
  the shared dev DB; it is not counted as a passing full-suite run.
- Backend and frontend Docker images built. Only application services were
  selected for update; data volumes and supporting service containers were kept.
  The existing dev database reports successful Flyway migrations through V856.
- GitNexus detect_changes compared against main and checked staged scope before
  commit: 431 changed indexed files / 1531 symbols / 81 affected processes,
  aggregate CRITICAL due to the completed workspace-wide changes.
- Staged source was scanned for private keys, tokens and local environment secret
  values. Findings were pre-existing default development credentials and ordinary
  password validation text/route labels; no newly added secret was identified.
  Real .env files/outbox key, Python caches, local tooling and temporary probes
  were excluded and retained locally. Vendor blank-line trailing whitespace is
  present in the manually integrated loading components; no runtime effect.

## Evidence

Local logs/reports: `%TEMP%/eqms-push-20261125/`: frontend-tests.json,
frontend-final.json, i18n-final.log, backend-final.log,
backend-permission-recheck.log, tsc-final.log, frontend-build-final.log,
docker-final-build.log, docker-frontend-final.log, docker-update.log,
gitnexus-compare.log, gitnexus-staged.log, scan-final.json and source snapshots.
No key value or environment file is included in this record.
