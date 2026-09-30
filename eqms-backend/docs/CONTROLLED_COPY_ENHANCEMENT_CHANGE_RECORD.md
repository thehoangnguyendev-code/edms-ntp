# Controlled Copy enhancement -- change record (draft, pending QA confirmation)

Status: DRAFT. Nothing here is an approved GMP decision until QA confirms it in the Decision Log.
Source evidence below is from reading the code and querying the development database on 2026-09-26;
it is not runtime/validation evidence.

## 1. Requested change (business owner)

1. Only one Publishing Template may be Active at a time. A Controlled Copy must be composed with the
   exact template (and version) that was used when its Revision was published.
2. Placeholders reserved for Controlled Copy (recipient name/e-mail/job title/department, copy
   number, expiry date, distributor, distribution date, requester, purpose, location). An external
   recipient is shown by e-mail address. A per-placeholder scope (publish / controlled copy / both).
3. A system-applied overlay on every Controlled Copy: a red rectangular stamp and/or a watermark,
   both configurable by an administrator.
4. Recall / expiry: no recall data is printed on an issued paper copy. On-screen status overlay and a
   Recall Notice document instead.
5. A "Document" tab on the Controlled Copy detail showing the stored PDF of that copy.

Principles set by the requester: security and EU-GMP compliance first; all processing on the
server; the front end only triggers actions and displays results.

## 2. As-built findings (Phase 0)

| # | Finding | Consequence |
|---|---|---|
| 0.1a | `publishing_template_components` holds one row per (template, type, layout) that is overwritten in place; only a counter `version_number` changes. | Editing an Active template changes what the next composition uses. There is no per-version component set. |
| 0.1b | `publishing_template_versions` snapshots only the portrait cover/body/header/footer/logo paths (each carries the MinIO `versionId`). Landscape components are not captured. | A published version cannot be fully reconstructed today. Old objects are still retrievable by `versionId` while MinIO versioning/WORM retains them. |
| 0.1c | `revision_publishing_metadata.publishing_template_version` stores the template's working version number (112 rows are NULL, published without a template, e.g. Legacy Import). Version rows are numbered separately (`findNextVersionNumber`) and are created before the working number is incremented. | The mapping "revision -> exact snapshot" is not guaranteed unambiguous. |
| 0.1d | `ControlledCopyService.applyComposedControlledCopyPlaceholders` composes from `metadata.getPublishingTemplate()` (the live template row). | Controlled copies of already-published documents pick up later template edits. |
| 0.2 | `publishing_template_placeholder_styles` are versioned per template version but contain formatting only; there is no controlled-copy scope flag. | A scope flag has to be added. |
| 0.3 | `PublishingPdfComposerService` does not apply the template's `watermark_mode`. | Watermark must be built, not enabled. |
| 0.4 | PDFBox is already a dependency. | Overlay can be drawn server-side without a new library. |
| 0.5 | A copy first stores the revision's generic published PDF at request time; the copy-specific PDF is composed at distribution (`finalizeDistributedCopy` async batch path, or the single-copy path) and must fail the whole action if composition fails (TBR-CC-011). Recipient preview endpoints already exist and are token/password based. | The overlay belongs in the composition step, before `storeControlledCopyPublishedPdf`. An administrator preview endpoint is a separate addition. |

## 3. Decisions requested from QA

1. One Active Publishing Template; publishing another retires the previous one (audited); an Active
   template is not edited in place -- changes go through a new version.
2. Controlled Copy uses the template version recorded at Revision publication.
3. Recipient data (name, job title, department, e-mail) is captured at distribution time and stored
   immutably on the copy.
4. Mandatory content of the stamp; whether it is applied to every page; whether it can be disabled.
5. External recipient printed as the e-mail address.
6. Content of the Recall Notice.

## 4. Rollback / continuity notes

- New tables/columns are additive; the "single Active template" constraint is applied only after the
  current data is verified (one Active template exists today).
- No object is deleted as compensation (WORM retention).
- Copies distributed before the change keep their stored PDF unchanged.

## 5. Phase 1 -- implemented design (revised after Phase 0)

Instead of rebuilding a template from snapshots, a published template row is made **immutable**; a Controlled Copy then
composes with the same row that the revision's publication used (`metadata.publishing_template_id`).

