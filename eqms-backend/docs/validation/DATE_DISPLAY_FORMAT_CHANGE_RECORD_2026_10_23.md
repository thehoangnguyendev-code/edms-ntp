# Change record - one display format for dates and times (2026-10-23)

Requirement (owner): every date a person reads is `dd/MM/yyyy`; every date with a time is `dd/MM/yyyy HH:mm:ss` (24 hours). It applies to the front end, the back end, the API and the database, not only to the screens.

## Findings (source reading and DEV data)
- Electronic signature timestamp printed on documents: the active setting was `dd-MMM-uuuu HH:mm:ss` and the catalog also allowed `MM/dd/uuuu` (US order), `uuuu-MM-dd` and a 12-hour form. 42 signatures on DEV carry a stored text such as `11-Aug-2026 13:11:40 (UTC+7)`.
- Placeholder date format: an admin could choose `dd-MMM-yyyy`, `yyyy-MM-dd`, `MMM dd, yyyy` per DATE placeholder of a publishing template; a date that was not a `LocalDate` fell back to `toString()` (ISO) in the placeholder value.
- System Configuration and My Preferences let an administrator or a user choose `MM/DD/YYYY`, `YYYY-MM-DD`, `DD-MMM-YYYY` and others; the front end followed the choice and joined date and time with a comma.
- About 35 screens formatted a date with the browser (`toLocaleString()`, `toLocaleDateString()`), which gives `MM/DD/YYYY` and 12 hours on an English browser.
- Training PDFs (personal training record APD.0014, training requirement APD.0118, completion matrix, paper and exam packs) printed ISO dates and `LocalDateTime.toString()` (`2026-10-23T14:00:05`).
- Audit comments, in-app notifications and e-mails were built with `toString()` of dates (`2026-10-23`, `2026-10-23T07:00:00Z`).

## Change
- One place per side: `DateTimeFormatUtils` (back end) and `utils/format.ts` (`displayDate`, `displayDateTime`, `displayTime`). Zone of the site `Asia/Ho_Chi_Minh` in the back end utility; `display()` and `normalizeText()` turn any date, moment or ISO text into the display format.
- Safety net at the choke points: the comment of every audit record, the title and message of every notification and the variables of every e-mail template pass through `normalizeText`, so an ISO date written by any code reaches a person as `dd/MM/yyyy`.
- Electronic signature: the catalog has one pattern `dd/MM/uuuu HH:mm:ss`; default and active setting changed by V640 (effective from the migration). The stored text of signatures already made is NOT changed.
- Placeholders: the date format of a DATE placeholder is removed (record field, service, editor, V640 removes the key from stored styles); the value is written by `DateTimeFormatUtils.display`.
- Settings: the date and time format of the system and of a user is fixed (server forces `DD/MM/YYYY HH:mm:ss` when storing and when answering; CHECK constraints on `user_localization_preferences` and `electronic_signature_settings`; both screens show it read-only).
- Front end: every `toLocale*String` on a date replaced; the long and full variants of `formatDate` removed; date and time joined by one space.
- Training prints and exports use the utility.
- Guards: `DateFormatGuardTest` (back end) and `dateFormatGuard.test.ts` (front end) fail the build on another pattern, the browser formatting, ISO tricks, or a format choice on a screen.

## Not changed on purpose
- The wire format: JSON of the API and the database columns stay ISO-8601 / native types (machine to machine). A date shown to a person never takes that form.
- Names of downloaded files (`audit-trail-2026-10-23.csv`): ISO keeps them sortable.

## Time zone fixed (owner decision 2026-10-23, V641)
- One zone, `Asia/Ho_Chi_Minh` (`DateTimeFormatUtils.ZONE`, `SITE_TIME_ZONE` in the front end). It is not a setting of the system, of a user or of the electronic signature: the server forces it on store and on answer, V641 moved the stored values and added CHECK constraints (`user_localization_preferences.time_zone`, `electronic_signature_settings.signature_timezone`); the three screens show it read-only.
- Back end: every `ZoneId.systemDefault()` and `ZoneId.of("Asia/Ho_Chi_Minh")` (35 files) now uses the constant; the day boundaries of audit-trail review periods, time-limited access windows, user filters, expiry durations and the access-review dates, which were cut in UTC, are cut in the zone of the site (a window now starts at 00:00 of the site, 7 hours earlier than before; stored windows are not recomputed).
- `DateFormatGuardTest.theZoneIsAlwaysTheZoneOfTheSite` and the front end guard fail the build if code reads the zone of the machine, builds a zone or cuts a day in UTC. Exceptions named in the test: the renderer of old signatures (reads the zone written on the record) and the expiry of controlled copies saved in UTC.
- Moments stay absolute instants in the database; the zone written on signatures already made is not changed.

## Signatures already made (owner decision 2026-10-23)
- Every signature, old or new, is shown as `dd/MM/yyyy HH:mm:ss (UTC+7)`, computed from the recorded moment (`signed_at`) and the zone written on the record. The 42 signatures on DEV that carried `dd-MMM-uuuu` text are shown in the display format from now on.
- The stored text (`electronic_signatures.timestamp_display`, for example `11-Aug-2026 13:11:40 (UTC+7)`) is NOT modified or deleted: it stays in the database as evidence of what was shown when the signature was made, and is no longer read to show a signature. The moment, the signer, the meaning and the zone of the record are unchanged, so the instant shown is the same.
- Released DOCX/PDF files and stored previews are not regenerated: a document already published keeps the text printed in it. A document rendered or previewed from now on shows the new form.
- Test: `anOldSignatureWithAStoredTextIsShownInTheDisplayFormatFromItsMoment`.

## Other change of the same day: Custom Column drawer
- The locked "Expand" column of a table is no longer listed in the Custom Column drawer (it stays in the table).

## Evidence
- Back end: `DateTimeFormatUtilsTest` (7), `DateFormatGuardTest` (5), training and placeholder tests pass. Flyway V640 applied on DEV (signature setting and user preferences show the display format).
- Front end: `displayDates.test.ts`, `dateFormatGuard.test.ts`; tsc clean; full suite except the known `effectiveByType` failures.
- Not verified: a logged-in run (no DEVPW): a printed document, an e-signature on a new revision, a notification text, the two settings screens.
- Not audited: the content of exports other than the training PDFs (CSV and Excel produced by other modules), OnlyOffice document text, scheduled report files.
