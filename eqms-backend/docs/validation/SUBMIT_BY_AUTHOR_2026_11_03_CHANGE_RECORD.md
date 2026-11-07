# Change record: Complete Editing retired, the Author submits for review (2026-11-03)

Decision: `SUBMIT-BY-AUTHOR-2026-11-03` in `docs/governance/DECISION_LOG.md`.

## Invariant affected
Actor (Author, as policy data) + permission `documents.revision.submit_review` + lifecycle (Draft only) + source locked in the
same transaction as the SUBMITTED_FOR_REVIEW e-signature, the audit and the status change + review snapshot/async as before.

## Change
| Area | Change |
|---|---|
| Migration | `V730`: grants submit_review to every permission set that held complete_authoring; SUBMIT_FOR_REVIEW actor = AUTHOR; deletes the COMPLETE_AUTHORING policy, the permission, its links and dependencies |
| Service | `RevisionService.submitForReview` locks the source, needs the source file, no PREPARED signature; `completeEditing` removed |
| Authorization | `RevisionWorkflowAuthorizationService`: Submit only needs Draft; `RevisionWorkflowAction.COMPLETE_AUTHORING` removed |
| API | `POST /revisions/{id}/complete-editing` removed; `/submit-review` flushes OnlyOffice first; capability `completeAuthoring` and `canCompleteEditing` removed |
| Publishing | no PREPARED gate at Publish; `{{preparedSignature}}` falls back to the SUBMITTED_FOR_REVIEW signature (preview validation too) |
| UI | Complete Editing button/modal/handler removed from the revision screen; Submit for Review needs a source file |

## Evidence
- Unit tests (all pass): `OptionalReviewWorkflowTest` (submit locks the source, needs no PREPARED, refused without a source file and locks nothing), `RevisionWorkflowStatePreconditionTest` (open source allowed, locked legacy Draft allowed, not Draft denied), `WorkflowActionPolicyServiceTest`, `WorkspaceManagedRevisionPolicyTest` (default actor AUTHOR), `CalendarTaskProjectionServiceTest`, `NotificationHandoverTest`, `RevisionActionCapabilityServiceTest`, `RevisionBusinessRulesTest`.
- Frontend: `tsc` clean, vitest 1264 of 1264.
- Not covered by an automated test: V730 against a populated database (checked by running it on DEV, see the decision log), Publish with a SUBMITTED_FOR_REVIEW-only revision through the browser, concurrent double submit (the row lock `requireRevisionForUpdate` is the same as before).

## Risk left
Existing Drafts locked by the old step stay submittable. A person who can submit but whose Access Profile lost the Author actor can no longer submit until the policy is changed; this is the intended configuration switch.
