# Report Template — API contract and owner UAT

Decision: `REPORT-TEMPLATE-2026-10-03`. This is implementation guidance, not certification.

## Administrator

Open **Application Settings → Report Configuration**. Configure the existing Document Status
template or choose **New Template**. Only the registered Document Register provider is available.

1. General: stable code, display name, description, active state, allowed PDF/XLSX/CSV formats.
2. Fields & Defaults: permitted, default and mandatory columns. Document Number and Document
   Name remain mandatory. These settings restrict preview, filtering, sorting and generation.
3. Access & Scope: assign each active Access Profile a metadata scope or leave **No access**.
   No assignment is seeded automatically, including for administrators. Multiple assigned roles
   combine their scopes. Department/Business Unit match the account's configured organization.
4. Enter a change reason and **Save Changes**. All fields and grants save together, with version
   history and mandatory audit. Unsaved changes have no system effect. A concurrent edit returns
   409; reopen the current template before saving. Previous report files/history are not rewritten.

Existing report retention-policy associations are preserved and displayed read-only here.
No new purge period is selected by the implementation. No association means permanent retention.

Configuration permissions: `reports.definition.view` / `reports.definition.manage`, or the existing
`settings.configuration.view` / `settings.configuration.manage` alternatives. Users need separately
assigned run/download/history permissions; a metadata scope alone grants no action permission.

## Report user

Open **Reports & Analytics → Report Templates**, choose an assigned template, then **Create Report**.
Set criteria and columns → **Preview Report** → **Continue to Output** → **Generate Report**.
History polls pending jobs; download becomes available after completion. Preview is indicative:
generation reads a new repeatable-read server snapshot, pinned to the accepted template version.

Permissions: `reports.catalog.view`, `reports.run.create`, `reports.run.view_own` (or view_all),
`reports.artifact.download`; existing `report.module.view` / `report.module.export` aliases remain.
Document/PDF access is separate and unchanged. Scope is rechecked for lookup, preview, generation,
publication and download; every download verifies SHA-256. A revoked/disabled scope denies the
whole artifact, not a locally filtered subset of a historic file.

## API (all authenticated; paths relative to /api)

| Method/path | Purpose |
| --- | --- |
| GET /reports/templates | Assigned active catalog; search/page/sortBy/direction; page size 10 |
| GET /reports/templates/configuration | Administrative catalog; same server-owned pagination |
| GET /reports/templates/sources | Registered provider and allowlisted fields (manage permission) |
| GET /reports/templates/roles | Active Access Profiles (manage permission) |
| GET /reports/templates/{code}/configuration | Administrative template, version, fields and grants |
| POST /reports/templates/{code} | Create complete configuration, mandatory reason |
| PUT /reports/templates/{code} | Atomic update, mandatory current version/reason |
| GET /reports/templates/{code}/options/{field}?search= | Scope-limited lookup, max 100; refine on server |
| POST /reports/templates/{code}/preview?page= | Criteria body; 10 rows/page + exact server count |
| POST /reports/runs | Queue accepted criteria; Idempotency-Key prevents duplicate requests |
| GET /reports/runs | Existing server-owned history/search/sort/pagination |
| POST /reports/runs/{id}/retry | Ownership-scoped retry; status/event/audit atomic |
| POST /reports/runs/{id}/artifacts/{artifact}/download | Ownership, current scope, expiry + checksum |
| GET /settings/report-configuration/definitions/{code}/history | Version, actor, reason and timestamp history |

Criteria: `version`, `fields`, `filters`, `sortBy`, `direction`. Filter keys and sort columns are
provider allowlists, never SQL. Dates are ISO `YYYY-MM-DD`, inclusive server date ranges.
The Created-date filter uses the database session timezone. Export limits: 10,000 records,
50 MiB; paired date ranges at most 366 days. Exceeding limits rejects output, never truncates.

Create/update body: `version` (update), `sourceCode`, `displayName`, `description`, `active`,
`formats`, `fields[{code,allowed,defaultSelected,required}]`, `roleScopes[{roleId,scope}]`, `reason`.
Scopes: PERSONAL, DEPARTMENT, BUSINESS_UNIT, SYSTEM. Provider is immutable after creation.
Legacy partial configuration PATCH endpoints reject registered templates; use the versioned PUT.

Status: 400 invalid criteria/configuration; 403 permission/scope denied; 404 absent template;
409 version/idempotency conflict; 202 run queued. No arbitrary module data/query endpoints exist.

## Owner UAT (pending real-account browser access)

- Check catalog/editor/criteria/preview/output at desktop and 375px with representative long names.
- Save each of the four scopes using an approved role assignment; check two distinct departments.
- Confirm an unassigned active role sees no template, and report access cannot open a source PDF.
- Edit the same version in two tabs: one Save succeeds, the other is rejected without lost edits.
- Generate each output and compare row count/values to the preview's criteria (allow concurrent
  source changes between preview and generation). Verify full Vietnamese text and multiple pages.
- Revoke the role/scope/permission before preview, while queued, and before downloading a finished
  artifact. Confirm denial, no silent fallback to system-wide visibility.
- Interrupt object storage; verify sanitized retry status and publication journal evidence.
- Confirm existing Controlled Copy, DOCX editing, signing and document workflow remain unchanged.

## Extension and operations

Future module providers implement `ReportMetadataProvider`: identity, allowlisted columns/labels,
filters/lookups, scoped SQL and bound parameters. Register explicitly; never infer authorization
from Document Control. Unregistered legacy demo definitions remain unavailable in the new catalog.
Scheduled Reports remain on the existing UI/workflow; this change does not constitute its full UAT.

Artifacts are published transactionally with worker-attempt fencing. Objects written before a
failed publication remain in `report_artifact_publication_journal` as PENDING for operator review.
This change deliberately does not automatically delete/reconcile them or change WORM/legal hold.
