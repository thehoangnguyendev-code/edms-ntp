# Documents list: Reviewers, Required Training?, Training Period (Days), Approvers (2026-10-07)

Owner request (display and retrieval only; no lifecycle, permission or signature rule changes).

- **Columns** (right of Valid Until): Reviewers, Required Training? (Yes/No), Training Period (Days) (a dash when no training is
  required, whatever number is stored), Approvers. Names are in workflow order and come from `document_workflow_participants`.
- **Sort on the server** for all four: `reviewers` / `approvers` by the first-to-last joined names (database-computed read-only
  `@Formula` fields on `DocumentRecord`, never written), `requiresTraining`, `trainingPeriodDays`.
- **Filters on the server**: `reviewerId`, `approverId` (an EXISTS on the participant table, so no row is duplicated; an unknown or
  malformed id matches nothing, `All` matches everything) and `requiresTraining` (yes/no). Offered in all three filter screens
  (standard, mobile drawer, compact panel); the Reviewers/Approvers options are the same active users as the Author filter.
- **CSV export** carries the same filters and four more columns.
- **Custom Column** picks the columns up automatically (per-user layouts keep their saved order; new columns join at the end).
- **DB**: V550 adds two indexes on `document_workflow_participants` for the new lookups; no data or column change.
- **API**: `GET /documents` and `/documents/export` take `reviewerId`, `approverId`, `requiresTraining`; list items gain
  `reviewerNames`, `approverNames`, `requiresTraining`, `trainingPeriodDays`. The page's participants are loaded in one query.
- **Tests**: `DocumentListParticipantColumnsIntegrationTest` (real schema: columns, filters, sorts), `DocumentsView.columns.test.tsx`,
  `DocumentFilters.compact.test.tsx` (+2), `documentListParticipantQuery.test.ts`.
- **Not done**: not tried in a browser; the other Documents-style screens (Revisions) were not given these columns; GitNexus impact and
  `detect_changes` not run (tool not available in this session; nothing committed).
