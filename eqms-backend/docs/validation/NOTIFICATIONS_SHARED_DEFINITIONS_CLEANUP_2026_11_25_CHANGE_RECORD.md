# Notifications shared definitions and retired UI routes — 2026-11-25

Status: implemented; final verification recorded below; not QA release approval.

## Request and scope

Owner requested moving the remaining shared frontend definitions from
`features/settings/email-templates` into `features/settings/notifications`,
removing obsolete UI routes, and preserving email delivery behavior.

- Move constants to `notifications/emailTemplateConstants.ts` and API interfaces
  to `notifications/emailTemplateTypes.ts`, without changing exported names,
  values, variable tokens or payload fields. Use a type-only local import.
- Update the email editor and API client's imports.
- Remove old UI redirects `email-templates/*`, `notification-policy/*` and the
  retired email creation/editing paths in TRANSACTIONAL_PREFIXES. These UI URLs
  now fall through normal unmatched-route handling, rather than redirecting.
- Preserve the active `/settings/notifications` routes and their existing guards.
  `/settings/email-templates` remains the live backend API, not a retired UI route.

## Invariants and source evidence

No change to actors, authorization/object scope, recipient selection, event
policy, subject/body rendering, send/test-send, SMTP, outbox/retries, lifecycle,
artefact version, signature, optimistic concurrency or audit. All backend source
is untouched by this change. Existing unrelated work is left in place.

Source-confirmed references: `SettingsRoutes.tsx`, `routes.constants.ts`,
`EmailMessageEditView.tsx`, `services/api/emailTemplates.ts`, backend
`EmailTemplateController`, `EmailService`, `EmailNotificationService`,
`NotificationAdministrationService` and `NotificationDispatcher`.

GitNexus upstream impact before edits: settingsRoutes LOW (one direct caller,
one affected process); EmailMessageEditView and getEmailTemplateTypeConfig LOW
(zero direct callers in indexed graph); TRANSACTIONAL_PREFIXES LOW. Manual import
search additionally confirms the editor and API client's type dependency.

The repository paths `docs/system/00_EVIDENCE_CONVENTIONS.md` and
`docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md` referenced by the validation
skill were absent at inspection time. This record explicitly states source,
test and execution evidence without inventing a business rule or compliance claim.

## Verification

Evidence logs are stored outside the source tree in
`%TEMP%/eqms-notifications-cleanup-20261125/`.

New regression coverage exercises active UI routes with exact guard permissions,
retired UI routes, denial at the guard, unchanged API endpoint/filters/payloads,
signature and concurrency field forwarding, preview, test-send, publish, restore,
and propagation of a server refusal without another request. API/SMTP calls in
these frontend tests are mocked; no email is sent.

Backend regression scope: EmailNotificationServiceRegistryRoutingTest,
EmailFrameAndDesignTest, NotificationAdministrationServiceTest,
NotificationWordingAndChannelsTest, NotificationDispatcherEmailChannelTest.

- Backend: 54 tests passed, zero failures/errors/skips across the five suites.
- Frontend: initial related run 128/129 passed; the existing multi-search
  placeholder test timed out at 5 seconds. A separate run of its complete
  NotificationEventView suite passed 45/45 with the same default timeout, without
  changing that test or production behavior. All 17 new route/API cases passed.
- TypeScript (`tsc --noEmit --incremental`) and production build passed.
  Source comparison against HEAD confirms moved
  constants are identical apart from the type-only import, and interfaces are
  identical apart from their introductory comment. No old feature-folder import
  remains; the only production frontend `email-templates` path is the active API.
- GitNexus compare to main reports 300 files/910 symbols/81 flows at CRITICAL
  aggregate scope, including unrelated workspace work. This task does not modify
  backend runtime code, commit, push or restart application containers.
- A failed attempt to remove the now-empty old directory was blocked by the
  execution policy; its two tracked files were already moved successfully. Git
  does not track the empty directory, so the source cleanup is complete.
