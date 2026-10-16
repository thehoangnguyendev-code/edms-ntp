# REPORT-PLATFORM-2026-10-15 — Report platform: Report Types, more sources, report builder (design for approval)

Status: **DESIGN — nothing built yet.** Written 2026-10-15 for owner and QA review. Source evidence for the present state: `docs/system/` and the code named below. This is not a GMP approval.

## 1. Owner direction (2026-10-15)

1. Rebuild the Reports module so that it can report on the other modules, in the way of a regulated-QMS reporting function (Veeva Vault was the reference; functionality and workflow only, not its screens).
2. Sources, in this order: **Document Control, Audit Trail, Backup & Restore**.
3. **Who may create a report template is decided by permissions in an Access Profile, not by being an administrator.** Any user whose profile allows it may create templates.
4. Already done and kept: one company appearance for all reports (REPORT-COMPANY-APPEARANCE-2026-10-15, Report Properties).

## 2. Present state (from the code)

| Part | Today |
|---|---|
| Sources | One: `DocumentReportMetadataProvider` (code `DOCUMENT_STATUS`), a Spring bean found through the `ReportMetadataProvider` interface; columns, filters, lookups and the SQL are written in code. |
| Template | Name, description, source, fields (allowed / default / required), allowed formats, role scopes, charts; revisions with signed approval; `gmpUse` flag. |
| Run | `report_runs` with an immutable snapshot (definition, fields, filters, sort, company appearance); artifacts PDF/XLSX/CSV; schedules; retention and legal hold. |
| Who creates | Permission `reports.definition.manage` (or `settings.configuration.manage`). |
| Data access | The template's role scopes (Personal / Department / Business Unit / System) are applied by the provider to its SQL. |

The provider interface already allows a second source to be added as a bean. What is missing is a registry the administration can see, a richer contract (types, groupable/sortable flags, source permission), and a run-time builder.

## 3. Design

### 3.1 Report Type (the "source")
- A **Report Type** = one provider bean: code, name, description, category (Documents / Audit / Backup), columns (code, label, data type, filterable, sortable, groupable), filters, required columns, the **permission needed to use it**, and `enabled`.
- Types are **developed in code** (each carries SQL and an authorization rule that must be reviewed and tested). Administration can **view and enable/disable** them; it cannot write SQL. A disabled type cannot start a template or a run; templates already built on it are suspended with the same rule as a disabled template.
- New screen: **Report Types** (list, detail with columns and filters, Enable/Disable with confirmation and Audit Trail), laid out like Report Name Formats.

### 3.2 Authorization (dynamic, no hard-coded accounts)
- **Create / edit templates**: the existing permission `reports.definition.manage` (and `settings.configuration.manage`), which an administrator ticks in any Access Profile. The code does not look for an account or an "admin" role, so authoring is already open to any person whose profile holds it. A separate create-only permission was proposed and is **not** built: it would need author tracking and a second path through every template action for no stated need (decision 2026-10-15, to confirm).
- **Use a Report Type**: the user must also hold the type's own permission — Documents: the existing metadata scopes; Audit Trail: `audit.view`; Backup & Restore: `backup.module.view`. A template author cannot add a source the author cannot read, and a report never shows more than the person running it may see.
- **Export formats**: Audit Trail CSV/XLSX/PDF additionally needs `audit.export`.
- **Approval** stays as today for templates marked GMP use (signed, approver independent of the author). See open question Q1 for non-GMP use.
- Every create, change, approve, run and export is written to the Audit Trail; a run's snapshot records who ran it and with what authority.

### 3.3 Sources
**Document Control** — keep `DOCUMENT_STATUS`; move it to the new contract; add Revisions (number, status, effective date, valid until, author, department), and Controlled/Uncontrolled Copies (number, purpose, status, recipient, expiry, recall date) as further types, each with its own scope rule. Scopes unchanged.

**Audit Trail** — `audit_logs` (entity type, entity id, action, from/to status, comment, actor, time) and `audit_log_changes` (field-level before/after). Scope: SYSTEM only (the Audit Trail screen itself is not scoped by department); needs `audit.view`. Columns exclude anything the Audit Trail screen does not show. Row limit and time range are mandatory filters (the table is large); a run over a range wider than a configured limit is refused with a message, not truncated. Reading is itself audited.

**Backup & Restore** — backup runs and their verification, restore requests / approvals / executions, storage and retention status. Permission `backup.module.view`; sensitive values (storage endpoints, credentials, object keys) are never columns. **Open (Q3)**: the backup control plane may keep its records outside the main database; the exact tables and how the backend reads them must be confirmed in Phase 3 before columns are fixed.

### 3.4 Building a report (UX, replaces the long template form)
Create Report Template stays a stepper like New Document, simplified to: **1 Report Type → 2 Columns, filters and default sort → 3 Name, description, charts → 4 Access & Scope**. Appearance is no longer in the template. When a report is run the person may narrow the **filters** and **sort** within what the template allows (as today) and, in a later step, choose among the columns the template allowed.
Not built: free SQL, user-written formulas, joins chosen by the user (a Report Type already carries the joins its author reviewed).

### 3.5 Data migration
Existing templates keep their number, revisions and runs. They are re-pointed to the Report Type `DOCUMENT_STATUS`; no data is changed.

## 4. Phases (each is one bounded change with its own record)

| Phase | Content | Evidence required |
|---|---|---|
| P0 | Company appearance in Report Properties (**done**, V592) | change record to write |
| P1 | Report Type registry + contract; Document source moved onto it; Report Types screen; permissions `reports.template.create`; create stepper simplified | unit tests of the registry; API tests: user without permission refused; disabled type refused; UI tests; browser check |
| P2 | Audit Trail source | negative tests: no `audit.view` → type invisible and API 403; export without `audit.export` refused; range limit; no secrets in columns; concurrency of two runs |
| P3 | Backup & Restore source | same family; plus a check that no credential or key can be selected |
| P4 | Run-time column choice; saved "my reports"; Document Revisions / Copies types | UAT script |

Every phase: GitNexus upstream impact before editing a symbol, `detect_changes` before commit, DEV only, nothing is committed unless the owner asks.

## 5. Decisions and open questions

- **Owner (2026-10-15)**: sources and order (§1.2); permission-based creation (§1.3). Closed.
- **Owner answers (2026-10-15)**: Q1 **yes**, a non-GMP template is also approved with a signature before it runs (no change from today). Q2 **yes**, a person with `reports.definition.manage` sees and edits templates of others. Q3 **not known**: to be found out in Phase 3. Q4 **yes**, the Audit Trail report has a mandatory date range and a limit on how wide it may be.
- **Assistant-proposed, to confirm (QA/owner)**: Report Types are code-defined and only enabled/disabled in administration; template author must hold the source permission; Audit Trail type is SYSTEM-scoped; Audit export needs `audit.export`; new permissions `reports.types.view` / `reports.types.manage` for the Report Types screen; no new authoring permission.
- **Q1** Must a template that is **not** GMP use (personal analysis) still go through signed approval before it can run? Today every template does. Choosing "no" makes personal reports quick but means a non-approved definition produces output; those outputs would be labelled "Not approved for GMP use".
- **Q2** May a user see and edit **other people's** templates they did not author, if their profile has `reports.definition.manage`? Proposed: yes for manage, no for create-only.
- **Q3** Where does Backup & Restore data live and which fields may be shown? (Phase 3 start.)
- **Q4** Is the Audit Trail report to be limited to the same date window as the Audit Trail screen's export (retention)?

## 6. Out of scope
Dashboards, scheduled delivery changes, retention changes, any change to the Audit Trail itself, any source other than the three above.
