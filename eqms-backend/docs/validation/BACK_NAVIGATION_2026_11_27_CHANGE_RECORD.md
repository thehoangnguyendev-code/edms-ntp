# Back navigation and retained view state — 27/11/2026

Status: source review and automated verification complete. UI navigation work; no backend implementation changes. Browser-by-browser manual acceptance remains outside this evidence.

## Owner authorization and invariant

The owner requested a system-wide review/fix so Back from details restores the
originating tab, filters, page and sort. The owner explicitly approved shared
HIGH/CRITICAL changes on 27/11/2026, keeping business rules and regression checks.

Permissions/object scope, lifecycle transitions, parent/child effects, signatures,
mandatory audits, storage/checksums and async jobs remain unchanged. Data is still
fetched through the same APIs and server authorization. No result rows, credentials,
signature tokens or form drafts are put in the navigation journal or saved UI state.
Existing leave-with-unsaved-changes guards and explicit draft-return branches remain.
Authentication Back links, wizard steps and the Knowledge Explorer's folder history
are separate navigation mechanisms and remain unchanged.

## Source-confirmed findings and implementation

- Back helpers sometimes navigated to a bare fixed list path. The shared helper
  now resolves remembered list addresses, including query/hash, and remembers the
  actual origin when no explicit return path was supplied. Explicit workspace and
  return paths keep their priority. Nested C → B → A returns carry B's parent so
  Back cannot bounce between detail pages.
- The authenticated layout records addresses on PUSH/POP/REPLACE. Query replacements
  and save-time route replacements retain the original parent. The journal stores
  at most 100 addresses per user/browser tab; view states are separately scoped by
  user, pathname, owning component and, for reused tables, entity/group/relation.
- UI state previously held only in useState is retained with useViewState. Existing
  URL-owned parameters and persisted server-table hooks are preserved. Distinct
  notification tabs and participant groups have distinct keys.
- Pagination reset effects now run on an actual filter change, not simply on a
  remount. Manual debounced search starts from the restored search, avoiding a
  delayed reset back to page 1. Changing a filter still resets paging as before.
- Document/Revision/Controlled Copy primary tabs keep their URL current; known
  explicit tab links remain supported. Report template status menu presets keep
  their status query current without clearing the other remembered filters.
- Audit table paging is retained. Infinite audit timelines still begin by fetching
  page 1 because their loaded record arrays are deliberately not cached. This work
  does not claim to restore scroll offsets or retain previously loaded server rows.

## Impact evidence

GitNexus navigateBack: CRITICAL, 26 direct callers, 50 upstream symbols, six processes.
MainLayoutContent: HIGH, one direct caller/one process. AuditTrailTab is CRITICAL.
These shared changes are within the explicit owner approval above. Remaining
indexed view/Back-handler impacts are predominantly LOW; exact CLI outputs are
saved outside Git in `%TEMP%/eqms-*-impact*.txt`. A few unindexed internal helpers
were also reviewed directly in source; UNKNOWN is not represented as LOW.

## Verification

- Focused navigation/state tests: 11 passing finally (exact return query, actual
  origin, nested chain, workspace precedence, user isolation, no draft/token storage,
  persisted page/search under StrictMode, filter changes resetting page).
- Training Reviews regression: 14 tests passed in the preceding focused fix.
- Full frontend run: 2,455 assertions, 2,393 passing and 62 failing initially.
  New persisted UI state exposed test-to-test session leakage; test setup now clears
  only the new navigation/view keys before each independent case. Persistence within
  a single unmount/Back journey is still tested. Standalone tables without router
  context retain their local-state behavior.
- Complete-file regression rerun after isolation correction: 212 assertions,
  209 passing and three remaining failures. Recall upload tests now allow 3 seconds
  for the existing 900 ms completion animation (production timing is unchanged).
  The notification-placeholder test keeps all six debounced searches/assertions
  with a 10-second test timeout; it passed alone in 3.28 seconds but exceeded the
  previous 5-second limit under concurrent load.
- Other chats changed Document/Revision, assessment, translations and review-dialog
  source during verification. The owner confirmed those chats had finished. Latest
  affected Training tests passed 64/64. Latest Document tests were rerun, and the
  revision-preview fixture now mocks the comparison/effective-source APIs introduced
  by that separate change. No comparison or preview product logic was altered here.
- Final Recall/revision-preview classes passed 37/37; notification plus common
  navigation/state classes passed 56/56. A final preview/comparison rerun passed
  10/10, including seven newly added comparison assertions from the other chat.
- Consolidated evidence: 419 test files and 2,462 assertions passed, none failed or
  skipped. This combines the full run with the latest complete-file reruns, replacing
  earlier results for the same file; it is not a claim of one final full-suite green
  invocation. Summary: `%TEMP%/eqms-back-navigation-consolidated.json`.
- Final incremental TypeScript check and production Vite build both exited 0.
  Vite retains its existing non-failing large-chunk warning.
- `git diff --check` passed. Final GitNexus unstaged analysis reports 396 files,
  1,089 symbols, 74 affected processes and CRITICAL aggregate risk. This is the
  shared working tree, including unrelated backend/frontend work from other chats,
  not solely this navigation change; it has not been staged or committed.
- Evidence files: `%TEMP%/eqms-back-navigation-*.log`, Vitest JSON and source hashes.

The referenced `08_ONE_CHANGE_RECORD_TEMPLATE.md` and
`system/00_EVIDENCE_CONVENTIONS.md` are absent from this checkout at final review.
This record preserves owner authorization, invariant, source findings, impact,
test evidence and limitations without inventing missing governance requirements.

No deployment, commit or push is part of this request. This record is source/test
evidence, not a statement of GMP compliance or QA release approval.