- V478: unique partial index `uq_publishing_templates_single_live` (one ACTIVE/PUBLISHED template); revision-level page
  range columns on `revision_publishing_metadata`; `publishing_templates.supersedes_template_id`.
- A template with `published_at` is read-only (update, component upload/delete, placeholder-style write/delete return 409
  `PUBLISHING_TEMPLATE_PUBLISHED_IMMUTABLE`). A change goes through `POST .../{id}/new-version` (editable copy that
  supersedes it); publishing it retires the previous live template (`PUBLISHING_TEMPLATE_RETIRED`, audited).
- The Publishing Workspace no longer writes page ranges onto the shared template (this was a defect: one document's
  publication changed the template used by every other document and copy). Ranges are stored per revision and applied to a
  detached copy for composition. `PublishingWorkspaceService.effectiveTemplate(metadata)` gives Controlled Copy and the
  async snapshot the same ranges.
- The workspace accepts only the single live template; a client-supplied id can only confirm it; publishing with a preview
  built on a template that is no longer live returns 409 `PUBLISHING_TEMPLATE_NOT_ACTIVE`.

Known limits / open items:
- Revisions published before this change keep pointing at the shared, previously editable template row (and their
  ranges fall back to that row): their controlled copies reproduce the *current* row, not necessarily what was used at
  publication. 112 metadata rows have no template at all (Legacy Import). Not correctable from the data.
- During the acceptance test the live template was swapped and restored: its version counter went 12 -> 13 and a test
  version was created and deleted (audit entries exist).
- GitNexus impact / detect_changes could not be run (tool not available in this session).

## 6. Phase 2 -- implemented (Controlled Copy placeholders)

- V479 `controlled_copies.recipient_snapshot` (jsonb). The recipient's name, e-mail, job title, department and business
  unit are captured once when the copy is distributed (`ControlledCopyPlaceholderValueBuilder`) and never re-read from the
  user profile. An external recipient is identified by e-mail address only (name = e-mail, empty job title/department).
- Server-computed, reserved placeholders: copyNo, totalCopies, distributionList, recipientName, recipientEmail,
  recipientJobTitle, recipientDepartment, copyExpiryDate, distributedBy, distributionDate, requestedBy, requestPurpose,
  copyLocation. A custom placeholder field can no longer use a reserved key (create is refused; a value typed for one at
  distribution is ignored). Behaviour change: copyNo/distributionList/recipientDepartment could previously be overridden by
  a DCO-typed value when an admin registered them as fields; no such field existed in the database.
