# Mandatory electronic-signature credentials — 2026-10-01

## Decision and scope

The user explicitly approved requiring entry of username AND password for every electronic signature, system-wide, including configuration, training, and authorization operations (confirmation: “Đúng vậy”). This is the requested application policy, not a claim that Annex 11 mandates re-entry of both components at every signing.

References inspected: [EU-GMP Annex 11 (2011), section 14](https://health.ec.europa.eu/system/files/2016-11/annex11_01-2011_en_0.pdf) and [21 CFR 11.200](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-C/section-11.200). Section 11.200 distinguishes the first signing from subsequent signings in a continuous period of controlled access. This change implements the stricter user-selected policy, not a system-wide compliance certification.

The referenced system evidence conventions, audit/e-signature assurance document, governance Decision Log, and one-change record template are absent from this checkout. This record documents the user decision and source/test evidence; formal QA approval and validation release remain separate.

## As-Is findings and implemented requirements

- Shared ESignatureModal only sent password; authApi declared username optional; VerifySignatureRequest did not validate username. AuthService only checked username against the current actor when one was supplied.
- The modal now starts with an empty, editable Username field and requires both credentials for each request. No defaulting to the session username. Both fields clear on close and successful confirmation. Existing reason validation and confirmation/token callback contract are preserved. The displayed signer identity remains the signed-in user; callback username comes from the verified server response.
- API adapter requires username. The existing POST `/auth/verify-signature` controller's `@Valid` now rejects omitted/null/empty/whitespace username or password with the existing HTTP 422 validation response. Older password-only clients must update; no silent backward-compatible bypass remains.
- AuthService also rejects missing credentials when called directly and refuses a different username before checking password or issuing a token. Existing username trim/case-insensitive comparison is preserved. Password is not trimmed or persisted. No signing-account switch or user lookup based on the submitted name is introduced.
- Existing security audit success/failure events remain. `verifySignature` now uses `noRollbackFor=UnauthorizedException` so authentication failure does not roll back its security audit. This applies only to credential verification, not the later signed business transaction. Mandatory business signature/audit/token consumption paths are unchanged.
- Removed the modal's unsupported “Compliant” certification tagline; replaced it with a neutral identity-confirmation instruction.

## Invariants and affected layers

- Actor/permission/object scope: signer is always the authenticated current actor. No privilege change; existing action-specific authorization and scoped endpoint checks remain server-owned.
- Lifecycle/parent-child/artefact/checksum/async: no changes to document/revision/copy state transitions, file generation or storage, parent-child effects, or workers.
- Token/signature/audit: only valid credentials issue an existing short-lived current-user token. Existing expiry/single-use consumption and action-signature linkage remain unchanged. No username/password DB columns, configuration toggle, migration, or stored credentials added.
- Auth API interceptor already excludes `/auth/verify-signature` from expired-session retry/redirect handling; credential rejection remains a signing error rather than an intentional session change.

## Impact analysis

- GitNexus ESignatureModal: CRITICAL, 46 direct callers, 91 impacted symbols, 27 affected processes. User informed and approved system-wide scope before editing.
- handleSubmit and authApi.verifyESignature: LOW, 0 indexed direct callers/processes. AuthService.verifySignature: LOW, 1 direct caller, 0 indexed processes. VerifySignatureRequest is not resolved by this index; the record/controller validation binding was traced in source.
- Post-change detect-changes: 5 tracked files / 10 symbols / 20 affected processes, CRITICAL. Includes an unrelated existing RequestUncontrolledCopyModal edit; that edit was preserved and not included in this task's source changes. No commit/push performed.

## Test evidence

- Full frontend suite: 20 files, 142 tests passed. Six new modal cases verify missing/whitespace username and missing password, empty initial username, request payload, verified identity/token callback, server user-mismatch rejection, and clearing credentials between signing requests.
- TypeScript `tsc --noEmit --pretty false`: passed. Scoped `git diff --check`: passed.
- AuthSignatureCredentialsTest: 11 passed, covering missing/blank username/password, actor mismatch, wrong password, no token on failures, successful actor binding and normalization, and Spring transaction proxy commit-vs-rollback on credential rejection.
- AuthSignatureContractTest: 1 passed with 6 invalid HTTP payloads, all HTTP 422 and no verification service invocation.
- Focused backend regression run: 21/21 passed across AuthSignatureCredentialsTest (11), AuthSignatureContractTest (1), SecurityChangeSignatureServiceTest (6), and SignatureTokenConsumptionServiceTest (3).
- Transaction test uses a recording transaction manager and mocked audit writer. It verifies Spring rollback rules, not durable persistence in a runtime database.

## Remaining verification / rollout

No runtime DB audit persistence test, live browser acceptance, full backend suite, or Docker deployment performed. Deploy frontend and backend together because password-only verification requests are intentionally rejected. QA should exercise representative document approval, copy operations, configuration, training, and authorization signing workflows before validated release. This record is not a compliance certification.
