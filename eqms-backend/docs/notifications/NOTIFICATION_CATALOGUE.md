# Notification Catalogue (working specification)

Status: **working draft, built from the system itself, 2026-11-12.** Owner decision: no approval step for this catalogue; it is the specification the work follows and it is
corrected as the system changes. It is **As-Is source evidence plus a gap analysis**; the gaps are candidates until the owner of the module confirms the trigger.

Decisions that apply to every row (Decision Log `NOTIFICATION-ADMIN-2026-11-12`, D5 to D7): a notification is **always sent** (no mandatory / optional kind, no opt-out), changing one needs **no
signature** (only an administrator edits), and every change is **written to the Audit Trail** with the value before and after.

## 1. How it was built (evidence)

| Source | What it gave |
|---|---|
| Notification registry (`notification_event_definitions`, `notification_policies`), read through the API | the 32 registered events: module, priority, channels, recipient rules, placeholders |
| Email messages (`email_templates`) | the 24 messages the workflows send, by type, with how often each was sent |
| What the DEV system actually emitted (`user_notifications`, `notification_email_outbox`) | every notification type in use, with counts: it shows what the registry does **not** know |
| The Audit Trail of DEV (`audit_logs`, 100+ entity types and actions) | the business actions the system performs; an action that changes someone's duties and has no notification is a gap |
| Code scan of the senders | `TrainingNotifier`, `ReportDeliveryService`, `BackupAlertDeliveryScheduler`, `StorageUsageAlertService`, `MaintenanceAdminAlerts`, `WorkflowReminderScheduler`, the controlled-copy and revision services |

## 2. What was found

1. **Three mechanisms send notifications, and only one of them is administered.**
   - *The registry* (`NotificationDispatcher.dispatch(eventCode, ...)`): 32 events, 5 modules. This is what Notifications Administration edits.
   - *Email messages* (`email_templates`, `EmailNotificationService`): 24 messages. They are the older path of Document Control and Controlled Copies; the same business moment can have both a registry event and an email message (for example a controlled copy distribution), with different wording.
   - *Direct senders*: Training Management (36 kinds seen on DEV, about 30 events in code, its own log), Report schedules, Backup & Restore alerts, storage and maintenance alerts, review comments, preferences. They create the in-app notification or the e-mail themselves, with wording written in code, so **none of them can be edited by the administrator**.
2. **On DEV the system emitted 72 distinct notification types in the application (36 of them Training); the registry knows 32 event codes in all, of which 16 appear among those emitted.** The rest are the direct senders and the older message types (`document-ready-for-publishing`, `controlled-copy-obsoleted-notification`, `training-step-assigned`, ...).
3. **Four modules of the menu have no registered event at all:** Training Management, Reports & Analytics, Backup & Restore, Calendar. Training is the busiest sender in the system (6,889 notices on DEV, 36 kinds) and is entirely outside the registry.
4. **The recipient rules of the registry are decorative.** `OWNER`, `AUTHOR`, `REVIEWER`, `APPROVER`, `ASSIGNEE`, `RECIPIENT`, `AFFECTED_USERS` all mean the same thing to the dispatcher: *the people the caller passed in*. Only `ALL_USERS` and `PERMISSION:<code>` select people by themselves. So the screen shows "author, owner" but the author is whoever the module code chose.
5. **Names are not consistent.** Module keys: `SECURITY` / `Security`, `DOCUMENT_CONTROL` / `Document Control` / `Document`, `Controlled Copies` / `Controlled Copy` / `CONTROLLED_COPIES`. Type codes: dotted (`document.approved`), kebab (`document-approval`), upper case (`BACKUP_MAINTENANCE_DRAINED`), lower snake (`backup_alert`).
6. **Placeholders** were defined by whatever each sender happened to put in its map. They are now gathered in `NotificationPlaceholderCatalog` (119 placeholders in 13 groups) and a test keeps every placeholder of every event and message inside it.

## 3. Inventory

### 3.1 Registered events (32), by module


**Audit Trail** (2)

