# CHG-UC-ELIGIBILITY-20260930 — Eligibility Rules table and unlocked administration

## Decision and scope

Requesting user decision D-UC-ELIGIBILITY-20260930: all Eligibility Rules, including the
seeded System Default, can be edited, enabled/disabled, allowed/blocked, and deleted by
authorized administrators. Move quick toggles from table cells to Action; show badges,
add No., and sort the data columns. This decision is recorded from the explicit request
in this task, not inferred from an implementation or a GMP standard.

The referenced governance/system/validation template files are absent in this checkout.
This record follows the existing change-record structure and does not claim regulatory approval.

## Invariants

- Controller authorization remains mandatory: policy manage or configuration manage.
  UI eligibility matches those existing permission codes; role labels are not a bypass.
- Removing the System Default row lock does not relax active-scope uniqueness. Application
  duplicate checks and the database partial unique index remain in force.
- If no active rule matches, eligibility remains denied. Document overrides, document/revision
  validity, issuance transitions, e-signatures, generated/stored files, checksums and async
  workflows are unchanged.
- Updates and deletes retain transactional audit logging. Updating a seeded Any row to a
  specific type clears its seed marker and records the marker change in the same audit entry.
- Sorting is performed by the server before pagination with an allowlisted column, asc/desc
  validation, and an ID tiebreaker. No client-only sorting of individual pages.
- No database migration, data deletion, Docker deployment, or commit was performed by this task.

## Source changes

- `eqms/src/features/settings/document-administration/uncontrolled-copy-policy/UncontrolledCopyPolicyView.tsx`:
  shared DataTable, page-relative No., status badges, sortable Document Type/Allowed/Status/Updated,
  uniform Action entries, and matching configuration-manager UI access.
- `eqms/src/services/api/uncontrolledCopyPolicy.ts`: typed sort parameters.
- `UncontrolledCopyPolicyController.listEligibilityRulesPaged`: forwards default/explicit sorting.
- `UncontrolledCopyService.listEligibilityRulesPaged/updateEligibilityRule/deleteEligibilityRule`:
  server sort and uniform rule management, without system-row protection.
- Entity/request comments updated to describe current behavior.

## Evidence

- Test-confirmed: frontend Vitest 15 files / 100 tests passed; TypeScript check passed;
  Vite production build passed.
- Test-confirmed: backend targeted suites 18 tests passed across
  `UncontrolledCopyEligibilityRulesTest`, `UncontrolledCopyPolicyControllerTest`, and
  `UncontrolledCopyServiceTest`. Covers default edit/deactivation/delete + audit,
  duplicate activation rejection, no-match denial, sort/filter/pagination, invalid sorts,
  and controller denial before invoking mutation services.
- Frontend tests cover badges/no table switches, sorting API request, all default-row
  actions enabled, allow/deactivate/edit/delete, and hidden mutations for read-only users.
- GitNexus upstream reports LOW for modified functions: view 0 direct callers;
  service methods 1 controller caller each; API adapter/controller paging 0 callers.
  View helpers loadRules/openEditRuleModal/handleSystemRuleToggle affect the policy view
  (1–4 direct callers). Whole-worktree detect-changes also includes unrelated existing edits
  and earlier migrations, so its CRITICAL summary is not a scoped assessment of this task.

## Remaining verification

Browser visual/responsive QA, deployed API authorization, database integration/race testing,
and Docker runtime QA have not been executed. Automated unit tests are not a claim of GMP compliance.

## UI correction — status changes only in New/Edit modal

The requesting user clarified that Allow/Block and Activate/Deactivate already exist in
the New/Edit modal and must not be duplicated in Action. This supersedes the quick-action
UI described above; the unlocked backend rule management decision is unchanged.

- Action now contains only Edit and Delete for every authorized row.
- Removed the unused quick-toggle handler, busy state and icons. Modal save remains the
  existing audited update endpoint; badges, numbering, server sorting and authorization
  are unchanged. No backend or database changes in this correction.
