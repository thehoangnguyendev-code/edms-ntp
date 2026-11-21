# Authorization coverage of every API endpoint — 2026-11-21

Status: **source-confirmed and runtime-confirmed on a copy of DEV; not a QA approval.**
Evidence folder: `evidence/authz_coverage_2026_11_21/` (scripts and both result sets).

## Method

1. `endpoints.py` read the 125 controllers and listed **1012 endpoints** (543 GET, 326 POST, 95 PUT,
   45 DELETE, 3 PATCH). Authorization is not declared with annotations; it is checked inside controllers
   and services, so a text search could not give a reliable answer.
2. `probe.py` called every endpoint (10 skipped: sign-in, sign-out, maintenance, health) as an **active
   user who holds no access profile and no permission**, with a zero id and an empty body, on a copy of the
   DEV database (isolated backend, rate limits raised). A guarded endpoint must answer 401/403.
   Write calls ran on the copy only.
3. Every endpoint that did **not** answer 403 was read by hand, and the suspicious ones were repeated
   with real ids and valid bodies.

## Result (1002 endpoints probed)

| Answer for a person with no permission | Before fixes | After fixes |
|---|---|---|
| 403 refused | 629 | **633** |
| 2xx accepted | 86 | 85 |
| 400 / 415 / 422 / 404 / 409 (rejected for the data before the permission is looked at) | 278 | 280 |
| 500 server error | 7 | **3** |
| 401 (`/auth/refresh`, no refresh cookie) | 1 | 1 |

## Findings

### Fixed (DEC-AUTHZ-2026-11-21-14 and -15, -16)

| # | Finding | Fix | Check |
|---|---|---|---|
| 1 | `GET /shared/{module}/{entityId}/signatures` gave **any signed-in person** the signer, e-mail, reason and comment of the signatures of any record whose id they knew (documents they cannot open, security changes, backup restores, Training). No screen uses it; the modules have their own endpoints that check the record. | Needs the Audit Trail view permission (`audit.view`). `SharedSignatureController` | Person with no permission: 200 → 403; admin 200. Unit test `SharedSignatureControllerTest` |
| 2 | Object Numbering (`GET/PUT/POST /object-numbering…`) answered **500** to a person without the permission: the refusal is a plain `SecurityException` that nothing mapped. | Own handler, 403 `OBJECT_NUMBER_SCOPE_DENIED` (`ObjectNumberAccessExceptionHandler`, same pattern as reports) | 500 → 403; admin 200. Unit test |
| 3 | An unknown Access Profile id answered 500 (`NoSuchElementException`). | The four lookup helpers of `AccessProfileService` throw `EntityNotFoundException` (404) | 500 → 404 |

### Checked and fine

- **`PUT /settings/system`** accepted an empty change from a person with no permission (200) because an
  empty change touches no page. A real change to each page (general, security, documents, notifications,
  integrations, features) is refused 403 for that person; nothing changed in the database.
  (Observed: a change with an invalid value gets 400 before the 403; no data is written.)
- **Document, Revision, Controlled Copy lists** answer 200 to that person but show only the records they
  may see (1870 documents of 11782; 1786 of 8855 revisions; 446 of 3387 copies). The detail of a record
  they cannot see is 403, and so is its revision list.
- Security module: access profiles, permission sets, SoD rules, access explorer, resource lookup,
  knowledge-share explain, workflow roles list/read, access review and audit review lists: 403.
  A signed write needs both the permission and the signature (earlier suite 25/25).

### Open by design, for QA to confirm (not changed)

Reachable by any signed-in person; each is a lookup that other screens need:

- **User directories:** `GET /security/eligible-users?permissionCode=…` (name, employee code, e-mail,
  department of everyone who holds a permission) and `GET /metadata/users` (+ `/paged`, 714 users on the
  copy). Used by the document creation and participant pickers. Any signed-in person can learn who holds
  a given permission and their e-mail. **Decision (DEC-AUTHZ-2026-11-21-17):** kept open for the pickers.
- **Reference data:** dictionaries (departments, positions, business units, languages, retention
  policies), education lookups, document types/sub-types/name formats/components, placeholder fields,
  filters, workflow steps, knowledge-portal lookups, training number mode, SoD list options,
  report workflow shape.
- **`GET /system/dependencies`** shows the health of three infrastructure dependencies to everyone.
- **`GET /configurations/security`** returns only the session timeout (needed by the client).
- Own-account endpoints (`/auth/me…`, sessions, notifications, table preferences, announcements,
  capabilities, navigation) and public ones (branding, localization, environment): as intended.

### Not conclusive (278 endpoints answered 400/404/415/422 before any permission check)

They need a valid body or a real record to reach the check, so the zero-id call proves nothing. They are
grouped by controller in `probe_after_fixes.json`. The large groups (Controlled Copy 38, Revision 27,
Document 24, Settings 15, Knowledge Sharing 13) are covered by record-level access checks in the services,
confirmed for the detail, revisions list and signatures of a hidden document. They were **not** each
exercised with a real record and a valid body. Writes of the Security module (access review decision and
cancel, audit review, separation rule update, workflow-role catalog) answer the same 400/422 for an
administrator, so a valid-body test with a real campaign is still to do.

### Left as is (robustness, no exposure)

`GET /training/matrix-versions/{unknown}/export`, `POST /reports/runs/{unknown}/retry`,
`POST /reports/templates/{x}/preview-file` answer 500 for an id that does not exist (the not-found is
raised as a `SecurityException` inside a transaction, and the rollback hides it). A real id works. Not
changed because the area belongs to Training and Reports and the answer exposes nothing.

## Limits

- One user with no permission was probed, plus the administrator for comparison. Users with a narrow
  profile (for example Training only calling a Document Control write) were not probed one by one.
- The run was on a copy of DEV on 2026-11-21, not on a production-like installation.
