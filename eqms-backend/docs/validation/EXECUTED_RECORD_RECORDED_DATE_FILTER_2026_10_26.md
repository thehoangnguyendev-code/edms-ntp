# Executed Records — Recorded Date filter — 2026-10-26

## Request and approved scope

Owner requested the missing Recorded Date filter on the Executed Records list. Add a date range using the existing date-picker/filter components, with server-side filtering. Recorded Date is the existing table column backed by `ExecutedRecord.createdAt`; Received Date remains `filledAt`.

## Invariants

- Existing `executed_record.view` enforcement and controlled-copy recipient/all-copy visibility predicates remain in the same server query. No new permission or disclosure scope.
- Optional `recordedFrom`/`recordedTo` parameters add AND predicates on `createdAt` before server pagination/counting. Start is inclusive local midnight; end is exclusive midnight of the next day in `DateTimeFormatUtils.ZONE` (Asia/Ho_Chi_Minh).
- Received and Recorded ranges are independent and can be combined. An inverted range returns no matches, following the existing Received Date query convention.
- No lifecycle, parent/child, file/checksum, e-signature, audit-write or async-generation behavior changes. No DB migration.
- The original nine-argument service method delegates with empty Recorded Date bounds for existing internal callers. Existing HTTP callers may omit the new parameters.
- Desktop standard and compact modes and the mobile filter drawer expose the new range; Clear Filters clears both ranges; changing either range resets paging. Compact mode retains its existing Apply behavior.

## Source and impact

`ExecutedRecordsView.tsx` → `ExecutedRecordListParams` → `ExecutedRecordController.list` → `ExecutedRecordService.list` → JPA Specification on `ExecutedRecord.createdAt`.

GitNexus upstream impact before edits: LOW for the controller (0 direct callers), service (1 direct caller), and view (0 indexed direct callers); no indexed affected execution processes. Index counts do not replace source review. The evidence conventions document and one-change record template named in AGENTS.md are absent from this checkout; this record documents source/test evidence and makes no compliance certification claim.

## Verification

- Frontend: 7 ExecutedRecordsView tests pass, including independent ISO query bounds and clearing both date ranges while rendering the server response.
- TypeScript: `npx tsc --noEmit` passes.
- Backend: 17 tests pass (ExecutedRecordSortIntegrationTest 4, ExecutedRecordServiceTest 11 and EformRetirementContractTest 2), none skipped. New integration coverage exercises local midnight, last microsecond of the end day, next midnight exclusion, one-sided bounds, combination with Received Date, inverted bounds and server counts. Integration fixtures run in a rollback transaction.
- Runtime: backend and frontend Docker images rebuilt and containers started successfully. Logged-in browser interaction with the new picker was not verified in this change; query behavior is integration-test-confirmed, not a claim of manual UI validation.

## Rollback

Remove the optional query predicates and UI date range; no data rollback is needed. Existing records and stored files are unchanged. No commit/push unless separately requested.
