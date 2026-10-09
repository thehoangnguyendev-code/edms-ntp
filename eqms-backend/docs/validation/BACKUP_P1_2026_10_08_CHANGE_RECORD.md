# Backup & Restore P1: control plane, Backup Agent, database backup — 2026-10-08

Decision: SDS-BR-001 v1.0 (artifact "SDS Backup & Restore"), phase P1; decisions BR-1 to BR-19 as accepted by the owner.
Environment: DEV only (this PC). No PROD or TEST stack exists; no GMP compliance claim is made.
Invariants: the eQMS database is read, never written, by a backup; a backup is never written unencrypted; the agent holds only the
public key; every record of a backup, a check and a ledger event is append-only; a check result is never replaced; the backend
never runs a backup or reads the target.

## Source scope

New module `eqms-backup-agent/` (Spring Boot 3.5.13, Java 21):
- `db/control/V1__control_schema.sql`: separate control database (`eqms_backup_control`) with append-only triggers on the ledger,
  manifests, verification results, component results and locations; one RUNNING backup per environment (partial unique index);
  first policy seeded (daily 02:00, permanent retention).
- `LedgerService`, `CanonicalJson`: hash-chained, append-only history, also written to a file outside the database; chain and file
  copy compared on verification.
- `DatabaseBackupService`: one exported snapshot, row counts and large-object count read from the same snapshot, `pg_dump -Fc`
  against that snapshot piped into `gpg --encrypt`, SHA-256 computed while writing, signed manifest (Ed25519), atomic rename of the
  set, failure closes the run, raises an alert and keeps the partial folder as `.failed`.
- `VerificationService` (V1): manifest unchanged, signature, file sizes and SHA-256, `SHA256SUMS`, chain to the previous backup,
  encrypted to the expected key (without decrypting), ledger records the same manifest.
- `BackupScheduler`, `BackupJobWorker`, `JobQueue`: daily schedule from the active policy, one catch-up after downtime, lease-based
  queue, stale RUNNING runs closed on start, ledger checked at start and daily.
- Internal API (`/internal/**`, shared-secret filter; refuses every call when no secret is configured).
- `Dockerfile`, compose services `backup-control` and `backup-agent` (read-only root, no internet on `backup-net`, secrets as files).

eQMS backend:
- `V561__add_backup_action_permissions.sql` (applied to the DEV database): `backup.backup.run`, `backup.backup.verify`, both
  requiring audit and `backup.module.view`; granted to SYSTEM_ADMINISTRATION.
- `BackupAgentClient`, `BackupRestoreController`: overview, list (server-side search/filter/sort/page), detail, create, verify, job,
  schedules; reason required, pre-change needs a change-control reference, backup id shape validated, requests audited, an
  unreachable agent is a 503 and never an empty result.

Frontend: `services/api/backupRestore.ts`; Backup Status Overview, Backup History, Backup Verification Results and Backup Schedules
read the agent; create-backup modal, detail drawer (storage location, verification history); the "Design preview" banner is removed
from those four screens only. Restore, drills and all Administration screens remain sample data.

Provisioning (DEV only): `scripts/backup/provision-dev-backup.sh` (random secrets appended to the git-ignored `.env`, read-only
database role `eqms_backup_ro`, DEV OpenPGP key whose private half stays in `backups/dev-keys/`, git-ignored).

## Automated evidence (2026-10-08, all passed)

- Agent: 39 tests (ledger 10, database backup and verification 17, scheduler/queue/token 12) against throw-away databases on the
  DEV PostgreSQL server; external tools replaced by a fake runner.
- Backend: BackupRestoreControllerTest 12, EnvironmentConfigurationValidatorTest 15, StorageLayoutTest 8.
- Frontend: 99 tests in backup-restore, backup administration, report-analytics, app and layout.
- `scripts/verify-environments.ps1`: PASS.

## Runtime evidence

`scripts/backup/p1-e2e.sh` against the running DEV stack: 24 of 24 checks passed. It takes a real backup with the real `pg_dump` and
`gpg` and shows:
- a backup of the DEV database (323 MB, 134 tables, 594,929 rows, 999 large objects) completes in about 10 s, 85 MB, encrypted, and
  verifies;