| Code | Name | Priority | Channels | Recipient rules | Placeholders |
|---|---|---|---|---|---|
| `audit_trail.export_completed` | Audit Trail Export Completed | LOW | IN_APP | OWNER | 6 |
| `audit_trail.review_campaign_assigned` | Audit Trail Review Campaign Assigned | MEDIUM | IN_APP | ASSIGNEE | 7 |

**Controlled Copies** (4)

| Code | Name | Priority | Channels | Recipient rules | Placeholders |
|---|---|---|---|---|---|
| `controlled_copy.destroyed` | Controlled Copy Destroyed | MEDIUM | IN_APP | RECIPIENT, OWNER | 7 |
| `controlled_copy.distributed` | Controlled Copy Distributed | HIGH | IN_APP | RECIPIENT | 8 |
| `controlled_copy.expiring_soon` | Controlled Copy Expiring Soon | MEDIUM | IN_APP | RECIPIENT | 8 |
| `controlled_copy.recalled` | Controlled Copy Recalled | CRITICAL | IN_APP | RECIPIENT | 8 |

**Document Control** (16)

| Code | Name | Priority | Channels | Recipient rules | Placeholders |
|---|---|---|---|---|---|
| `eform.signer_turn` | eForm Signer Turn | MEDIUM | IN_APP, EMAIL | RECIPIENT | 4 |
| `document.approval_rejected` | Document Approval Rejected | HIGH | IN_APP | AUTHOR, REVIEWER | 8 |
| `document.approved` | Document Approved | HIGH | IN_APP | AUTHOR, OWNER | 6 |
| `document.expired` | Document Expired | HIGH | IN_APP, EMAIL |  | 6 |
| `document.expired_copy_holder` | Document Expired (Copy Holder) | HIGH | IN_APP, EMAIL |  | 6 |
| `document.obsoleted` | Document Obsoleted | HIGH | IN_APP | AUTHOR, OWNER | 6 |
| `document.periodic_review_due` | Document Periodic Review Due | MEDIUM | IN_APP | OWNER, AFFECTED_USERS | 6 |
| `document.published` | Document Published (Effective) | HIGH | IN_APP | AUTHOR, REVIEWER, APPROVER | 6 |
| `document.upgrade_ready` | Document Ready for Upgrade | HIGH | IN_APP | AUTHOR | 6 |
| `document.review_completed` | Document Review Completed | MEDIUM | IN_APP | AUTHOR, APPROVER | 6 |
| `document.review_rejected` | Document Review Rejected | HIGH | IN_APP | AUTHOR, REVIEWER | 8 |
| `document.submitted_for_review` | Document Submitted for Review | MEDIUM | IN_APP | REVIEWER | 6 |
| `knowledge.document_published` | Knowledge Document Published | LOW | IN_APP | RECIPIENT | 7 |
| `document.action_escalated` | Pending Review/Approval Escalation | HIGH | IN_APP | RECIPIENT | 9 |
| `document.action_reminder` | Pending Review/Approval Reminder | MEDIUM | IN_APP | RECIPIENT | 8 |
| `document.participant_unavailable` | Workflow Assignee Unavailable | HIGH | IN_APP | RECIPIENT | 8 |

**Security** (8)

| Code | Name | Priority | Channels | Recipient rules | Placeholders |
|---|---|---|---|---|---|
| `security.access_profile_changed` | Access Profile Changed | MEDIUM | IN_APP | OWNER | 6 |
| `access_review.campaign_due` | Access Review Campaign Due | MEDIUM | IN_APP | OWNER | 3 |
| `security.account_locked` | Account Locked | HIGH | IN_APP | OWNER | 6 |
| `security.mfa_updated` | MFA Settings Updated | MEDIUM | IN_APP | OWNER | 6 |
| `security.password_changed` | Password Changed | MEDIUM | IN_APP | OWNER | 6 |
| `user.time_limited_access_expired` | Time-Limited User Access Expired | MEDIUM | IN_APP | OWNER | 6 |
| `user.account_suspended` | User Account Suspended | HIGH | IN_APP | AFFECTED_USERS | 4 |
| `user.account_terminated` | User Account Terminated | HIGH | IN_APP | AFFECTED_USERS | 4 |

