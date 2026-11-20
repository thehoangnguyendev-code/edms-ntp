# Change record: the three tabs of Configuration > Integrations (Storage, Storage Usage, OnlyOffice) redesigned, with the data they needed (V819)

Date: 2026-11-19. Follows the layout of the other change records in this folder: `08_ONE_CHANGE_RECORD_TEMPLATE.md`, which `CLAUDE.md` names, is **not in the repository** (nor are `09_ASSURANCE_OPERATING_MODEL.md` and `docs/system/`), so this record was written from the precedent `CONFIGURATION_PERMISSIONS_PER_PAGE_2026_11_18_CHANGE_RECORD.md`. Owner request (2026-11-19): "do all of it, from FE, BE, API, DB", after the wireframes were chosen (Storage Usage: option B; the other two tabs: all five proposals each). Open points are in the Decision Log, entry `INTEGRATIONS-TABS-2026-11-19`.

## 1. What changed and why

15 proposals (S1–S5 Storage, U1–U5 Storage Usage, O1–O5 OnlyOffice). Ten are screen-only; five needed data that did not exist.

| Tab | Proposal | Where the data comes from |
|---|---|---|
| Storage | S1 state card with the last test, S2 three blocks, S3 retention control with a confirmation, S4 layout table, S5 provider cards | S1: **new** `integration_check_result` (the last test of each integration). Others: existing data |
| Storage Usage | U1 "What grew", U2 estimate, U3 7/30/90 days and jumps, U4 table and CSV | The history that every measurement already stores (`by_domain`, `by_file_type`) |
| Storage Usage | U5 badge and "last warning sent" | **new** columns `storage_usage_scan_state.warning_notified_at`, `warning_recipient_count` |
| OnlyOffice | O1 test step by step | **new** `OnlyOfficeConnectionCheckService` (health check + the saved JWT secret tried on the command service) and the same result table |
| OnlyOffice | O2 "Test saved settings", O4 switch, O5 values for the other side | existing (`callbackBaseUrl` was already in the configuration response) |
| OnlyOffice | O3 secret card | **new** `jwtSecretChangedAt` kept by the server inside the OnlyOffice JSON node; "Generate new" is made in the browser (32 random bytes) |

## 2. Rules in the code (the invariants)

- **The last test is a convenience record, not evidence.** `IntegrationCheckService.record` never throws (a failure is logged), so the answer of a test never depends on it; one row per integration, overwritten by the next test. The subject kept names what was tested (`MinIO · endpoint · bucket`) and **never a secret**; the screen compares it with what it would test now and says "that test was of another setup" instead of presenting it as the state of this one. Text from an exception is cleaned to one bounded line (500).
- **Permissions.** `GET /settings/system/integrations/checks` needs the View permission of the Integrations page; both test endpoints still need Manage (a View holder cannot run a test: tested).
- **The OnlyOffice test reads the saved settings** (as its comment always said). It now looks at two things it can verify from this side: the `/healthcheck`, and whether the saved JWT secret is accepted by the command service (`{"c":"version"}`, answer 0 = accepted, 6 = refused). Whether the Document Server can call this application back **cannot** be checked from here and is not claimed. A step that cannot tell is `NOT_CHECKED`, which is not a failure: a healthy server whose secret could not be confirmed stays a success (as before). The one new way to fail is a secret the server **refused** (code 6). `success` and `message` keep their shape; `steps` is added.
- **`jwtSecretChangedAt`** is set by the server only when the stored secret really changes (including clearing it); a value sent by the request is always dropped.
- **Warning history.** `warning_notified_at` / `warning_recipient_count` are written with the notice and are **not** cleared when the notice is armed again. The screen says "No warning is recorded", never "none was sent" (notices before V819 were not recorded).
- **Retention.** The change is the one thing on the page that cannot be undone, so Save asks to acknowledge it (`AlertModal` got an optional `confirmDisabled`, default `false`). The acknowledgement is a screen rule: the server does not require it (the API is unchanged).
- **Save of the budget and the threshold** is part of the page's Save, Reset and unsaved-changes guard (see the earlier record of the same day in the Decision Log; the policy is written last and only when it changed).
- **Screen rules.** Everything on Storage Usage that is worked out from the history follows the chosen period; the estimate is a straight line, labelled as an estimate, left out when the size is past the budget, not growing, or more than 10 years away.

