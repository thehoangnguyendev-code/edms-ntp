# SECURITY-AUTHORIZATION-REVIEW 2026-11-18: change record (part 1)

**Decision.** `docs/../governance/DECISION_LOG.md`, entry SECURITY-AUTHORIZATION-REVIEW-2026-11-18 (D1 to D8, chosen by the owner from options).
**Scope of this record.** D1, D2 (SoD rules for new modules), D3 (Access Review facts) and the Access Review part of D5 (inactive flag). D4, D6, D7 and the User Management part of D5 are not in this record.
**Status.** Built on the working tree; no database has been migrated; not committed. Files `CLAUDE.md` names (`docs/system/*`, `08_ONE_CHANGE_RECORD_TEMPLATE.md`) are not in this checkout, so this record follows the shape of the other records in this folder.

## Invariants affected

| Item | Actor and permission | Rule | Audit and signature |
|---|---|---|---|
| D1, D2 | Seeding is a migration; switching a rule on or off stays with `security.sod.manage` | Static pairs of permissions. BLOCK stops giving a person both (`AccessProfileService.requireNoBlockingSodConflict`, `UserManagementService.requireNoBlockingSodCombination`); WARN only appears in the SoD scan. Unchanged code paths. | Switching a rule is already e-signed and audited (`SodConstraintService`). The seed itself is the change record and V802. |
| D3 | `security.access_review.manage` creates a campaign (unchanged) | The snapshot of each person gets six more fields at creation; they are never recomputed, so a campaign stays evidence of the moment it was made. | The campaign creation audit is unchanged; the facts are part of the stored snapshot. |
| D5 | `settings.configuration.manage` saves the threshold | A person without a sign-in for N days (from creation when never) is flagged; N = 0 switches the flag off; 90 when never set. Flag only: no code path suspends an account. | A save of the threshold is audited by the existing configuration change list (page Security). |

## What was built

* `V802__seed_sod_constraints_for_training_reports_backup_access.sql`: ten system constraints, added only if the pair is not there (either order). Seven BLOCK (paper transcribe/verify, assessment record/approve, matrix manage/approve, requirement prepare/approve, GMP report template manage/approve, backup policy propose/approve, backup export/export approve), three WARN (training assign/close, training content review/approve, access profile assign / access review manage).
  * **Deliberately absent:** backup restore request/approve/execute. The owner decided on 2026-11-09 (BACKUP-RESTORE-SIMPLIFIED-2026-11-09) that restore approval is on paper; a rule over it would govern a step the software does not have. The owner is asked to confirm.
* `V803__access_review_item_facts.sql` and `AccessReviewItem`, `AccessReviewDtos.ItemResponse`, `AccessReviewService.captureFacts`: last sign-in, days without sign-in, inactive flag, MFA state (ENROLLED, REQUIRED_NOT_ENROLLED, NOT_ENROLLED), end of the active time-limited account, number of active SoD rules the person breaks (empty for a super admin, who holds everything and is flagged as such).
* `SodConstraintService.countActiveViolations` (no write, no permission of its own: the caller has its own).
* `SystemConfigurationService.inactiveAccountDays` and the validation of `inactiveAccountDays` (whole number 0 to 3650); the field in Configuration > Security > Sessions & Accounts.
* Access Review screen: columns Last Sign-in, MFA, Time-limited Until, SoD Conflicts and the Inactive badge; an old campaign shows "Not captured", never a guess.

## Evidence

| Test | What it proves |
|---|---|
| `SodSeedV802MigrationTest` (4) | every permission of the ten rows exists in the catalogue; no pair twice or against itself; seven BLOCK and three WARN; idempotent and non-destructive; no restore pair |
| `AccessReviewFactsTest` (8) | recent vs stale, never signed in, threshold 0, inclusive threshold, the three MFA states, time-limited end, SoD count and super admin, no service built |
| `InactiveAccountThresholdTest` (2) | default 90, 0 kept, bad values fall back; save accepts 0 to 3650 only |
| `ReviewCampaignReviewerTest`, `SodConstraintServiceTest`, `SystemConfiguration*Test` | still pass |
| `AccessReviewCampaignDetailView.facts.test.tsx` (2); settings/configuration (141) and security-authorization suites | the columns and the "Not captured" case; Security tab and the rest pass |

**Not tested, and why.** The migrations were not run against any database (the Spring tests of this project migrate the shared DEV database); the SQL is checked as text. The effect of V802 on today's people is unknown until the SoD scan is read after applying it. No browser run of the Access Review screen.

## Open

1. Confirm the Backup restore pair stays out (see above).
2. Read the SoD scan after V802 on DEV; adjust or switch off rows that would block real work.
3. The Inactive flag in User Management, Reset MFA (D4), Access Explorer (D6): next. Delegation (D7) needs its row in `AUTHORIZATION_PARTICIPANT_SOD_CATALOG.md` approved first.

## Addendum 2026-11-18: Access Explorer screen redesign (list + details)

Screen only; no authorization rule, permission or audit behaviour changed. Owner's request: the same shape as the other administration screens. The list (`/settings/users/access-explorer`) is a table of every permission with how many permission sets, access profiles and people hold it; search, Module and Held By filters (all / held / nobody), sorting and paging are done by the server, with the same FilterDrawer on small screens. A row opens Access Explorer Details (`/settings/users/access-explorer/:code`): header with module, category and four counts, tabs General, People (server search and paging, "Only active accounts"), Granted Through (permission sets and their access profiles); a link to the Permission Holders report stays.

Backend: `GET /security/access-explorer/permissions` now returns a page (`search`, `module`, `held`, `sortBy`, `sortDir`, `page`, `size`; size capped at 100) with the counts from one native query that follows the same chain as the sign-in and the report; `GET /security/access-explorer/holders` takes `search`, `page`, `size` and returns `holderTotal` and `totalPages` (the totals of the permission do not shrink with the search); new `GET /security/access-explorer/modules`. All three stay behind the same `requireView` (`settings.user.view` or `security.access_profiles.view`). The earlier top-50 picker search was removed with its tests.

Tests: `AccessExplorerServiceTest` (8: search by every word, module filter, counts, sort, paging and the page-size cap, held/none, people search and paging, refusal without the view permission), `AccessExplorerView.test.tsx` (7). Checked on DEV at 1440, 1024 and 375 px with no page-level horizontal overflow; DEV shows 7 permissions held by nobody (for example `reports.definition.approve_gmp`), which the Held By filter now surfaces: whether each is intended is a QA decision, not changed here.
