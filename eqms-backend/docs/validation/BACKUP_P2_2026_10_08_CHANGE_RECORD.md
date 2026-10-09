# Change record: Backup & Restore P2, slice 1 (backup targets and copy to T3)

Date: 2026-10-08 · Environment: DEV only · Basis: SDS sections 8 and 23.4 · Status: slice 1 of P2 (object backup, export, policy gate and Administration screens are not done)

## What changed
- Agent: `BackupTarget` with `FolderTarget` and `S3Target`; `TargetRegistry` (configured T2..T9, rejects a bad code, a duplicate, the same folder as T1, an unknown kind and any live eQMS bucket); `TargetTester` (write, read back byte for byte, and for an immutable target a delete that must be refused); `ReplicationService` (copies the finished, already encrypted and signed set, reads each file back and compares SHA-256, records one location row and one ledger event per target, raises an alert when a copy fails); `ObjectLockBucketProvisioner` (operator tool that creates a bucket with Object Lock, never run by the agent); `GET /internal/targets`, `POST /internal/targets/{code}/test`.
- A set is copied only after T1 passed V1 verification. A failed copy does not fail the backup: it is recorded as not confirmed, alerted (`BACKUP_COPY_FAILED`) and written to the ledger, because the 3-2-1-1 rule is then not met.
- Compose: opt-in service `backup-target-t3` (profile `backup-t3`, own volume, own credentials, reachable from the agent on `backup-net`), `docker-compose.backup-t3.yml` (agent target settings), `scripts/backup/provision-t3.sh`. New secret `BACKUP_T3_MINIO_PASSWORD` appended to the git-ignored `.env`; no existing credential was changed.

## Impact
No change to eQMS tables, the backend or the frontend. The agent constructor of `DatabaseBackupService` gained one dependency. With no extra target configured the behaviour is identical to P1.

## Evidence
- Agent unit tests: 56 pass (TargetsTest 9, DatabaseBackupServiceTest 25 including copy-success and copy-failure, LedgerServiceTest 10, SchedulerQueueAndTokenTest 12).
- Real run, DEV: backup `BK-20261008-1009-0012` COMPLETED and VERIFIED, located on T1 and on `s3://eqms-dev-backup-t3/...` with read-back match; ledger verify ok (65 events, file copy compared).
- Real target test: T1 write/read-back/cleanup ok; T3 write/read-back ok and **delete refused** by Object Lock.

## Defects found and fixed during this slice
- D-1 Spring could not choose between the two `TargetRegistry` constructors, so the agent crashed at start while every unit test passed. Fixed with `@Autowired`. Residual gap: there is no test that starts the Spring context; add one before P3.
- D-2 A plain S3 delete on a versioned bucket only adds a delete marker, so the first design of the immutability check would have reported a locked bucket as deletable (or an unlocked one as locked). The check now deletes the stored version itself.

## Deviations and limits
- T3 here is a second MinIO container on the same PC, retention GOVERNANCE for 1 day, to test the mechanism. It is not an independent location. A real T3 needs another machine or provider with COMPLIANCE retention (SDS 8).
- Each target test leaves a small `_probe/` object on an immutable target until its retention ends; it contains random bytes only.
- Not yet done after slice 1 (object backup is slice 2, below): T2 NAS, Export Backup Set and Offline Media Register, policy versioning with the 3-2-1-1 gate and e-signature, and the Policy / Storage / Retention Administration screens.

## Rollback
Stop using `docker-compose.backup-t3.yml` and recreate the agent; the agent then has only T1. Remove the volume `eqms_eqms_backup_t3_data` to discard the test copies. Nothing in the eQMS database was touched.

---

# Slice 2: backup of the document store (WP2.1)

## What changed
- Agent: control-DB migration `V2__object_blob.sql` (`backup_object_blob`, append-only); `ObjectSource` / `MinioObjectSource` (list versions, read a version; read only); `ObjectBackupService` (copies only versions not stored before, encrypts each into a shared pool `<T1>/<ENV>/objects/<bucket>/<hh>/<hash>.gpg`, writes an encrypted full-view index `objects/index.json.gpg` into the backup set, reports a stored version that vanished from the source, retries a read 3 times, fails the whole backup on an unreadable document); `CommandRunner.encryptStream`; manifest component `OBJECT_STORE` with `objectListedAt`; V1 check `OBJECTS_PRESENT`; `ReplicationService` now also brings each extra target up to date with every stored document (a target added late catches up).
- Compose: agent reads MinIO through `AGENT_OBJECTS_*` (DEV uses the MinIO root account).