**System** (2)

| Code | Name | Priority | Channels | Recipient rules | Placeholders |
|---|---|---|---|---|---|
| `system.preference_updated` | Notification Preference Updated | LOW | IN_APP | OWNER | 6 |
| `system.maintenance_scheduled` | System Maintenance Scheduled | MEDIUM | IN_APP | ALL_USERS | 6 |

### 3.2 Email messages (24)

| Type | Name | Sent (DEV) | Status |
|---|---|---|---|
| `account-unlocked` | Account Unlocked - Temporary Password | 1 | ACTIVE |
| `controlled-copy-batch-distribution-dco-zip` | Controlled Copy Batch Distributed (DCO ZIP) | 0 | ACTIVE |
| `controlled-copy-cancellation-notification` | Controlled Copy Cancellation Notification | 51 | ACTIVE |
| `controlled-copy-distribution-no-access` | Controlled Copy Distributed (No Direct Access) | 64 | ACTIVE |
| `controlled-copy-distribution-notification` | Controlled Copy Distribution Notification | 104 | ACTIVE |
| `controlled-copy-expiry-notification` | Controlled Copy Expiry Notification | 0 | ACTIVE |
| `controlled-copy-notification` | Controlled Copy Notification | 79 | ACTIVE |
| `controlled-copy-obsoleted-notification` | Controlled Copy Obsoleted Notification | 139 | ACTIVE |
| `controlled-copy-recall-notification` | Controlled Copy Recall Notification | 18 | ACTIVE |
| `document-approval` | Document Approval Notification | 117 | ACTIVE |
| `document-edit-online-notification` | Document Office Online Edit Notification | 30 | ACTIVE |
| `document-publish` | Document Publish Notification | 81 | ACTIVE |
| `document-ready-for-publishing` | Document Ready for Publishing Notification | 535 | ACTIVE |
| `document-review` | Document Review Notification | 180 | ACTIVE |
| `knowledge-share-notification` | Knowledge Base Sharing by a Delegate | 0 | ACTIVE |
| `password-reset` | MFA OTP Login Code | 26 | ACTIVE |
| `password-reset` | Password Reset Link | 0 | ACTIVE |
| `preference-notification` | Preference Change Notification | 135 | ACTIVE |
| `document-approval-rejected` | Revision Approval Rejected | 0 | ACTIVE |
| `document-revision-cancelled` | Revision Cancelled | 2 | ACTIVE |
| `document-ready-for-submission` | Revision Ready for Submission | 84 | ACTIVE |
| `document-review-rejected` | Revision Review Rejected | 76 | ACTIVE |
| `training-notification` | Training Notification | 685 | ACTIVE |
| `uncontrolled-copy-distribution` | Uncontrolled Copy Distribution | 2 | ACTIVE |

Note: two messages share the type `password-reset`.

### 3.3 Notifications that bypass the registry (seen emitted on DEV or in code)

