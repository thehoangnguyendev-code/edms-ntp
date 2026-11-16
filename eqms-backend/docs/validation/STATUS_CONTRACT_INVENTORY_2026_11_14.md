# Status in the API: inventory (2026-11-14, read-only)

Proposal under review (owner asked for the list): a machine **code** as text (`statusCode`, e.g. `CLOSED_CANCELLED`) for every logic, and a **label** (`statusInfo.name` / `statusLabel`) for display only. No number codes (the database, history and audit already store the text codes).

## 1. What the API returns today (sampled on DEV)
| Endpoint | `status` holds | `statusCode` | `statusInfo {id,name}` | Other |
|---|---|---|---|---|
| Documents (list, detail) | label ("Closed - Cancelled") | **missing** | yes | |
| Revisions (list) | label | yes | yes | `state` = same label again |
| Revision detail | label | **missing** | yes | |
| Controlled copies | label | yes | yes | |
| Uncontrolled copies | label | yes | **missing** | |
| Training activities, Reports runs and schedules, Backups | the code (PLANNED, COMPLETED, SUSPENDED_...) | not needed | no | already machine values |
| Notifications | code in lower case ("unread") | no | no | |
| Users | enum value in title case ("Active") | no | no | |

## 2. DTOs of Document Control that lack one of the two fields (to add `statusCode`, keep the rest)
`DocumentDetailResponse`, `DocumentListItemResponse`, `DocumentRelationResponse`, `RevisionDetailResponse`, `RevisionUpgradeImpactItemResponse`, `RevisionUpgradeSessionResponse` (no `statusCode`); `UncontrolledCopyResponse` (no `statusInfo`). Complete already: `RevisionListItemResponse`, `DocumentRevisionSummaryResponse`, `OriginalDocumentResponse`, `ControlledCopyListItemResponse`. 59 DTOs carry a `status` or `state`; the ones outside Document Control are not part of this proposal.

## 3. Frontend: what still reads the label as if it were a value
- `revision.state` (the label) is displayed in `RevisionListView`, `PendingDocumentsView`, `RevisionsOwnedByMeView` and used for the colour through `getBadgeColor(statusCode, state)`: the code is already given first, the label is the fallback.
- `documentStatus: revision.state` is put into the navigation state in `RevisionListView`, `RevisionsOwnedByMeView`, `useRevisionRowActions`: a label travels as if it were a status; the receivers are not yet checked.
- `ExpandedDocumentRow`: `state: r.state || r.status`.
- `mapRevisionSummaryFromApi` turns `status` into a **badge key** ("readyForPublishing") and keeps the label in `statusLabel`: so `status` has three meanings in the frontend (label from the API, badge key after the mapping, sometimes a code). Comparisons with it must be checked one by one (done for Document Control on 2026-11-14: four were wrong and are fixed).
- `controlled-copies/status.ts` normalises any spelling to a label and compares labels.
- `training-activities` `.state` is another concept (attendance codes) and is correct.

## 4. Steps, none done yet (each changes the contract; owner to approve)
1. Add `statusCode` to the seven DTOs above (additive, nothing breaks); a contract test that every Document Control DTO has `statusCode`.
2. In the frontend, take the label only from `statusInfo.name` / `statusLabel`, the logic only from `statusCode`; rename the badge key of `mapRevisionSummaryFromApi` so it is no longer `status`.
3. Check the receivers of `documentStatus` in the navigation state; change `controlled-copies/status.ts` to codes.
4. When no frontend reads `state` or the label in `status`, remove `state` (it is the label twice) and stop using `status` as a label.

## 5. Step 1 done (2026-11-14)
`statusCode` added to `DocumentDetailResponse`, `DocumentListItemResponse`, `DocumentRelationResponse` (the code of the target, or of its Effective revision when that is what the label shows), `RevisionDetailResponse`, `RevisionUpgradeImpactItemResponse`; every site that builds them passes it (`DocumentService`, `RevisionService`, `RevisionUpgradeSessionService`). Additive: no field was removed or changed. Contract test `StatusCodeContractTest` (10 Document Control answers must have `status` and `statusCode`). Deployed on DEV and read back: document list, detail and its revisions, revision detail. Not changed: `RevisionUpgradeSessionResponse.status` (the status of an upgrade session, not a lifecycle status) and `UncontrolledCopyResponse` (has `statusCode`; no `statusInfo`, which would only repeat it).