## Evidence
- Agent tests: 70 pass (ObjectBackupTest 14 new: incremental copy, delete marker, vanished version alert, retry, permanent read failure, listing failure, encryption failure, size mismatch, missing bucket config, altered or removed blob caught by V1, old backup fails when a document it needs is gone, late target catches up, altered blob never sent on).
- Real run, DEV: `BK-20261008-1021-0013` COMPLETED, VERIFIED; 1310 versions (eqms-gmp-revisions 1300, eqms-gmp-records 5, eqms-templates 5), 369 MB encrypted; on T1 and T3. Second backup `BK-20261008-1023-0014` took 18 s and copied no document again. Ledger verify ok (74 events). Six random stored documents decrypted with the DEV private key and matched their recorded SHA-256.

## Defects found and fixed
- D-3 The first draft passed a hand-built string through a script and produced broken Java; found by the compiler, no behaviour impact.

## Deviations and limits
See SDS 23.9 (single source for what is not done). The ones that matter here: DEV reads MinIO with the root account; copying is sequential; the "known" set is loaded into memory; V1 hashes only what a backup added; nothing yet reads the index to restore (P3), so these backups are not yet proven restorable.

## Rollback
Set `AGENT_OBJECTS_ENABLED=false` and recreate the agent; backups return to database only. The pool under `backups/dev/t1/DEV/objects` and the table `backup_object_blob` are evidence and stay.

---

# Slice 3: backup policy by version, 3-2-1-1 gate, two people, e-signature (WP2.3 and the Backup Policy screen of WP2.5)

## What changed
- Agent: control migration `V3__policy_lifecycle.sql` (DISCARDED status, hash, activation time, gate record, one open draft); `PolicyService` (propose, discard, activate, 3-2-1-1 gate, paged list), `TargetCatalog`, `/internal/policies`. A backup now reads the active policy: documents only when the policy has `OBJECT_STORE`, copies only to the targets the policy lists, and a listed target the agent does not have is a recorded failure plus an alert. With no active policy only the database is written, to T1. The manifest records `policyVersion`.
- Gate: at least 3 copies (live system + 2 targets), 2 kinds of medium, 1 off-site (declared by a person), 1 immutable (declared, and the agent must have it configured as immutable), and every target in the policy passes its test at activation. In DEV only the off-site condition is relaxed and the activation record says so; TEST and PROD enforce all.
- Backend: `V562` (permissions `backup.admin.policy.propose` / `.approve` with dependencies on `.view`, granted to SYSTEM_ADMINISTRATION; signature meaning `BACKUP_POLICY_CHANGE`), `BackupAgentClient.exchange`, `BackupPolicyService` (verify the signature token, record the signature, hand its id to the agent, roll the signature back if the agent refuses, audit the refusal outside that transaction), `BackupPolicyController` (`/backup-restore/policies`, `/targets`).
- Frontend: Backup Policy is now a real list (server-side search, status filter, sort, paging, Custom Column) with the running policy above it; `Policy Version` and `Propose Policy Change` screens; routes, breadcrumb parent, permissions. The earlier sample-data Backup Policy screen and its sample data were deleted.

## Impact
Backups now depend on the active policy. The starting policy (v1) was database only to T1, so after this change documents and T3 are used only once a policy that lists them is active (done in DEV, see below). Existing eQMS tables untouched; one additive migration (V562).

## Evidence
- Agent 92 tests pass (PolicyServiceTest 18, ObjectBackupTest 18 including policy decides scope and targets, DatabaseBackupServiceTest 25, others 31). Backend BackupPolicyControllerTest 13 pass. Frontend backup-restore, administration, layout and app suites 133 pass; tsc reports only the two pre-existing errors in `ReportLists.test.tsx`.
- Real stack, DEV: a draft with T1 only was refused with the reasons (copies, medium, immutable; off-site relaxed); proposer activating their own draft refused; discard works; a draft with T1 + T3 (immutable) activated; the next backup `BK-20261008-1031-0015` used policy v3, wrote DATABASE and OBJECT_STORE and copied to T1 and T3; ledger verify ok.
- Backend after rebuild: V562 applied, permissions and signature meaning present, unauthenticated call refused (403).

## Defects found and fixed
- D-4 The first V562 inserted a `description` column that `electronic_signature_meanings` does not have; Flyway rolled it back and the backend did not start (found at deployment, nothing was applied). Fixed in the unapplied file; lesson: check the live table shape, not an old migration, before seeding.