| Module | Kinds | Where |
|---|---|---|
| Training Management (36 seen on DEV) | `training-invited`, `training-step-assigned`, `training-step-waiting`, `training-step-ready`, `training-submitted-to-qa`, `training-qa-confirm-waiting`, `training-content-approved`, `training-attendance-sent`, `training-recorded`, `training-completed`, `training-returned`, `training-cancelled`, `training-postponed`, `training-job-waiting`, `training-job-accepted`, `training-requirement-approved`, `training-requirement-line-moved`, `training-legacy-imported`, `training-work-suspended`, `training-results-due-today`, `training-results-late`, `training-read-due-soon`, `training-read-reminder`, `training-overdue`, `training-due-soon`, `training-notification`; in code also `TRAINING_WORK_RESUMED`, `TRAINING_STEP_REASSIGNED`, `TRAINING_REVIEW_READY`, `TRAINING_REVIEW_OPEN_DUE`, `TRAINING_REVIEW_CLOSE_DUE`, `TRAINING_REQUIREMENT_DUE`, `TRAINING_PERIODIC_REQUIREMENT_DUE`, `TRAINING_MAKEUP_PENDING`, `TRAINING_IMPACT_WAITING`, `TRAINING_PREPARATION_ASSIGNED`, `TRAINING_QA_LIST_TODAY`, `TRAINING_QA_LIST_LATE` | `TrainingNotifier` (own log `training_notification_log`) |
| Document Control (older messages) | `document-ready-for-publishing`, `document-ready-for-submission`, `document-publish`, `document-review`, `document-edit-online-notification`, `document-approval`, `document-revision-cancelled`, `review-comment-added`, `review-comment-reply` | `EmailNotificationService`, `RevisionService` |
| Controlled Copies (older messages) | `controlled-copy-obsoleted-notification`, `controlled-copy-notification`, `controlled-copy-cancellation-notification`, `controlled-copy-distribution-notification`, `controlled-copy-recall-notification` | `ControlledCopyService`, `EmailNotificationService` |
| Reports & Analytics | `report-schedule-suspended` (the senders of "report ready" and "delivery failed" exist in `ReportDeliveryService`; none was emitted on DEV) | `ReportDeliveryService` |
| Backup & Restore | `backup_alert` (an alert of the Backup Agent: dump failed, copy failed, backup missed, capacity high, restore problem, ledger chain broken, DR kit overdue, manual copy overdue, ...), `BACKUP_MAINTENANCE_DRAINED` | `BackupAlertDeliveryScheduler`, `MaintenanceAdminAlerts` |
| System | `STORAGE_USAGE_WARNING`, `preference-notification`, `system` | `StorageUsageAlertService`, `EmailNotificationService` |

## 4. Gaps by module

A gap is a business action found in the Audit Trail (or a state that exists in the code) that changes somebody's duties or the compliance state and for which **no notification was found**. Priority: **H** = a person must act or be told to stay compliant, **M** = outcome the person expects, **L** = for information.

### 4.1 Document Control and revisions
| Gap | Evidence | Who | P |
|---|---|---|---|
| Revision cancelled / document reopened | Audit `CANCEL` (1,029), `REOPEN`; only the older e-mail `document-revision-cancelled` (2 sent) | author, co-authors, reviewers, approvers | H |
| Editing finished, ready to submit | Audit `COMPLETE_EDITING` (264); the older `document-ready-for-submission` exists but is not a registered event | author | M |
| Revision training completed | Audit `TRAINING_COMPLETE` (136) | author, publisher | M |
| Editing lock taken / released, edit-online link revoked | Audit `EDITING_LOCKED` (28), `SHAREPOINT_LINK_REVOKED` (28) | the person whose work is blocked | M |
| Review comment resolved / withdrawn / deleted | Audit `REVIEW_COMMENT_RESOLVED`, `_WITHDRAWN`, `_DELETED` (added and reply are notified) | the author of the comment and of the revision | L |
| Document legacy import finished | Audit `LEGACY_IMPORT_EFFECTIVE` (296), `LEGACY_BATCH_SUPERSEDED` (110) | importer, document controller | L |
| Publishing package failed | Audit `PUBLISHING_PACKAGE_QUEUED` (49), no failure notice found | publisher | H |
| Document number changed | Audit `DOCUMENT_NUMBER_CHANGED` | author, holders of controlled copies | M |
| Knowledge document featured / unfeatured | Audit `KNOWLEDGE_DOCUMENT_FEATURED` | author | L |

### 4.2 Controlled and Uncontrolled Copies
| Gap | Evidence | Who | P |
|---|---|---|---|
| Copy requested | Audit `REQUEST` (168 + 62 + 36 on batches); no notice to the approver found | document controller / approver | H |
| Request approved / refused | Audit `APPROVE`, `CANCEL` (older cancellation message only) | requester | M |
| Copy reported lost / damaged, replacement, re-issue | Audit `REPORT_LOST`, `REPORT_DAMAGED`, `REPLACE_LOST_DAMAGED`, `REISSUE_REQUESTED` | document controller, holder | H |
| Evidence uploaded for a recall or destruction | Audit `UPLOAD_EVIDENCE` | document controller | M |
| Distribution processing failed | Audit `DISTRIBUTE_PROCESSING_FAILED` (2) | requester, administrator | H |
| Copy overdue for return after a recall | no state or reminder found | holder, document controller | H |
| Uncontrolled copy expiring / revoked | `uncontrolled-copy-distribution` is sent once; no expiry or revocation notice | recipient, issuer | M |

