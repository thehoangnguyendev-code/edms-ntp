# Change record: Audit object registry and Object Numbering (2026-11-17)

Decision Log: `AUDIT-OBJECT-REGISTRY` (owner decisions of 2026-11-17). Status: **built on DEV, not committed.** Audit Trail, report and numbering changes below were verified by unit tests and by SQL on the DEV database; **nothing was seen on a signed-in screen** (no DEV account was available).

## What changed

1. **Object Type = default menu name** (`AuditObjectRegistry`, generated from the approved table `AUDIT_ACTION_TABLE_V2_2026_11_17.xlsx`). 86 menu names; a part of an object (batch, run file) has the menu of its parent. `AuditObjectCatalog.typeLabel` reads the registry. `AuditObjectRegistryTest` fails when the code writes an unregistered kind, when an Object Type is not a menu of `navigation.ts`, and when a kind of file (`FileObjectType`) has no module.
2. **Object Numbering** (System Administration): `object_number_formats`, `object_number_counters`, `backup_alert_numbers` (V798); `ObjectNumberService` (allocate, format, preview, update with reason and version check, audited as `OBJECT_NUMBER_FORMAT`); permissions `settings.object_numbering.view/manage` (given to nobody by the migration: ticked in a Permission Set like every security change); screen `Object Numbering`.
3. **New numbers** (column, unique index, API field, list column, sort, search, detail, audit Object Code): Scheduled Report Number, Audit Trail Campaign Number, Access Review Campaign Number, Object Access Rule Number (also for shares made in the Knowledge explorer), Announcement Number (also the maintenance announcement), Backup Alert Number (kept here, one row per alert id of the Backup Agent; the agent got an `ids` filter so a search by number finds the alert).
4. **Existing records are numbered** by `ObjectNumberBackfill` at start-up (oldest first, in the year each was made), one System entry per kind in the Audit Trail (D6).
5. **Writers corrected** so the Object Code is a real code: Report Run (RUN-number, not the template code), Training Assessment and Form Template (number + revision), Job Assignments / Training Reviews / Specimen Signatures / Record Exports (employee code), Record Export Batch (department), Legacy Evidence (paper Training Number / document and revision), Restore (Restore Number taken from the run code), Published PDF / review snapshot / source (named by their revision), Table Exports (recorded against the screen's own kind, named by the file), Report Type (display name), Backup Alert Rule and Training counter (readable names).
6. **`SETTINGS` catch-all split** into one kind per menu (Business Units, Departments, Positions, Storage Locations, Retention Policies, Degree Levels, Schools in Application Settings; Document Components, Name Formats, Types, Sub-Types in System Administration). Records written before the split are told apart on reading by the words of their action code (an audit record is never rewritten).

## Invariants and failure behaviour

- A number is given once, from a counter that only rises (upsert on `(kind, period)`, locked by the row), in the transaction of the record; a rolled-back record leaves a gap, never a repeat. A number never changes (`updatable = false`, unique index). A change of format applies to later records only.
- Changing a format needs `settings.object_numbering.manage`, the version that was read (409 otherwise) and a reason; the old and new example are in the audit entry.
- The numbering is optional in code only where a unit test builds a service without it; the application always injects it.

## Evidence

- Backend tests of the changed and affected classes: see the run recorded in the session (Audit*, Report*, Training*, AccessReview*, ObjectAccessRule*, SystemAnnouncement*, Backup*, Knowledge*, Dictionary/DocumentType/Education, TableExcel*, ObjectNumber*): all pass except `TrainingAdministrationPermissionTest`, which cannot start the application here (notification outbox key not configured), a cause outside this change; **not re-checked on a clean tree**.
- Front end: `tsc` clean; vitest of audit-trail, report, security-authorization, announcements, backup administration and the new screen pass.
- Concurrency: 40 simultaneous callers of the allocation SQL on the DEV database gave exactly 1 to 40, no repeat and no gap; the counter ended at 40 (scratch rows removed).
- Start-up numbering on DEV: 4 scheduled reports (SRP-2026-00001..4), 1 audit trail campaign (ATC-2026-0001), 2 access review campaigns (ARC-2026-0001..2), 3 object access rules (OAR-00001..3), 14 announcements (ANN-2026-0001..14); one System entry per kind in the Audit Trail.
- Object Type: the Java rule and its SQL form (reports) agree on all 539 (entity type, action) pairs of the DEV audit log.
- Unique names (tick C1): every configuration kind already had a unique name in the database except permission sets (V799 adds it; no duplicate existed).

## Not done / open

- The Restore **request** entry still names the backup number: the Restore Number is made later by the Backup Agent's job. Finalize and rollback entries use the Restore Number.
- Old `TABLE_EXPORT` rows (9) stay in module "Other"; the Object Type of old exports is not recovered.
- Names of `TRAINING_EXAM_ATTEMPT`, `TRAINING_ROLL_CALL`, `TRAINING_TRANSCRIPTION`, `TRAINING_WORK_SUSPENSION` (menu "Training Activities") and `TRAINING_IMPACT_ASSESSMENT` ("Document Impact Assessment") are proposed from the sidebar; their writers did not run on DEV.
- The 98 audit calls whose entity type is computed at run time were not read by the registry test.
- The audit report has a new column Object Type (by menu) and its Record column is now called Object Code; saved templates keep working (the code of the column did not change). An e-signature for a change of numbering is not built (a reason is required).
- No screen was checked with a signed-in user; `detect_changes` was not run (GitNexus not available); nothing committed.