## 3. Migration V819

`storage_usage_scan_state` gets two nullable columns; `integration_check_result(integration_key PK in ('STORAGE','ONLYOFFICE'), success, message, subject, steps jsonb, checked_at, checked_by → app_users ON DELETE SET NULL)`. Additive only. Applied to DEV by the backend start (Flyway log: "Successfully applied 1 migration ... now at version v819").

## 4. API

New: `GET /settings/system/integrations/checks`. Changed (compatible): `POST /settings/system/onlyoffice/test-connection` adds `steps`; `GET /settings/storage-usage/status` → `scanState` adds `warningSentAt`, `warningRecipients`; the OnlyOffice node of `GET /settings/system` may carry `jwtSecretChangedAt`.

## 5. Impact (GitNexus, CLI `node .gitnexus/run.cjs impact`, repo `edms-ntp`)

`afterSuccessfulScan` LOW (2: `sample`, `scheduleSample`), `scanState` LOW (1: `status`), `mergeGeneralConfigForStorage` LOW (3), `sanitizeGeneralConfigForResponse` LOW (6), `sendCommand` LOW (9, not edited: one method added next to it), `SettingsUserController` LOW (0), `AttendanceListExport` LOW (2). The two test endpoints came back UNKNOWN (no caller in the backend: the frontend calls them); the React components (`IntegrationTab`, `OnlyOfficeTab`, `IntegrationsTabs`, `StorageUsagePanel`, `ConfigurationView`, `AlertModal`) came back UNKNOWN (the index does not resolve them), so their callers were read in the source. **`detect-changes` could not be scoped to this change**: it covers the whole uncommitted tree (168 files, 611 symbols, "critical", most of it other work) and prints only the first 30 symbols. Run it again before the commit.

## 6. Risk and residual risk

- A refused JWT secret now turns a test red where it used to say "healthy". That is the purpose, but a Document Server with JWT turned off and a secret saved here would answer code 0 (accepted): not a false failure.
- **Not exercised on DEV:** a real refusal (code 6): it needs a wrong secret saved; covered by `OnlyOfficeConnectionCheckServiceTest` against a fake server only. The "Over the warning level" state and a stored budget were not saved on DEV (the PUT was intercepted so that DEV configuration stayed as it was).
- The label of the budget field now reads **GB** (changed in the file by the owner during this work) while the arithmetic and every size shown are binary (GiB/MiB). See the Decision Log.
- The retention acknowledgement is not enforced by the server.

## 7. Evidence

Backend: 12 test classes, 64 tests (52 in the first nine, 12 in the controller test and its two neighbours), among them `IntegrationCheckServiceTest`, `OnlyOfficeConnectionCheckServiceTest` (fake HTTP server: healthy, refused, unknown code, no secret, 502, unreachable), `SettingsUserControllerIntegrationChecksTest` (addresses, View vs Manage, results kept for success and both failures, no secret in the subject), `OnlyOfficeConfigurationServiceSecurityTest` (the change time); clean compile, exit 0. DEV (Edge): migration applied; `POST onlyoffice/test-connection` returned both steps OK on the real Document Server and the result was read back with the name of the person; `scanState` carries the new fields; Storage test card, retention acknowledgement, endpoint help, Storage Usage (what grew, table 24 rows, CSV download, 7-day period, budget typed: estimate and lines), OnlyOffice steps and "Generate new". Frontend: `configuration` 209 tests (new: panel, helpers, both tabs, retention confirmation in the page), `tsc` clean; the whole suite: 2030 pass, 4 fail of which 3 are the known load-dependent ones (pass alone) and 1 was this change (native `<table>` tags: fixed with `TableMarkup`).