## Deviations and limits
See SDS 23.9. Most important: the e-signature path was exercised by unit tests only, not by a real user in the browser (no credentials were created or used); the DEV policy v3 was activated through the agent API with placeholder names and `DEV-AGENT-API-NO-ESIGN`, so it is not a signed change and should be redone by two real users through the screens.

## Rollback
Activate (or re-propose) a policy that restores the previous scope and targets; versions are never deleted. Code rollback: redeploy the previous agent, backend and frontend images; V562 only adds rows and can stay.

---

# Slice 4: Export Backup Set, Offline Media Register, Storage & Encryption and Retention screens, T2 (rest of WP2.2, WP2.4, WP2.5)

## What changed
- Agent: control migration `V4__export_and_media.sql` (`offline_media`, append-only `media_event`, `backup_export` with a database check that approver and requester differ, one open export per medium, job type EXPORT); `MediaService` (register, handover, receive by a different person, read test, recycle after a confirmed wipe, retire with a destruction record; legal-hold flag blocks recycle and retire); `ExportService` (request needs a completed backup whose latest check passed, an available medium and enough capacity; approval by another person queues the job; the job writes `EXPORT-<backup>-<date>` with the database, the document index, every stored document version the backup depends on, tools, README, public key, `PACKAGE-SHA256SUMS` and a signed receipt written last; it reads every file back and re-verifies the manifest signature; a failure leaves a `.invalid` folder, an alert and a medium that must be wiped); `/internal/media`, `/internal/exports`, `/internal/encryption`; extra targets now configured by code (`AGENT_TARGETS_EXTRA_T2_*`, `_T3_*`) so each can be enabled alone; `docker-compose.backup-t2.yml`.
- Backend: `V563` (`backup.backup.export`, `backup.backup.export.approve`, `backup.media.manage`), `V564` (`backup.admin.storage.test`), `BackupExportController`, target test and encryption endpoints, audit of every step (approval refusals included).
- Frontend: Backup Storage & Encryption, Offline Medium detail, Export Backup Set modal on Backup Details, Backup Retention (read-only, permanent, legal hold stated as not built). The sample-data versions and their sample data were deleted.

## Impact
Adds tables to the control database and rows to the eQMS `permissions` tables (additive). Extra-target configuration changed from list index to code; the T3 compose override was updated, nothing else used the old form.

## Evidence
- Agent 114 tests pass (ExportAndMediaTest 22, including the packaged `verify-chain.sh` run with real openssl, tamper cases, same-person refusals, invalid package on a changed stored document, media lifecycle). Backend: BackupExportControllerTest 11, BackupPolicyControllerTest 16, BackupRestoreControllerTest 14 pass. Frontend 156 tests pass across the backup, administration, layout and app suites; tsc clean except two old errors in `ReportLists.test.tsx`.
- Real stack, DEV: `scripts/backup/p2-export-e2e.sh` 16/16 (439 MB package; `verify-chain.sh` passes; database decrypts to a PostgreSQL dump with the DEV private key; a stored document decrypts to its recorded SHA-256; a changed file and a changed receipt are reported; self-approval and self-confirmation refused; ledger verifies). A backup under policy v4 (`BK-20261008-1525-0016`) was copied to T1, T2 and T3. T2 test: write, read back, cleanup passed. V563 and V564 applied; backend and agent healthy.

## Defects found and fixed
- D-5 `CommandRunner` fake and the first export test run exposed nothing, but the end-to-end script failed once because `set -o pipefail` treated `gpg | head` as a failure; the script was fixed, not the product.
- D-6 The Export modal preselected the first medium even when the package did not fit, leaving the request button disabled; found by a frontend test, fixed.
- D-7 Two overlapping `docker compose up` runs left the agent without its T2/T3 settings (targets showed only T1); found by checking `/internal/targets`, fixed by one clean deploy. Lesson: never start two deploys at once.

## Deviations and limits
See SDS 23.9, which is the single list. Summary: T2 and T3 are simulated on this PC; DEV allows the export folder on the same disk as T1; Register Imported Set, legal hold, key holders, alerts, write-direct-to-medium and a clean-machine restore of an exported package are not done; the browser flow with two real accounts has not been run by me.

## Rollback
Stop using `docker-compose.backup-t2.yml` and recreate the agent. Policy v4 can be superseded by proposing and approving a version without T2. The V4 tables and packages are evidence and stay; packages on `backups/dev/export` can be deleted by hand in DEV (their records will then show a missing path).
