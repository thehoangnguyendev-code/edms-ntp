# Personal calendar — scoped change record

Date: 2026-10-01. Status: implemented and locally verified; deployment/UAT pending.

## Request and approval

User requested a Calendar menu immediately below Notifications, a real current-month calendar, FE/BE/API/DB implementation, and reuse of existing UI components. User selected all three sources (EQMS milestones, notifications, personal events), required a separate calendar for each user, and explicitly approved immediate implementation (“Dựng luôn”).

The referenced governance decision log, As-Is evidence conventions and `docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md` are absent from this checkout. This fallback record follows the existing scoped change-record pattern; it is not an approved governance decision or a GMP-compliance assertion.

## Invariants

- Actor: existing authenticated, active-account authorization is required by the server. Owner is derived from the session, never from the request. No admin bypass for another user's personal events.
- Object scope: personal reads, updates and deletion include owner ID and undeleted status. Unknown and other-owner IDs both return 404. Source notifications are recipient-scoped. Document/revision milestones require existing module/feature access and existing per-object authorization before any metadata is returned.
- Lifecycle and parent/child: source records are read-only. Calendar operations never create/update document, revision, training, controlled-copy, or notification lifecycle data.
- Artefacts, checksum, e-signature, audit: no PDF/file/snapshot/signature mutation. Personal events are not regulated source records; timestamps, soft deletion and optimistic version are stored, but no regulated audit-trail claim is made.
- Async generation: no new job, renderer, reminder, scheduled task or generation workflow. Notification/document changes can invalidate a view; connection pings do not trigger reloads.
- Calendar computation and filtering are server-side. FE only renders returned days/events and converts picker display formats. There are no production fixture events or hard-coded month/date grids.
- Date contract: personal times are floating local date-times. All-day request end is inclusive; storage/response end is exclusive. Notification instants are displayed using configured system time zone. UI states this contract.
- Concurrency: update/delete require the current version; JPA optimistic locking also protects simultaneous writes.

## Implementation and API

- BE: `CalendarController`, `CalendarService`, `CalendarSourceRepository`, `CalendarEventRepository`, `CalendarEvent`, DTOs under `dto/calendar`.
- DB: `V520__create_personal_calendar_events.sql`; owner FK, strict time-order CHECK, soft deletion/version/timestamps, two owner/date partial indexes. V520 avoids the existing V515 migration collision. Source tables are not changed.
- Menu: backend `NavigationService`, frontend `app/navigation.ts`, `app/routes.constants.ts`, `app/AppRoutes.tsx`.
- FE: `features/calendar/CalendarView.tsx`, CSS module, `CalendarEventModal.tsx`, formatting helpers; API client `services/api/calendar.ts`.

| Endpoint (under existing /api prefix) | Contract |
| --- | --- |
| GET /calendar?month=YYYY-MM&source=ALL | Month may be omitted; source ALL/EQMS/NOTIFICATION/PERSONAL. Server returns month navigation, today, zone, weekdays, complete Monday–Sunday week grid and authorized daily events. |
| POST /calendar/events | Title, description, start, end, allDay; owner not accepted. 201. |
| PUT /calendar/events/{id} | Same fields plus version; owner-scoped. 404/409 where appropriate. |
| DELETE /calendar/events/{id}?version=N | Owner-scoped soft deletion. 204; stale version 409. |

EQMS training entries use actual revision training planned/end/completion dates. No independent training-course entity was found, so no fabricated course calendar or attendance relationship is introduced. Notifications are shown by receipt date, not interpreted as a deadline. Their action opens the existing Notifications page.

## Verification evidence