## 6. Step 2 done (2026-11-14), Document Control frontend
- `mapRevisionSummaryFromApi` now returns the three things under three names (`statusCode` for logic, `statusLabel` for people, `statusBadge` for the colour) and **leaves `status` as the server sent it**; it used to overwrite `status` with the badge key. The local `Revision` types (document detail and new document) have `statusBadge` and `statusCode` instead of a `status` that held the badge key.
- Logic now on the code: "is there a Draft revision in progress" and "which revision is Ready for Publishing" (`DetailDocumentView`) use `statusCode`; the revision tabs refresh on `statusCode`. The label of a row of the revision lists comes from `statusInfo.name`.
- **Found and fixed on the way:** `DocumentsView` passed the badge key to the next screen, which read it back as a status: "pendingReview" became "PENDINGREVIEW", matched nothing and the badge fell back to Draft. It now passes the label with its code.
- Tests: `statusMapping.test.ts` (4); Document Control frontend 183 pass; `tsc` clean. Deployed on DEV: the Revisions tab of a Document shows Draft / Effective / Obsoleted badges correctly; All Revisions loads. Not checked on screen: the status column and row menu of the revision lists (the row menu is covered by the unit test of step "frontend scan").
- Still to do: step 3 (the receivers of `documentStatus` in the navigation state, `controlled-copies/status.ts`) and step 4 (remove `state`).

## 7. Step 3 done (2026-11-14)
- **`documentStatus` in the navigation state:** checked end to end. It is only a pre-fill of `sourceDocument.status` in `RevisionCreateView`; the two tabs that receive the source document (`GeneralInformationTab` of the workspace and of the revision detail) never read a status, and nothing else reads `documentStatus`. No decision depends on it; it stays a label for display. (The sibling `revisionState` is written by two tabs and read by nobody; it now carries the badge key instead of a lower-cased label.)
- **`controlled-copies/status.ts`:** the label normaliser is for display only; every colour and decision already takes `statusCode` first (`getStatusBadgeColor(label, code)`, `DocumentInformationTab`). The only function that compared labels, `isControlledCopyTerminalStatus`, was used nowhere and is deleted. Filters send codes (`READY_FOR_DISTRIBUTION`, `DISTRIBUTED`); the server also accepts the words, by a tolerant normaliser (`ControlledCopyService.normalizeControlledCopyStatusCode`), which is a leftover to remove when step 4 is done.
- Document Control frontend 183 tests pass, `tsc` clean.
- **Step 4 (remove `state`)**: not started.

## 8. Step 4 and the server leftover done (2026-11-14)
- **Scan of who reads `state` (revision list):** backend: only the CSV export (`item.state()`, now `item.status()`); the sort alias `"state"` (kept, see below). Frontend: three list views (badge and label, now `statusInfo.name ?? status`), `documentStatus` in the navigation state, `useRevisionRowActions`, `ExpandedDocumentRow` (`r.state || r.status`), the fallbacks of `statusMapping` and `revisionRowActions`, the `Revision` type of the list. Tests: three test files. Outside the repository's sources (scripts, load tests, other modules, reports): none. **`state` is removed** from `RevisionListItemResponse` and every reader moved to `status` / `statusCode` / `statusInfo`; `RevisionListItemResponse` now has `status`, `statusCode`, `statusInfo`.
- **Kept on purpose:** the sort parameter `sortBy=state` (it is the id of the column "Status" in the screens, saved in the users' column layouts) is still accepted and means the same as `status`.
- **Defect found and fixed on the way:** sorting the revision list by Status (`sortBy=status` or `state`) answered HTTP 500 ("for SELECT DISTINCT, ORDER BY expressions must appear in select list": it sorted by a column of the joined status table). It now sorts by the status of the revision (its `status_code`): alphabetical by code, not in lifecycle order. 200 on DEV.
- **Controlled Copy status filter, server side:** a client now asks for a status by its **code** only (`requireControlledCopyStatusCode`: READY_FOR_DISTRIBUTION, DISTRIBUTED, OBSOLETED, CLOSED_CANCELLED, any case). The words ("Ready for Distribution"), the old outcomes (RECALLED, LOST, DAMAGED, DESTROYED), blank and anything else are refused with HTTP 400 `CONTROLLED_COPY_STATUS_INVALID` (it was guessed before, and the filter also matched the label column). The check is made before the query is built (inside it Spring turned it into HTTP 500). Applies to the copies list and the batches list. The lenient normaliser stays, documented, for values the module itself holds (stored status, stage). A method that nobody called (`matchesBatchStatus`) is deleted. No link or bookmark in the sources carries a status word.
- **On DEV:** copies `status=DISTRIBUTED|distributed|Distributed` 399 (= database), the words and RECALLED and bogus: 400; batches `DISTRIBUTED` 1, `READY_FOR_DISTRIBUTION` 15 (= database), words 400; revisions list has no `state`; Controlled Copies (all, ready, distributed, `?status=DISTRIBUTED`) and All Revisions load with no console error. Tests: `ControlledCopyStatusFilterTest` (2), controlled copy tests (72) and `StatusCodeContractTest` pass; Document Control frontend 183 pass, `tsc` clean.
- **Known remaining (not done):** a bookmark that carries an old status word in the URL of the Controlled Copies screen now gets an error from the server instead of an empty filter.
