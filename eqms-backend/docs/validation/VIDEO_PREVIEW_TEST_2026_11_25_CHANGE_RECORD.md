# Video preview test isolation — 2026-11-25

Status: completed test maintenance; not a QA release approval.
Request: fix the video preview test without changing business logic.

## Confirmed cause

The isolated PageBackgroundEditor test reproduced 4 passes and 1 failure. Its
one-shot `api.get` stub returned the video Blob to whichever GET happened first.
The pending button's shared loading indicator read `/branding` before the request
to `/settings/system/auth-background-video/{id}`. A diagnostic run recorded those
two paths in that order. The video request therefore did not receive the intended
fixture and no object URL/preview was rendered. Diagnostic logging was removed.

## Change and invariants

Only `PageBackgroundEditor.test.tsx` is changed. GET responses are now selected by
endpoint: Branding receives branding data and the exact video endpoint receives
the video Blob. No real GET is allowed by this test fixture.

The URL mock subclasses the original URL constructor instead of mutating it.
Cleanup unmounts components before restoring spies and global stubs, even after a
failed assertion. The production component, API client/server, upload constraints,
processing, repeat defaults, persisted configuration, permissions and audit remain
untouched.

Assertions retain the real UI label and check the FormData/file, upload endpoint
and timeout, Blob request, preview source, default repeat and both repeat changes,
exactly one upload/video fetch, and object-URL revocation on unmount. A negative
case checks that server refusal leaves the draft unchanged, shows the existing
15-second-limit error and leaves upload available, without a preview.

## Verification

- PageBackgroundEditor: 6/6 passed (the original five plus server-refusal coverage).
- Related regression: 50/50 passed across the editor, General tabs, Loading
  settings/indicators/Branding invalidation and page background styles.
- TypeScript (`tsc --noEmit --pretty false --incremental`) passed.
- Diff whitespace check passed. No production build/redeploy was needed for a
  test-only change; no commit or push was requested.
- GitNexus impact lookup could not resolve the test module/callbacks. Manual scope
  review confirms no production caller or exported function was changed. The
  workspace-wide compare report also contains unrelated work.

Evidence: `%TEMP%/eqms-video-preview-test-20261125/` (`before.log`, `diagnostic.log`,
`after.log`, `related-final.json`, `tsc-final.log`, `detect-changes.log`).
