# Change record: Backup & Restore P3, slice 1 (restore rehearsal in a separate worker)

Date: 2026-10-09 · Environment: DEV only · Basis: SDS 11.1-11.2, 14.1, 14.3 · Status: slice 1 of P3. Restore into validation or production, the lock (11.5), Super Administrator (11.6) and the restore approval flow are NOT built.

## What changed
- Agent: control migration `V5__restore_rehearsal.sql` (`restore_rehearsal`, append-only `restore_rehearsal_check`, job type REHEARSAL). `RestoreRehearsalService`: request (audited by the API), run (worker only): verify manifest signature, check the private key is in the ring, decrypt and restore the dump into a scratch database named `eqms_restore_<id>`, run checks C1, C2, C3, C4, decrypt every stored document and compare its SHA-256 (C6), compare the document index with the manifest (C6_INDEX), drop the scratch database in all cases. `RestoreKeyring` copies the private key ring into a temporary folder per run. `PostRestoreChecks`.
- Process split: `AGENT_ROLE=RESTORE_WORKER` takes only REHEARSAL jobs and does not run scheduler, ledger startup check or the stale-run check. API role does not take REHEARSAL jobs. `docker-compose.backup-restore.yml` runs the worker: private key read-only, T1 read-only, document signing key read-only (without it the worker would generate a new key in DEV), role `eqms_restore`. `scripts/backup/provision-restore-worker.sh` creates the role (login and create database, not superuser, owns no eQMS data).
- Backend: `V565` (`backup.restore.test`, dependency on `backup.module.view`, granted to SYSTEM_ADMINISTRATION), `BackupRehearsalController` (list, get, request). Request is audited.
- Frontend: Test Restore button and Restore Tests section on Backup Details (button needs `backup.restore.test` and a passing backup).

## Impact
Adds control-DB tables and a job type. The API process was not changed in behaviour. No production table is written by the rehearsal.

## Evidence
- Agent 124 tests pass (RestoreRehearsalTest 10: success, request refusals, one open rehearsal at a time, restore failure with alert and scratch dropped, key missing means nothing restored, wrong row count fails C2, wrong schema version fails C1, altered document fails C6, worker and API take separate jobs, list filters). One run hit a transient database connection error in set-up of another class; re-run passed 22/22.
- Backend: BackupRehearsalControllerTest 5 pass; other backup controllers unchanged and passing.
- Frontend: backup-restore 59 pass; tsc clean except two old errors in `ReportLists.test.tsx`.
- Real stack, DEV: API process has no `/restore-keys` (checked). Rehearsal `RH-20261009-0001` PASSED: signature valid, key `9E084A71AF15D574`, restore 14 s, C1 schema 564, C2 134 tables and 999 large objects, C3 250 foreign keys, C4, C6 1,310 documents 369,030,396 bytes all match, C6_INDEX 1,310 versions. Scratch database removed; ledger verifies. `scripts/backup/p3-rehearsal-e2e.sh` 18/18.

## Defects found and fixed
- D-8 Test fixture inserted a row with an id the copied sequence already used; test data error, fixed in the test.
- D-9 Two stale containers in state Created from an interrupted deploy blocked the backend recreate; removed those three, redeployed.

## Deviations and limits
See SDS 23.9 (P3 rows). Main: C5, C7-C13 not run; C4 cannot prove chain continuity (audit table has no sequence number or hash chain); no weekly or monthly schedule; the private key lives on this PC in DEV; restore paths (R0-R12), lock, Super Administrator and Register Imported Set not built.

## Rollback
Stop the worker (`--profile restore-worker`); the API keeps working. Rehearsal rows are evidence and stay. Role `eqms_restore` can be dropped in DEV if no longer needed.