### 4.3 Training Management
Training is richly covered but outside the registry (36 kinds seen on DEV). Gaps are about **governance**, not coverage:
| Gap | Evidence | P |
|---|---|---|
| Not one of the 30 kinds can be edited by the administrator (wording is in code); none has a placeholder contract, an icon or a recipient rule | `TrainingNotifier` | H |
| Approver designated | Audit `TRAINING_APPROVER_DESIGNATED` (1,413) — covered only if it is the same moment as `training-step-assigned`; to confirm | M |
| Training number cancelled, activity linked, number log exported | Audit `TRAINING_NUMBER_CANCELLED` (69), `TRAINING_ACTIVITY_LINKED` (73) | L |
| Assessment returned / approved / new version | Audit `TRAINING_ASSESSMENT_*` (`training-returned` exists for one case) | M |
| Form template activated / disabled | Audit `TRAINING_FORM_TEMPLATE_*` | L |

### 4.4 Backup & Restore
The Backup Agent raises alerts (covered by `backup_alert`), but the **approval workflows** have no notification at all.
| Gap | Evidence | Who | P |
|---|---|---|---|
| Restore requested / approved / rejected / cancelled / scheduled / window locked | Audit `RESTORE_REQUESTED` (36), `RESTORE_APPROVED` (11), `RESTORE_REJECTED` (12), `RESTORE_CANCELLED` (12), `RESTORE_SCHEDULED`, `RESTORE_WINDOW_LOCKED` | approver (on request), requester (on outcome) | H |
| Production restore requested / refused / finalized | Audit `PRODUCTION_RESTORE_REQUESTED` (7), `_REFUSED`, `_FINALIZED` | approver, all administrators | H |
| Backup export requested / approved / refused | Audit `BACKUP_EXPORT_*` | approver, requester | H |
| Inspection requested / approved | Audit `BACKUP_INSPECTION_*` | approver, requester | M |
| Backup policy proposed / activated / refused | Audit `BACKUP_POLICY_PROPOSED` (4), `_ACTIVATED` (4), `_ACTIVATION_REFUSED` (6) | approver, administrators | H |
| Restore rehearsal requested / result | Audit `RESTORE_REHEARSAL_REQUESTED` (8) | administrators | M |
| Store scrub started / mismatch, DR declaration | Audit `STORE_SCRUB_STARTED`; alert `STORE_SCRUB_MISMATCH` exists | administrators | M |

### 4.5 Reports & Analytics
| Gap | Evidence | Who | P |
|---|---|---|---|
| Report template submitted / approved / disabled | Audit `REPORT_TEMPLATE_SUBMITTED` (24), `_APPROVED` (24) | approver, author | H |
| Report run finished / failed | Audit `REPORT_RUN_QUEUED` (127); the sender exists but no notice was emitted on DEV | requester | M |
| Schedule paused / resumed / deleted | Audit `REPORT_SCHEDULE_PAUSED`; `report-schedule-suspended` is emitted (7) | schedule owner | M |
| Report type / property changed | Audit `REPORT_TYPE_DISABLED`, `REPORT_PROPERTIES_UPDATED` | administrators | L |

### 4.6 Security and Authorization, Access Review, Audit Trail Review
| Gap | Evidence | Who | P |
|---|---|---|---|
| Refresh token reuse detected (possible session theft) | Audit `REFRESH_TOKEN_REUSE_DETECTED` | the user, security administrators | H |
| Access profile / permission set / SoD / object access rule changed | Audit `ACCESS_PROFILE_*` (only `security.access_profile_changed` exists), `PERMISSION_SET_*`, `SOD_CONSTRAINT_*`, `OBJECT_ACCESS_RULE_*` (41 created) | affected users, security administrators | M |
| Access review campaign created / cancelled / completed / overdue | Audit `ACCESS_REVIEW_CAMPAIGN_CREATED`, `_CANCELLED`; only `access_review.campaign_due` is registered | reviewers, owner | H |
| Audit trail review campaign cancelled / completed | Audit `AUDIT_TRAIL_REVIEW_CAMPAIGN_CANCELLED`; only `review_campaign_assigned` exists | reviewers | M |
| Electronic signature settings changed | Audit `ELECTRONIC_SIGNATURE_SETTINGS_UPDATED` (7) | security administrators | M |
| Password reset requested / MFA code | e-mail messages exist (`password-reset`, 2 of that type) but not as registered events | the user | M |

