# Change record: Force Publish when a Related Document is not ready (2026-11-03)

Decision: `FORCE-PUBLISH-RELATED-2026-11-03` in `docs/governance/DECISION_LOG.md`.

## Invariant affected
Actor with `documents.revision.publish` + lifecycle (READY_FOR_PUBLISHING) + parent/child package (Related Documents publish together)
+ single-use e-signature bound to the confirmed bundle + audit. The forced choice is part of the signed command, not a client flag at execution.

## Change
| Area | Change |
|---|---|
| Request | `PublishingWorkspaceRequest.forcePublishRelated` (stored in the command payload; the old 18-argument constructor remains) |
| Confirmation | `ConfirmedPublishAuthorization.forceRelated`; `capturePublishConfirmationBundle(revisionId, actor, forceRelated)` |
| Service | not-ready Related Documents refuse the publish unless the confirmation carries force; with force they are left out of the bundle and named in a `FORCE_PUBLISH_RELATED_NOT_READY` audit entry |
| Errors | `RELATED_DOCUMENTS_NOT_READY` now also from the confirmation step, with "number - name" and "Revision x · status" per document |
| API | `GET /revisions/{id}/publishing-workspace/related-blockers` (needs `documents.revision.publish`) |
| UI | Publishing Workspace: warning listing the documents, Cancel / Force Publish, e-signature step titled Force Publish |

## Evidence
- Unit tests: `RevisionBusinessRulesTest` (capture without force names the document and revision number; with force the bundle holds only the primary revision; the blockers list; the existing direct-publish block still throws), `PublishingCommandDatabaseTest` and `ConfirmedPublishSignatureTest` still compile and pass.
- Browser (DEV, Edge): with a temporary Related link to a Draft document, Publish showed the warning with "SPEC.0001 - Raw Material Specification / Revision 2.0.1 · Draft"; Force Publish opened the e-signature step titled Force Publish with the document listed. The temporary link was removed.
- Frontend: `tsc` clean.

## Not covered
Force Publish through to Effective in the browser, a race where a Related Document changes between signing and execution (the bundle comparison makes it stale; no dedicated test), the double-submit case (same row locks as before).