- Maven: `mvnw.cmd -q "-Dtest=CalendarServiceTest,CalendarQueryMappingTest" test` — 14 tests passed. Covers server leap-month generation, owner-scoped range, configured zone, invalid range/source, permission denial, recipient scope, inclusive/exclusive dates, other-owner update/delete denial, stale version, soft deletion. Query-mapping tests parse exact repository HQL against all Hibernate entities without DB access.
- FE: `npx vitest run src/features/calendar/__tests__` — 9 tests passed. Covers display/date contracts, server month/source calls, no ping reloads, abort on refetch, owner-switch data clearing, error/retry, create/edit API payload and version, retaining input after save rejection.
- `npx tsc --noEmit` — passed.
- `npx vite build` — passed; existing large-chunk warnings remain outside this scoped Calendar change.
- Migration executed against PostgreSQL in a temporary schema inside a single transaction and rolled back. Verified DDL, owner/date overlap predicate, exclusive end, invalid time-order CHECK, and soft-deletion exclusion. No production schema/data or Flyway history changed.
- UI skill probe at 375/768/1280/1440px on temporary harness importing actual Calendar components: no horizontal overflow; final report has 0 blocking findings. Inspected screenshots including creation modal; corrected desktop agenda button height, text contrast and selection emphasis. Fixtures/stubs live only under OS Temp, not production source. Shared project Select/scrollbar/focus styling findings retained to preserve UI consistency; missing favicon in temporary harness is not an application error.
- Live `/calendar` browser probe reaches Sign In without credentials; authenticated end-to-end runtime verification remains pending. Source query mapping is verified, not a production-data query execution.

## Notification-day task drawer extension (2026-10-01)

User approved removal of the bottom agenda and a day-click right drawer, with clear separation of actionable tasks and notifications. User explicitly chose notification creation day rather than deadlines; handled tasks stay on that day with a faded title and completed check. User also approved proceeding after the GitNexus CRITICAL warning on `CalendarService.month`. The graph expands through an unnamed caller; its large indirect blast radius is unresolved, not represented as a verified dependency list. Exact FE component/class/test impacts were LOW.

Additional invariants: completion is read-only, derived from matching workflow-history action **by the current actor at/after this notification's creation**, never from notification `read` status, an earlier workflow round, another participant, or terminal status alone. No manual calendar completion endpoint, workflow mutation, signature/audit change, stored duplicate task status, or new DB migration. Existing per-object authorization and workflow engine remain authoritative. Broad administrator capability alone does not create reviewer/approver/author assignment. Unrecognized notification codes remain informational. Unauthorized/missing source revisions are not enriched. Notifications stay recipient-scoped; deleted notices are excluded.

Implementation: new `CalendarTaskProjectionService` recognizes authoring/rejection, review, approval, ready-for-submission and ready-for-publishing notification machine codes. Response adds `category`, `taskStatus`, `actionLabel` and server-generated work destinations. State values are PENDING, WAITING, COMPLETED, UNAVAILABLE; denied work offers a view-only record link. EQMS milestones and private appointments remain separate Events, not fabricated tasks/deadlines. Existing notification/document SSE invalidates authorized month data; pings do not refetch. New shared Drawer provides portal, right slide, reduced-motion handling, focus trap/restore, Escape/backdrop close and scroll lock.

Verification: targeted Maven suite passed 27 tests (12 CalendarService, 2 offline Hibernate query mappings, 13 task projection). Negative coverage includes read != completion, prior-round/other-actor history, recipient privacy, denied/invisible objects, unknown type, deleted notification, broad admin permission without assignment and sequential waiting. FE suite passed 13 tests, including whole-day drawer opening, no bottom agenda, category separation, faded completed state, work destination, empty state and Escape closure. TypeScript and Vite build passed (existing bundle-size warnings remain). UI probe at 375/768/1280/1440px found zero blocking findings; actual drawer screenshots inspected on temporary fixture harness. No horizontal overflow; drawer 375px full-width / 448px desktop; focus restored after closing. Fixtures are OS Temp only, not production data.

Authenticated runtime/UAT remains pending: backend Docker still uses its prior image. This turn does not deploy the dirty workspace or apply unrelated migrations. Verify two actual users, review/approval sequence, rejection/resubmission, completion updating original receipt day via SSE, authoring/submission/publishing destinations and denied scopes after normal rebuild/deployment. No GMP compliance or release approval claim.

## Deployment / acceptance still required

Backend Docker is still running its existing image. Rebuild/restart the backend through the normal deployment flow so Flyway applies V520 and new API/menu code is loaded. Review other pending workspace migrations before deployment; this task does not apply unrelated changes automatically. Frontend uses existing Vite/Docker build flow.

After deployment, verify with two ordinary accounts and an admin: distinct personal events; cross-owner update/delete denied; permitted EQMS records only; own notifications; create/edit/delete persist across logout/login; months across leap/year boundaries; configured zone; mobile layout and source navigation. Do not mark release/UAT approved until these authenticated checks have actual recorded results.