- decrypting with the private key (kept outside the agent) gives a PostgreSQL custom-format dump; the agent itself cannot decrypt;
- restoring that dump into a scratch database reproduces the row count of all 134 tables and the large-object count recorded in the
  manifest;
- one changed byte in the stored file, or an edited manifest, makes verification FAIL; putting it back makes it VERIFIED again; the
  earlier results are kept;
- a second backup records the manifest hash of the first; the ledger verifies (55 events at the time) and is compared with its file
  copy; UPDATE/DELETE on ledger and manifest are refused by the database; a deliberate bypass of the protection (owner role) changes
  event 2 and the verification names event 2; the change is undone and the chain verifies again.

Backend started with V561 applied (healthy), reaches the agent with the secret (200) and is refused without it (401); the API
without login returns 403.

## Defects found by running it for real (all fixed)

1. `pg_dump` stopped at the first large object (`permission denied for large object`): `pg_read_all_data` does not cover large
   objects (999 exist). Fixed with `lo_compat_privileges` on the read-only role only. The three scheduled backups that failed on
   2026-10-08 because of this remain in the history as FAILED, with alerts; they are evidence, not deleted.
2. The fake `gpg` output in the first tests hid that real `gpg` addresses a message to the encryption **subkey**, not the primary
   key, so a check that compared the primary key id would always fail. The keyring now reads the keys that can encrypt.
3. Recent `gpg` writes an AEAD packet; the check now accepts both packet types.
4. `gpg --list-packets` exits non-zero when it cannot decrypt (by design the agent has no private key); the exit code is ignored and
   the packets are read.
5. The end-to-end script itself had faults (path conversion in Git Bash, a shell function returned by `beforeEach` treated as a
   teardown by Vitest in a test); a ledger event it changed on purpose was repaired by hand once (DEV) and the script now undoes its
   change exactly and always.

## Deviations from SDS-BR-001 (to be written back into the SDS)

- The backend talks to the agent over an internal API instead of writing to the control database (smaller blast radius, no database
  credentials in the backend). SDS 3.2 and 17 said the backend writes `backup_job` directly.
- V1 does not decrypt (the agent has no private key). The SDS listed "giải mã thử" under V1; it belongs to V2/V3.
- Large objects are part of the database and are now counted in the manifest and compared after restore (missing from SDS 4 and C2).
- No `ctl_api` database role was needed in P1.

## Impact analysis

GitNexus was not available in this session; impact was checked by reading and searching the source.
- `BackupRestoreController`: no caller outside itself and its test; the `/status` endpoint is kept.
- `docker-compose.yml`, `docker-compose.gmp.yml`: new services, network, secret and volume added; existing services unchanged except
  the backend (new environment variables, second network).
- Frontend: `BackupRestorePage` gained an optional `preview` prop (default unchanged); `format.ts` helpers now accept null; types
  `BackupRecord` made nullable/optional where the server may omit a value. Sample-data screens unchanged.
- `PermissionEvaluationService` and `AuthTokenFilter` were **not** changed in P1 (Super Administrator is P3).

## Residual limits

- P1 backs up only the database. Objects, off-site/immutable targets, export, restore, maintenance mode, WAL, DR and the Super
  Administrator are later phases. Backups made now are **not** GMP records; do not rely on them for real data.
- The first target is a folder on the same machine; there is no second copy and no off-site copy.
- Alerts cannot be acknowledged yet (no acknowledge endpoint), so the three failed backups from defect 1 stay open on the Overview.
- No browser walk-through of the four screens was done in this session (no credentials were used); the screens are covered by
  component tests against a mocked API and the API by the end-to-end run, not by a click-through.
- The DEV key is unprotected (`%no-protection`) and lives on this PC; TEST and PROD keys must be provisioned by their custodians.
- Sizing and timings are DEV values only.

## Rollback

`docker compose stop backup-agent backup-control`; remove the two services and the backend's `APP_BACKUP_AGENT_*` variables from the
compose file; V561 only inserts permissions and can stay. Backups already written are plain files under `backups/dev/t1/`.
