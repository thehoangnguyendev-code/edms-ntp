# API review: security, reliability, performance — 2026-11-21

Status: **source-confirmed and runtime-confirmed on a copy of DEV; not a penetration test and not a QA approval.**
Companion of `AUTHORIZATION_ENDPOINT_COVERAGE_2026_11_21.md` (who may call what). Scripts and results:
`evidence/authz_coverage_2026_11_21/`.

## Scope and method

- Source scan of the backend for injection, command execution, XML, deserialization, outbound requests,
  secrets and configuration.
- Live checks against an isolated backend on a copy of DEV: headers, cookies, CORS, forged tokens,
  error bodies, login behaviour, object-level access (IDOR), documentation/actuator endpoints.
- Timing and size of all 309 GET endpoints that need no id, as the administrator, on real data
  (6,181 users, 11,782 documents).
- All warnings and errors of five backend runs (about 4,000 requests) classified.

## What was checked and is fine

| Area | Result |
|---|---|
| **SQL injection** | 91 places build SQL by concatenation; every concatenated sort column, direction, table or projection comes from a `switch` or a fixed map (white list) and values go through `?` parameters. No injectable place found. |
| **Command execution** | One `ProcessBuilder` (video transcoding), no request value in the command. |
| **XML (XXE)** | The report Word importer and the revision upload validator disable DOCTYPE, external entities and external DTD/schema. |
| **Deserialization** | No `ObjectInputStream`, no default typing. |
| **SSRF** | The OnlyOffice save callback rewrites the host to the configured document server (only path and query come from the callback). The other outbound calls use configured URLs. The SMTP/storage connection tests take a host from an administrator (permission needed). |
| **Tokens** | `alg=none`, tampered signature, tampered payload, garbage and no token: all 401. |
| **Headers** | `nosniff`, `X-Frame-Options: DENY`, CSP `default-src 'none'`, `no-store`, `no-referrer`; no `Server`/`X-Powered-By`. |
| **Cookies** | `HttpOnly`, `SameSite=Lax`. |
| **CORS** | A foreign origin gets no `Access-Control-Allow-Origin`; the preflight is refused. |
| **Error bodies** | Bad JSON, wrong types, a huge page size: no stack trace, class name or SQL in the answer. |
| **Documentation endpoints** | No Swagger/OpenAPI, H2 console, `env`, `heapdump`. |
| **Production secrets** | `StrictSecretConfigurationValidator` refuses the built-in JWT secret outside development. |
| **Object-level access (IDOR)** | 34 GET patterns of documents, revisions and controlled copies were called with ids of records a person with no permission may not see: 33 answered 403/404 for every id. The one that answered 200 (`/documents/{id}/number-state`) returns only a UI hint (`manual`, `editable`), not record data. |

## Fixed in this pass

| # | Finding | Fix | Evidence |
|---|---|---|---|
| 1 | **`GET /security/sod-constraints/violations` took 18.7 s** (and the impact preview 1.3 s): one query per active user to read the user's profiles (N+1; 6,000 users). | One read of all assignments, shared by `scanViolations` and `previewImpact` (`SodConstraintService`). | 18.7 s -> 0.5 s, same 10 KB answer; `SodConstraintServiceScanViolationsTest` (new test: assignments read once) |
| 2 | **An error on an export or event stream could not be written**: the stream/xlsx content type was already set, so the JSON error body failed with `HttpMessageNotWritableException` and the client got an empty answer. | `handleUnexpected` sets JSON explicitly (`GlobalExceptionHandler`). | Runtime: export failure now answers 500 `application/json` with the error body; `GlobalExceptionHandlerErrorBodyTest` |
| 3 | **Every closed event stream (tab closed) was logged as an unhandled ERROR with a stack trace** (20 of 36 "Unhandled exception" entries). | Handler for `AsyncRequestNotUsableException` (debug log, no answer). | Runtime: stream opened and dropped, no ERROR |
| 4 | **Metrics were silently lost for most endpoints**: Spring keeps only 100 `uri` tags; the API has about 1,000 endpoints ("Reached the maximum number of 'uri' tags"). | `management.metrics.web.server.max-uri-tags=1500` (environment variable `APP_METRICS_MAX_URI_TAGS`). | Warning 3 -> 0 over the same probe |