- Four focused frontend tests passed, including absence of quick-action buttons and changing
  both Allowed/Active through the Edit modal with the expected API payload. TypeScript passed.
- GitNexus impact: view LOW (0 direct callers), removed quick-toggle handler LOW (1 direct
  caller / policy-view process). Whole-worktree detect-changes remains mixed with prior edits.

## Follow-up decision — combined tab and signed Save Changes boundary

The requesting user explicitly removed the Eligibility Rules tab and moved its contents
into Eligibility & Validity. Every add/edit/delete is a local draft until Save Changes.
This supersedes the previous immediate rule mutation UI. PDF Markings remains the second tab.

### Implementation and invariants

- Modal confirmation is now Apply to draft; deletion confirmation stages a removal only.
  The page no longer calls rule POST/PUT/DELETE endpoints. Drafts survive tab changes,
  filters/sorting/pagination, cancelled signatures and failed saves.
- This small configuration matrix is loaded in full once and searched/sorted/paginated
  in memory to include unsaved rows. Existing server paging API remains available, but
  is not used for the draft table. Pending changes include a stored timestamp per edited
  or deleted row; new rows omit a persisted ID.
- The policy PUT accepts `eligibilityRuleChanges`. Policy permission + existing signature
  validation occur before rule processing. `UncontrolledCopyRuleDraftService.apply` requires
  an existing transaction (MANDATORY), joined to `savePolicy`'s transaction.
- Server validates the complete prospective active scopes and all referenced types/timestamps
  before mutating managed rules. Stale/missing/duplicate-target edits return a conflict;
  duplicate active scopes are rejected. Database unique index and entity version remain active.
- Old active scopes are released/flushed before replacements, supporting swaps/deactivation
  plus creation in one save. Final flush exposes version/uniqueness errors before signing/audit.
  Any runtime failure propagates to the policy transaction rather than becoming best-effort.
- One existing policy e-signature and consolidated policy audit entry include rule IDs and
  old/new fields, with create/delete snapshots. Actor/object authorization, no-match denial,
  document overrides, stored files, lifecycle and async issuance are unchanged.
- Policy save reads a fresh entity instead of mutating the shared cached entity. A rejected
  draft cannot leak changed policy values through that cache. After successful save, UI
  reloads saved rules; if that reload fails, save stays disabled until Reload saved rules.
- No migration is required. Legacy rule CRUD endpoints remain authorized as before; this
  task changes the policy page workflow, not the API contract for external callers.

### Verification

- Frontend complete suite: 101 tests passed; TypeScript and production Vite build passed.
- Backend targeted suites: 29 tests passed. Added rule-draft tests cover final-scope
  rejection before mutation, stale 409, default replacement flush order and state audit.
  Policy-save tests cover permission/signature denial, no success audit/signature after
  batch failure, and one signed audit containing policy + rule changes.
- Source-confirmed transaction atomicity; tests use mock repositories and do not prove
  database rollback durability. Deployed database concurrency/rollback and browser visual QA
  remain unexecuted. No Docker rebuild, deployment or commit performed.
- GitNexus impact: policy save 1 controller caller/LOW, policy service class 4 dependants/LOW,
  view 0 callers/LOW, local helpers LOW. Whole-worktree detect-changes still includes unrelated
  prior changes and is not a scoped release assessment.

## Marking-card position reset UI

- Moved the shared Reset positions action from below the preview into separate Reset Position
  buttons inside the Watermark and Stamp cards. Each button is shown only for authorized
  managers when that marking has custom placement fields.
- Each reset removes only the selected kind's fields across page groups. It retains the other
  kind's position/scale/angle and removes empty page rules; base styling and enable flags stay
  unchanged. Resets remain local drafts until the existing signed Save Changes operation.
- GitNexus view impact LOW (0 direct callers). No shared MarkCard, backend or DB changes.
- Focused frontend tests verify card placement, per-kind isolation, empty-rule cleanup and
  no immediate save; TypeScript checked. No browser visual QA or Docker deployment performed.