- `recipientDepartment` now comes from the recipient (it previously used the source document's department).
- Placeholder style option `visibility` (BOTH / PUBLISH / CONTROLLED_COPY, default BOTH). The context is a server-set marker,
  never client input; a hidden placeholder renders empty.
- Acceptance evidence (dev DB, 2026-09-27): 3 copies (1 internal, 1 external e-mail, 1 with a publish-only placeholder)
  distributed through the API; the issued PDFs were read from MinIO and their text checked. The test copies
  CC.GUI.9107.001-003 (document GUI.9107, itself a test document) remain in the database; the acceptance template was
  deleted and the test revision's metadata was restored.
- Also fixed: a missing required request header returned HTTP 500; it now returns 400.

## 7. Phase 3 -- implemented (stamp and watermark burned into the issued PDF)

- Configured on the existing Controlled Copies Policy screen (same permission `documents.admin.controlled_copies_policy.manage`,
  same electronic signature on save, same audit trail: every changed field is recorded).
- Finding: the previous "Watermark" policy only drew a diagonal text on the rendered preview page images; the stored/downloaded/
  printed PDF carried no mark. The watermark is now burned into the issued PDF as well (`ControlledCopyPdfMarkingService`,
  PDFBox); copies issued earlier keep the on-screen overlay (`controlled_copies.marking_applied = false`), new copies skip it so
  a page is never marked twice.
- V480: stamp (text, color, position, size, opacity, pages, shown lines) and watermark (text, color, opacity, angle, pages)
  settings; all validated server-side (hex color, whitelisted text characters, ranges, enumerations).
- The marks are applied while composing the copy, before storing, for every copy (with or without a Publishing Template);
  a failure fails the distribution (no unmarked copy is issued). Positions follow the displayed page for any /Rotate.
- A Unicode font (Noto Sans Bold, SIL OFL) is bundled so Vietnamese names render; characters with no glyph become "?".
- Defaults are ON (stamp CONTROLLED COPY, red, top right, every page; watermark on). QA to confirm mandatory content.
- Acceptance evidence (dev DB, 2026-09-27): copies CC.GUI.9107.004-006 issued; PDFs read from MinIO and rendered; a custom
  policy (blue stamp, bottom-left, first page only, red horizontal watermark) was applied and then the defaults restored.
- Known limits: a printed copy cannot show a later recall; the stamp shows the expiry known at issue time.

## 8. Phase 4 -- implemented (withdrawal / recall notice; recipient messages)

- Finding: a recalled / expired / superseded copy is already refused for every preview, page, download and print call
  (`requireStatusAllowedForPreview` -> HTTP 410 `CONTROLLED_COPY_NOT_AVAILABLE`), so no on-screen "RECALLED" overlay is needed for
  recipients. The stored PDF of a printed copy cannot show a later recall (it was composed at distribution).
- The 410 message now names the reason for a superseding revision, an obsolete revision and an obsolete document too (previously
  a generic message).
- New `GET /controlled-copies/{id}/withdrawal-notice` (`ControlledCopyWithdrawalNoticeService`): one-page PDF built on the
  server from the copy record and the recipient snapshot: copy, document/revision, holder (name, e-mail, job title,
  department), location, distribution, reason (recall, expiry, new revision, revision/document obsolete, lost, damaged,
  destroyed), withdrawal date and person, return instruction, and return/receipt signature block. Title is RECALL NOTICE for a
  recall, WITHDRAWAL NOTICE otherwise. Available only for a copy that is no longer valid (409 otherwise), to a user who can view
  the copy AND holds `documents.controlled_copy.recall` (403 otherwise). Every generation is audited
  (`GENERATE_WITHDRAWAL_NOTICE`). The server exposes a `withdrawalNotice` action capability; the UI only shows the button.
- Evidence (dev DB, 2026-09-27): notices generated for a recalled, an expired and a superseded copy; refused for a valid copy
  (409, capability denied) and for a user without the permission (403).
- Side effect: for copies distributed before recipient snapshots existed, generating a notice captures the snapshot from the
  user's *current* profile (its `capturedAt` shows when). Three existing copies were captured this way during the test
  (CC.SOP.10110.002, CC.SOP.10110.021, CC.SOP.0037.112).

## 9. Phase 5 -- implemented (Document tab; preview before distribution)

- New `GET /controlled-copies/{id}/document` (read-only, `Cache-Control: no-store`, inline). Authorised for a user who can view the copy
  and holds `documents.controlled_copy.view_file` (403 otherwise); the server exposes a `viewDocument` action capability and the UI
  shows the "Document" tab only when it is allowed. No download/print counter is consumed; every view is audited
  (`VIEW_ISSUED_DOCUMENT`).
- What the server returns: the stored issued PDF while the copy is valid; the same PDF with a red diagonal status text drawn on a
  copy of the bytes once it is withdrawn (RECALLED BY DOCUMENT CONTROL / EXPIRY DATE PASSED / ... and the date) or cancelled; and,
  for a copy that is Ready for Distribution, a preview composed and marked exactly as distribution would (nothing stored, recipient
  snapshot not persisted) with "PREVIEW - NOT ISSUED". The stored file is never modified.
- Finding during acceptance: the four-line stamp at the top right covered the header (page / code) of the real Publishing Template. Defaults
  are now a compact stamp (title and copy number, small) placed 10 pt from the edge (V481 also updates the existing policy row; the
  stamp settings had not been customised). The recipient and expiry stay on the watermark. Administrators can still choose more lines,
  another corner or a larger stamp -- QA/admin must check the result against their own template.
- Evidence (dev DB, 2026-09-27): document view for a ready copy (preview; DB row unchanged before/after), a distributed copy and a
  recalled copy rendered and read; refused for a user without the permission.

## 10. Marking refinement (after review of a rendered copy)

- The watermark is drawn BEHIND the page content (PDFBox PREPEND stream); the stamp stays on top. Sub-lines are smaller. Default watermark
  content is the title and the copy number only (recipient / distributed / expiry are off by default; V482 updates the existing row when
  all three were still at the old defaults).
- Stamp position: choose the corner (4) and the distance from the edge in millimetres (0-40, default 4; server-validated).
- Note: the text "UNCONTROLLED WHEN PRINTED" seen on copy CC.GUI.9107.006 came from a deliberately unusual test configuration used
  during Phase 3 acceptance; it is not a default and nobody requested it. That copy (a test copy) keeps what it was issued with.
- Evidence: copies CC.GUI.9107.007 (defaults) and .008 (bottom right, 12 mm) rendered; the bottom-right example overlaps the template's
  footer, which shows why the position/distance must be chosen against the actual template.

## 11. Stamp / watermark for Obsoleted and Closed - Cancelled copies (V483, V484)

- V483 `status_marking` (jsonb): per-status stamp + watermark config (keys OBSOLETED, CLOSED_CANCELLED only), edited on the Controlled Copies Policy screen; applied by the server on a copy of the stored PDF in the Document tab view. The stored (WORM) file is never changed.
- V484 `watermark_layer` BEHIND|ABOVE: issued default BEHIND, status marking default ABOVE (an alert must not be hidden by opaque table cells; found by rendering a real SOP).
- Validation (server): text charset/length, `#RRGGBB`, position/size/layer enums, watermark opacity 5-60, angle 0-90, stamp margin 0-40, stamp opacity 30-100; unknown status keys and null objects rejected; partial updates keep unsent values; per-field audit.
- Defect found by the validation matrix: decimals (50.5) were silently truncated. Fixed with `StrictIntegerDeserializer` (now 400).
- Evidence: 91/91 status-marking API checks + issued-marking matrix, unit tests (ControlledCopyStatusMarkingTest 9, ControlledCopyPdfMarkingServiceTest 12), 919 backend tests in the related run with 0 failures, rendered PDFs for OBSOLETED and CLOSED_CANCELLED with layer ABOVE.
- Not covered: browser check of the new settings UI, GitNexus impact/detect_changes (tool unavailable), QA Decision Log approval, printed copies cannot show a later recall.

## 12. Per-card Reset Position (2026-09-30)

- Request: mirror the user-tested Uncontrolled Copies Policy reset controls in Controlled Copies Policy.
- Scope: `ControlledCopiesPolicyView.tsx` and its focused regression tests only; no API, backend, schema, or shared MarkCard changes.
- Invariants: existing policy-management permission remains required; reset modifies the local draft only. Existing Save Changes, signature request, server validation, and audit persistence are unchanged. No lifecycle, issued artefact/checksum, parent-child, or async generation changes.
- Stamp and Watermark each have a right-aligned outline-emerald Reset Position footer, shown only when that kind has a custom placement. Reset removes that kind's coordinates and placement size/angle across page groups in the selected scenario only (ISSUED, OBSOLETED, or CLOSED_CANCELLED). Other kinds/scenarios and base text/style/enable settings are preserved; empty placement rules are removed.
- GitNexus upstream impact for the component: LOW, 0 indexed direct callers and 0 affected processes. This is static index evidence, not proof of runtime isolation.
- Automated evidence: `ControlledCopiesPolicyView.test.tsx` 8 tests, covering both kinds in all 3 scenarios, page-group cleanup, scenario switching, preservation of other placements and base defaults, signed Save payload, read-only access, and no-custom-placement visibility. Together with `UncontrolledCopyPolicyView.test.tsx`, 15/15 tests passed.
- TypeScript `tsc --noEmit --pretty false` passed; scoped `git diff --check` passed. GitNexus `detect-changes -s all` reported 150 files / 516 symbols / 100 flows, CRITICAL for the entire pre-existing dirty worktree; this aggregate cannot be attributed to this 3-file UI/test/evidence change. No commit was made.
- Limitations: focused UI tests mock preview rendering and the API; live browser/rendered PDF and server audit integration were not retested. No deployment or compliance claim is made.
