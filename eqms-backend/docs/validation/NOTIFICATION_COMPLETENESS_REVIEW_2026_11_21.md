# Notification completeness review — 2026-11-21

Status: **source-confirmed and runtime-confirmed on a copy of DEV; not a QA approval.**

## Method

For the 132 registered events: registry, policy (channels, status, recipient rules), active template per
channel (content, declared variables, link), the code that raises the event, and what was really sent on DEV
(in-app rows, e-mail outbox, delivery failures). Gaps were found by comparing the actions written to the Audit
Trail with the events that follow them.

## What was complete

- Every enabled channel has an active template; no empty template; no policy without an event or the reverse.
- Every event is raised by code (the guard test `EveryRegisteredNotificationHasASenderTest` passes).
- Three events are off by default on purpose: `system.configuration_changed`, `document.legacy_import_finished`,
  `document.editing_lock_changed`.
- About 40 events support e-mail but start in-app only; this is the configured default, not a defect.

## Defects found and fixed

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | **Expiry notices reached nobody.** `document.expired` and `document.expired_copy_holder` were seeded with no recipient rule; the dispatcher takes recipients only from the rules ("no recipients resolved"). | 86 documents marked "notified" in `document_expiry_processing`, 0 in-app rows and 0 e-mails for the event; log "dispatch skipped: no recipients resolved" | V840 gives both policies the rule `RECIPIENT` (the people `DocumentExpiryNotifier` passes: every Active user, the copy holders get their own message); the seed says the same; a policy an administrator already changed is not touched |
| 2 | **A document was marked notified even when nothing was sent.** | same | `DocumentExpiryNotifier` marks it only when the notice was sent or switched off on purpose; otherwise it stays un-notified and the scheduler tries again, with an error in the log (`DocumentExpiryNotifierTest`) |
| 3 | **The audit-review e-mail lost the campaign name** ("assigned audit review campaign ."): the template (made from the old in-app wording by V776) uses `{{campaignName}}`, the audit sender did not give it, a missing variable renders as empty. | template on DEV and in the migrations | `AuditNotificationBridge` gives `campaignName`; the variable is declared for the campaign events and `endDate` for `user.time_limited_access_expired` (the catalogue seed, because the bootstrap rewrites the declaration at each start) |

The 86 documents that expired without a notice are **not** notified afterwards (owner decision): a notice long
after the date would mislead. The gap is recorded in the Decision Log.

## Gaps filled (owner chose them)

| New event | Raised when | Who is told | Channels |
|---|---|---|---|
| `user.account_created` | user created | the new person (no sign-in detail in the text) | in-app, e-mail |
| `user.account_reinstated` | suspended user reinstated | the person | in-app, e-mail |
| `user.time_limited_access_changed` | time-limited window created, amended, cancelled | the person | in-app, e-mail |
| `user.time_limited_access_expiring` | 3 days before the window ends (once per window; V841 `expiry_warned_at`) | the person | in-app, e-mail |
| `user.access_profile_changed` | profile assigned to or removed from a person (all four code paths; only if they held it) | the person | in-app, e-mail |
| `security.workflow_policy_changed` | workflow action policy activated or its relations changed | holders of `security.workflow_authorization.manage` | in-app, e-mail |
| `access_review.campaign_completed` | campaign completed and signed | the person who created it | in-app |

The number of days (3) was chosen by the assistant; it is a constant in `TimeLimitedUserGrantScheduler`.

## Verified at run time (copy of DEV)

Created a user, suspended and reinstated them, created a time-limited window, assigned and removed profiles:
in-app notices of `user.account_created`, `user.account_reinstated`, `user.time_limited_access_changed` and
`user.access_profile_changed` (assigned, and removed only for a profile the person held) were recorded, and the
e-mails were queued (they failed to deliver because the isolated setup has no reachable SMTP server).
`access_review.campaign_completed` and `security.workflow_policy_changed` are covered by the audit bridge test
and the registry guard, not run live. The expiry notice was verified by the migration, the seed and unit tests,
not by letting a document expire.

## Not done / open

- Password-expiry warning, a "document expires soon" notice and a notice that an Access Review campaign is overdue
  for the owner were not selected.
- Delivery failures on DEV (655 failed, 349 unknown outcome, 5,074 failure rows) come from tests that simulate an
  SMTP failure and from the mail catcher being down; they are not product defects.
- E-mail wording is English only (as the rest of the catalogue).