### 4.7 System, settings, knowledge, calendar
| Gap | Evidence | Who | P |
|---|---|---|---|
| System configuration changed | Audit `SYSTEM_CONFIGURATION_UPDATED` (355) | administrators | M |
| Maintenance mode on / off | `system.maintenance_scheduled` exists; starting and ending a window are announcements, not notifications | all users | M |
| Storage retention blocked a deletion | Audit `DELETE_BLOCKED_BY_RETENTION` (2) | administrators | L |
| Knowledge share link created / revoked, delegate removed | `knowledge-share-notification` covers part | the person concerned | L |
| Calendar | no notification of any kind: no reminder of a review due, a training session, a campaign due date | the people invited | M |

## 5. Decisions and the foundation (what is built next)

| Need | Decision taken here | Built |
|---|---|---|
| One list of modules | A module is one of a fixed list; the stored value is the key (`DOCUMENT_CONTROL`), the screens show the label | `NotificationModule`, V768 normalises the registry |
| Recipients | A recipient rule is either **context** (the people the sender names, shown with the role it stands for) or an **audience** the dispatcher resolves itself: all users, a permission, a role, a department | `NotificationRecipientRules` catalogue with labels; `ROLE` and `DEPARTMENT` resolved by the dispatcher; the rules of a policy are checked against the catalogue; the Delivery block of Edit Notification shows the labels |
| Placeholders | A placeholder is declared once, with module, label and example; an event or message may use only declared ones | `NotificationPlaceholderCatalog` + a contract test over the registry seeds and the e-mail messages |
| The direct senders | Move into the registry one module at a time (Training first), keeping their log as a projection | not built: each needs its own change record |
| The gaps of section 4 | Added module by module, high priority first | not built |

## 6. Status after the completion work (2026-11-12)

| Item | State |
|---|---|
| 3.3 Training (40 kinds), Reports (`report.ready`, `report.schedule_suspended`), Backup (`backup.alert`, `backup.maintenance_drained`), Storage (`system.storage_usage_warning`) | now registry events (`training.*`, `report.*`, `backup.*`, `system.*`); Decision Log D11, D13 |
| 3.3 Document Control and Controlled Copy older messages | registry events since D17 (`document.review_request`, `controlled_copy.recall_notice`, ...); external-address e-mail unchanged |
| 4.1 Revision cancelled, editing finished, review comments, legacy import, document number changed | **open** (the audit does not name the author to tell); publishing package failed: done (`document.publishing_failed`) |
| 4.2 Copy requested, lost or damaged, distribution failed | done; request outcome to the requester, overdue return after a recall, uncontrolled copy expiry: **open** |
| 4.3 Training | done as registry events; the audit actions of 4.3 (approver designated, number cancelled, assessment versions, form templates) are covered by `training.step_assigned` or **open** |
| 4.4 Backup & Restore approval workflows | done (`backup.restore_requested`, `backup.restore_decided`, `backup.export_decided`, `backup.policy_decided`, `backup.rehearsal_requested`); inspection and scrub: **open** |
| 4.5 Reports | template submitted and decided done; run finished/failed already sent by `report.ready` for schedules; type/property changes **open** (L) |
| 4.6 Security, Access Review, Audit Trail Review | done (`security.refresh_token_reuse`, `security.esignature_settings_changed`, `security.access_profile_changed_audit`, `access_review.campaign_changed`, `audit.review_campaign_changed`); SoD, permission sets, object rules: **open** |
| 4.7 System | configuration changed done (off by default); maintenance on/off, retention, knowledge sharing, calendar: removed with the calendar function (D19) |
