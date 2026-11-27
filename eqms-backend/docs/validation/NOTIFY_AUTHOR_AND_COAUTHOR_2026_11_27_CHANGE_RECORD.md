# Change record: notify the Author of a new document and the Co-Authors of a new file

Date 2026-11-27. Decision `DEC-DOC-2026-11-27-05`. Cause of the report: `SOP.10489` (new document) raised no notification, because only the upgrade of an Active document had one (`document.upgrade_ready`).
Built, tried on an isolated copy of DEV, deployed to the DEV backend. Not committed. Not a GMP approval.

## Change

- Events `document.author_assigned` and `document.coauthor_edit_ready` in the notification catalogue (policy, English wording, supplied Vietnamese wording, default channels in-app and e-mail).
- Migration V879: `documents.author_upload_notified_user_id` (which Author was told), additive.
- `DocumentService.createDocumentDraft` / `updateDocumentDraft`; `RevisionService.uploadRevisionFile`, `createRevisionAndUploadFile`, `useEffectiveSourceForRevision`. A failed notification never undoes the save or upload. Legacy import sends neither.

## Impact (before editing)

LOW: `createDocumentDraft`, `updateDocumentDraft`, `describeWhyDocumentWorkflowParticipantsAreMissing`, `createRevisionAndUploadFile`, `uploadRevisionFile`. `detect_changes` not run: nothing committed.

## Verification

- Backend: 167 selected tests, 0 failures, 7 skipped (includes the guard that every registered event has a sender).
- Isolated stack: Author notice 8/8 (no repeat, nothing without Approver, Vietnamese account, e-mail subject) and `SOP.10489` saved from the browser; Co-Author notice 9/9 (both Co-Authors, not the Author, no repeat on replacement, Co-Author may edit); Co-Author screen shows Edit File Online. Evidence `evidence/author_assigned_2026_11_27/`.
- DEV: V879 applied, both events active with two Vietnamese rows each, backend healthy. Not signed in on DEV.

## Not done

- Drafts that were already complete (including `SOP.10489`) are told only at their next save.
- A Co-Author added after the file was uploaded is not told.
- DEV e-mail goes to Mailhog.

## Addition: rejection notices (DEC-DOC-2026-11-27-06)

- `RevisionService.rejectionRecipients` / `sendRevisionNotification`, `EmailNotificationService.sendDocumentWorkflowEvent`, `NotificationRecipientRules` (CO_AUTHOR), V880. Impact before editing: LOW.
- The old templates "Revision Review Rejected" and "Revision Approval Rejected" are no longer sent; the wording of Notification Administration is. Switching the policy off now stops the notice entirely. The e-mail audit entry of the old sender is no longer written for rejections; delivery is in the notification outbox.
- Verification: backend 166 selected tests (0 failures, 7 skipped), frontend documents and notifications 321 passed, isolated stack 11/11 (review and approval rejection: Author and two Co-Authors, in-app and one e-mail each). DEV: V880 applied, backend and frontend rebuilt; not signed in there.
- Seen, not changed: review and approval requests still arrive twice per person.