Earlier today (same sweep, already committed): signature lookup needs `audit.view`, Object Numbering 403,
unknown Access Profile 404.

## Decided by the owner and done (DEC-AUTHZ-2026-11-21-19)

- **A** keep the messages, equalise the time: gap 100 ms -> 25 ms (not removed).
- **B** `/api/actuator/**` needs `settings.system_info.view` (403 / 200 / 403 for no permission / administrator / anonymous).
- **C** the session list shows only usable sessions, at most 100 (4,057 rows -> 2); ended sessions untouched.
- **G** deleting the fake users was chosen but **not done**: they own 1,870 documents, 1,722 signatures and 6,232 audit rows (DEC-AUTHZ-2026-11-21-20).

## Still open (not changed)

| # | Finding | Why it matters | Options |
|---|---|---|---|
| A | **Sign-in tells whether an account exists** and how many attempts remain: "Password is incorrect. You have 4 login attempts remaining" versus "Username or email not found"; 112 ms versus 9 ms. | Account enumeration. The 5-attempt rate limit does not stop it. The screen may rely on the messages. | One generic message and equal timing (the lockout still protects the account); or keep for usability and record the risk. |
| B | **`/api/actuator/metrics` is readable by any signed-in person** (JVM, pool, request statistics). | Information about the server and traffic to every user. Nothing in the repository reads it. | Restrict to an administrative permission or the monitoring network, or switch the endpoint off. |
| C | **No retention for `auth_sessions`**: 8,820 rows on DEV, 8,369 ended or expired, and `GET /auth/sessions` returns all of them with no paging (623 KB for one user with 4,057 rows on the copy). | Unbounded growth and slower sign-in screens. Session rows may be evidence (21 CFR 11), so deleting is a retention decision. | List only live sessions with paging; archive or purge ended sessions after a period the owner sets. |
| D | **Unpaged lists** sent whole: `/settings/users/manager-options` (6,181 users, 971 KB), `/metadata/users` (725), `/settings/education/schools` (440, 536 KB), `/settings/storage-usage`, `/documents/administration/document-sub-types`. | Heavy answers as the data grows; the pickers need server-side search (the project rule). | Search-as-you-type with a page size. |
| E | **`GET /system/dependencies` takes 2.8 s** (it probes ClamAV, OnlyOffice and the chart renderer on every call, timeouts of 3 s) and is open to every signed-in person. | Slow page and a way to hold server threads. | Cache the result for some seconds; restrict to administrators. |
| F | Unknown ids answer 500 in three Training/Reports endpoints (`matrix-versions/{id}/export`, `runs/{id}/retry`, `templates/{code}/preview-file` NPE). | Robustness only; a real id works. | Return 404. |
| G | **Test data in DEV**: about 6,000 suspended `baseline.noperm.*` users (load-test fixtures) make user lists large and the SoD scan slow. | Not a product defect; it distorts every measurement on DEV. | Remove them from DEV after the owner agrees. |
| H | Signed links (OnlyOffice, training files) carry the token in the query string, so it can reach access logs. | Short-lived signed tokens, only for files; low risk. | Keep, or move to a header where the client allows. |
| I | `HSTS` is not sent by the API and cookies are not `Secure` by default (`APP_SECURITY_COOKIES_SECURE=false`). | Correct only behind a TLS proxy that sets both. | Confirm for production that the proxy adds HSTS and the variable is `true`. |
| J | Not tested: file upload abuse (zip bombs, oversize), concurrent edit conflicts across modules, dependency vulnerabilities (no scanner available offline), the production proxy. | Outside what could be run here. | Dependency scan in CI; upload tests with the antivirus service up. |

## Limits

One run on a copy of DEV on 2026-11-21; zero-id and empty-body calls cannot prove the behaviour of
endpoints that need a real record and a valid body. Noise from the isolated setup (Redis, backup agent,
maintenance control database unreachable) was left out of the findings.
