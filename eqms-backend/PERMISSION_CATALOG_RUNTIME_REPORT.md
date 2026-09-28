# Runtime Permission Catalog

**Evidence status:** Runtime-confirmed snapshot  
**Captured:** 2026-08-27 (Asia/Ho_Chi_Minh)  
**Source:** PostgreSQL table `permissions`, accessed through the same backend catalog path exposed at `GET /api/security/permissions/catalog` and `GET /api/security/permissions/catalog/paged`.  
**Scope:** 120 permission records currently configured in the running EQMS database.

> This is a point-in-time runtime catalogue. Permission codes are stable machine values; labels and descriptions are administrator-facing explanations. The frontend file `eqms/src/features/settings/permissionCatalog.ts` is a legacy/fallback catalogue and is not the source queried by the permission catalog screen.

## Summary by module

| Module | Permissions |
|---|---:|
| app-settings | 7 |
| audit-trail | 5 |
| dashboard | 2 |
| documents | 56 |
| notifications | 2 |
| preferences | 2 |
| report | 7 |
| reports | 2 |
| security | 1 |
| security-authorization | 13 |
| settings | 13 |
| system-admin | 6 |
| training | 4 |

## Full catalogue

| Module | Group | Permission code | Meaning (name) | Description | Requires audit |
|---|---|---|---|---|---|
| app-settings | data_dictionaries | `settings.dictionary.view` | View Data Dictionaries | View controlled dictionary values such as business units, departments, document types, and retention policies. | No |
| app-settings | data_dictionaries | `settings.dictionary.manage` | Manage Data Dictionaries | Create, update, and delete controlled dictionary values used by GxP records. | No |
| app-settings | document_control | `settings.controlled_copy_policy.view` | View Controlled Copies Policy | View controlled copy distribution, expiry, recall, and security policy. | No |
| app-settings | document_control | `settings.controlled_copy_policy.manage` | Manage Controlled Copies Policy | Update controlled copy distribution, expiry, recall, and security policy. | Yes |
| app-settings | document_control | `settings.publishing_template.view` | View Publishing Templates | View publishing templates and their generated component previews. | No |
| app-settings | document_control | `settings.publishing_template.manage` | Manage Publishing Templates | Create, update, version, activate, and retire publishing templates. | Yes |
| app-settings | system_configuration | `settings.configuration.view` | View Configuration | View system-wide configuration. | No |
| audit-trail | audit_trail | `audit.view` | View Audit Trail | View the system-wide audit trail. | No |
| audit-trail | audit_trail | `audit.export` | Export Audit Trail | Export the system-wide audit trail. | Yes |
| audit-trail | audit_trail_access | `audittrail.module.view` | View Audit Trail | Access the system-wide audit trail module. | No |
| audit-trail | review | `audit.review.view` | View Audit Trail Reviews | View periodic audit trail review campaigns and their findings. | No |
| audit-trail | review | `audit.review.manage` | Manage Audit Trail Reviews | Create, decide, complete, and cancel audit trail review campaigns. | No |
| dashboard | dashboard_access | `dashboard.module.view` | View Dashboard | Access the system dashboard and KPI widgets. | No |
| dashboard | dashboard_admin | `dashboard.admin.view` | View Administrative Dashboard | View administrative dashboard statistics and security-oriented overview widgets. | No |
| documents | controlled_copy | `documents.controlled_copy.receive_as_dco` | Receive Controlled Copies as DCO | Eligible to be selected in Controlled Copies Policy as the DCO recipient who receives the printable file/ZIP instead of the original requester(s) when delivery redirection is enabled. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.view_file` | View Controlled Copy File | View a controlled copy PDF in the portal. | No |
| documents | controlled_copy_files | `documents.controlled_copy.download_file` | Download Controlled Copy File | Download a controlled copy PDF file. | No |
| documents | controlled_copy_files | `documents.controlled_copy.print` | Print Controlled Copy File | Print an authorized controlled copy file. | No |
| documents | controlled_copy_files | `documents.controlled_copy.view_evidence` | View Controlled Copy Evidence | View evidence files attached to a controlled copy. | No |
| documents | controlled_copy_files | `documents.controlled_copy.download_evidence` | Download Controlled Copy Evidence | Download evidence files attached to a controlled copy. | No |
| documents | controlled_copy_files | `documents.controlled_copy.request` | Request Controlled Copy | Request issuance of a new controlled copy. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.view` | View Controlled Copy Log | View controlled copy distribution records. | No |
| documents | controlled_copy_files | `documents.controlled_copy.distribute` | Distribute Controlled Copy | Mark a controlled copy as distributed to its holder. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.recall` | Recall Controlled Copy | Recall a distributed controlled copy. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.report_lost_damaged` | Report Controlled Copy Lost/Damaged | Report a distributed controlled copy as lost or damaged. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.replace_lost_damaged` | Replace Lost/Damaged Controlled Copy | Issue a replacement for a lost or damaged controlled copy. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.upload_evidence` | Upload Controlled Copy Evidence | Upload evidence for a lost or damaged controlled copy. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.expire` | Expire Controlled Copy | Expire a controlled copy according to its validity policy. | Yes |
| documents | controlled_copy_files | `documents.controlled_copy.cancel_request` | Cancel Controlled Copy Request | Cancel a pending controlled copy request. | Yes |
| documents | document_administration | `documents.admin.view` | Access Document Administration | View Document Administration and workflow policy settings. | No |
| documents | document_administration | `documents.admin.manage_workflow_roles` | Manage Document Workflow Rules | Manage segregation-of-duties rules for the Document Revision workflow (e.g. reviewer cannot approve, require two reviewers, author cannot review own revision). | Yes |
| documents | document_authoring | `documents.document.configure_initial_workflow` | Configure Initial Document Workflow | Configure reviewers, approvers, and document relationships during initial Document Master creation. | Yes |
| documents | document_control_access | `documents.module.view` | View Document Control | Access the Document Control module. | No |
| documents | document_control_access | `documents.document.view_all` | View All Document Records | View all document masters and revisions regardless of ownership, workflow participation, business unit, or department. This permission is read-only. | No |
| documents | document_control_access | `documents.workspace.manage` | Manage Document Control Workspace | Perform operational Document Control actions allowed by lifecycle and workflow policy. It does not permit editing another Author's Draft source or content. | Yes |
| documents | document_control_access | `documents.revision.update_draft_metadata` | Update Draft Revision Metadata | Update metadata of a Draft document revision. | Yes |
| documents | document_control_access | `documents.template.use` | Use Controlled Document Templates | Select an approved controlled-document template when creating a revision. | Yes |
| documents | document_control_access | `documents.template.manage` | Manage Controlled Document Templates | Create or modify a document marked as a controlled-document template. | Yes |
| documents | document_files | `documents.document.preview_published` | Preview Published Document | Preview the published PDF of an effective or obsoleted document. | No |
| documents | document_master | `documents.document.obsolete` | Obsolete Document | Retire an Active document, obsoleting its effective revision. | Yes |
| documents | document_master | `documents.document.cancel` | Cancel Document | Cancel a document master record before or after activation. | Yes |
| documents | document_master | `documents.document.reopen` | Reopen Cancelled Document | Reopen a closed-cancelled Draft document with an auditable activity summary. | Yes |
| documents | document_master | `documents.document.update_metadata` | Update Draft Document Metadata | Update metadata of a Draft document master. | Yes |
| documents | document_master | `documents.document.view` | View Document | View a document master record and its metadata. | No |
| documents | document_master | `documents.document.create` | Create Document Shell | Create a new document shell with metadata and workflow configuration. | Yes |
| documents | document_master | `documents.document.edit_metadata` | Edit Document Metadata | Edit document master metadata and manage the review cycle. | Yes |
| documents | document_master | `documents.document.view_audit` | View Document Audit Trail | View the Audit Trail tab for a document or revision. Direct stakeholders (Author, Co-author, Reviewer/Approver, Admin/DCO) see it automatically without this permission; it is only required for indirect/broad viewers. | No |
| documents | revision_configuration | `documents.revision.configure_next_reviewers` | Configure Next Revision Reviewers | Change reviewers inherited by the next revision of an Active document. | Yes |
| documents | revision_configuration | `documents.document.configure_next_metadata` | Configure Next Revision Metadata | Change Author, Co-Author, Periodic Review Cycle/Notification, Review Date and Description inherited by the next revision of an Active document. | Yes |
| documents | revision_configuration | `documents.revision.configure_next_approvers` | Configure Next Revision Approvers | Change approvers inherited by the next revision of an Active document. | Yes |
| documents | revision_configuration | `documents.revision.configure_next_related_documents` | Configure Next Revision Related Documents | Change related documents inherited by the next revision of an Active document. | Yes |
| documents | revision_configuration | `documents.revision.configure_next_correlated_documents` | Configure Next Revision Correlated Documents | Change correlated documents inherited by the next revision of an Active document. | Yes |
| documents | revision_files | `documents.revision.preview` | Preview Revision | Preview a revision PDF (review snapshot or published). | No |
| documents | revision_files | `documents.revision.upload_source` | Upload Revision Source | Upload or replace the controlled source file for an authorised Draft revision. | No |
| documents | revision_files | `documents.revision.edit_online` | Edit Revision Online | Open a revision source file in Office Online for editing. | No |
| documents | revision_files | `documents.revision.upload_office_online` | Upload Revision to Office Online | Upload or synchronize an authorised Draft revision working copy with Office Online. | Yes |
| documents | revision_publish | `documents.revision.open_publishing_workspace` | Open Publishing Workspace | Open the publishing workspace for an authorised Ready for Publishing revision. Publishing remains a separate permission. | Yes |
| documents | revision_workflow | `documents.revision.complete_authoring` | Complete Revision Authoring | Complete editing and lock the revision source for publishing preparation. | Yes |
| documents | revision_workflow | `documents.revision.submit_review` | Submit Revision for Review | Submit a completed draft revision into the review/approval workflow. | Yes |
| documents | revision_workflow | `documents.revision.review` | Review Revision | Complete review of a revision pending review. | Yes |
| documents | revision_workflow | `documents.revision.reject_review` | Reject Revision Review | Reject a revision at the review stage and return it to draft. | Yes |
| documents | revision_workflow | `documents.revision.approve` | Approve Revision | Complete approval of a revision pending approval. | Yes |
| documents | revision_workflow | `documents.revision.publish` | Publish Revision | Publish a revision to Effective status. | Yes |
| documents | revision_workflow | `documents.revision.force_publish` | Force Publish Revision (Override Related Documents Check) | Allows publishing a Revision even when one or more Related Documents are not currently Effective. GMP exception/deviation -- not granted by default. | Yes |
| documents | revision_workflow | `documents.revision.reject_approval` | Reject Revision Approval | Reject a revision at the approval stage and return it to draft. | Yes |
| documents | revision_workflow | `documents.revision.cancel` | Cancel Revision | Cancel an authorised Draft revision only; an activity summary and electronic signature are required. | Yes |
| documents | revision_workflow | `documents.revision.upgrade` | Upgrade Revision | Create a new draft revision from an effective revision. | Yes |
| documents | revision_workflow | `documents.revision.obsolete` | Obsolete Revision | Obsolete an authorised Effective revision. An activity summary and electronic signature are required. | Yes |
| documents | training_publish | `documents.training.manage` | Manage Training Plan | Manage document-related training plans and distribution readiness. | Yes |
| documents | training_publish | `documents.training.complete` | Complete Training | Complete document revision training workflow steps. | Yes |
| notifications | notifications_access | `notifications.module.view` | View Notifications | Access in-application notifications. | No |
| notifications | recipient_audiences | `notifications.recipient.qa_manager` | Receive QA Manager Notifications | Receive notification-policy recipients configured as QA Manager. Grant through an Access Profile/Permission Set; this is not inferred from a role name. | No |
| preferences | preferences_access | `preferences.module.view` | View Preferences | Open the personal preferences module. | No |
| preferences | preferences_access | `preferences.module.edit` | Edit Preferences | Update personal preferences and self-service settings. | No |
| report | report_platform | `reports.catalog.view` | View Report Catalog | View report definitions available to the current scope. | No |
| report | report_platform | `reports.run.create` | Generate Reports | Queue a report generation request. | Yes |
| report | report_platform | `reports.run.view_own` | View Own Report History | View own report runs and artifacts. | No |
| report | report_platform | `reports.run.view_all` | View All Report History | View report runs for all users. | No |
| report | report_platform | `reports.artifact.download` | Download Report Artifacts | Download authorized immutable report artifacts. | Yes |
| report | report_platform | `reports.schedule.view` | View Scheduled Reports | View report schedules. | No |
| report | report_platform | `reports.schedule.manage` | Manage Scheduled Reports | Create, change, pause and resume report schedules. | Yes |
| reports | reports_access | `report.module.view` | View Reports | Access system reports and reporting workspaces. | No |
| reports | reports_access | `report.module.export` | Export Reports | Export reports and compliance data extracts. | Yes |
| security | system_access | `security.maintenance.bypass` | Bypass Maintenance Mode | Access the application while scheduled maintenance mode is enabled. | Yes |
| security-authorization | access_profiles | `security.access_profiles.view` | View Access Profiles | View access profiles, business roles, and assignment summaries. | No |
| security-authorization | access_profiles | `security.access_profiles.update` | Manage Access Profiles | Create, update, deactivate, clone, and administer access profiles. | No |
| security-authorization | access_profiles | `security.access_profiles.assign` | Assign Access Profiles | Assign users, permission sets, workflow roles, and object rules to access profiles. | No |
| security-authorization | access_review | `security.access_review.view` | View Access Reviews | View periodic access review campaigns and their findings. | No |
| security-authorization | access_review | `security.access_review.manage` | Manage Access Reviews | Create, decide, complete, and cancel access review campaigns. | No |
| security-authorization | object_access | `security.object_rules.view` | View Object Access Rules | View object access rules and organization scope policies. | No |
| security-authorization | object_access | `security.object_rules.manage` | Manage Object Access Rules | Create, update, deactivate, and delete object access rules. | No |
| security-authorization | permission_sets | `security.permission_sets.view` | View Permission Sets | View permission sets and their assigned permissions. | No |
| security-authorization | permission_sets | `security.permission_sets.update` | Manage Permission Sets | Create, update, clone, deactivate, and assign permission sets. | No |
| security-authorization | segregation_of_duties | `security.sod.view` | View Segregation of Duties | View segregation-of-duties constraints and violation scans. | No |
| security-authorization | segregation_of_duties | `security.sod.manage` | Manage Segregation of Duties | Create, update, and deactivate segregation-of-duties constraints. | No |
| security-authorization | workflow_authorization | `security.workflow_authorization.view` | View Workflow Authorization | View workflow authorization policies and actor rules. | No |
| security-authorization | workflow_authorization | `security.workflow_authorization.manage` | Manage Workflow Authorization | Create and update workflow authorization policies and actor rules. | Yes |
| settings | report_configuration | `reports.definition.view` | View Report Configuration | View controlled report definitions. | No |
| settings | report_configuration | `reports.definition.manage` | Manage Report Configuration | Change controlled report configuration. | Yes |
| settings | report_configuration | `reports.retention.manage` | Manage Report Retention | Manage report artifact retention and legal holds. | Yes |
| settings | system_settings | `settings.notification_policy.manage` | Manage Notification Policies | Edit notification delivery rules, recipients, and content templates. | Yes |
| settings | system_settings | `settings.notification_policy.view` | View Notification Policies | View the notification event catalog, delivery rules, and content. | No |
| settings | system_settings | `settings.configuration.manage` | Manage Configuration | Manage general system configuration. | Yes |
| settings | system_settings | `settings.email_template.manage` | Manage Email Templates | Create and edit notification email templates. | Yes |
| settings | user_management | `users.invite_external` | Invite external user | Invite a user to Microsoft Entra as a guest | Yes |
| settings | user_management | `users.resend_external_invitation` | Resend external invitation | Resend a Microsoft Entra guest invitation | Yes |
| settings | user_management | `users.retry_external_provisioning` | Retry external provisioning | Retry a failed Microsoft Entra provisioning operation | Yes |
| settings | user_management | `users.disable_microsoft_access` | Disable Microsoft access | Disable the provisioned Microsoft guest account without deleting it | Yes |
| settings | user_management | `users.view_external_provisioning` | View external provisioning | View Microsoft Entra invitation and provisioning status | No |
| settings | user_management | `users.remove_external_identity` | Remove external user | Permanently remove the Microsoft Entra guest account (irreversible) | Yes |
| system-admin | user_management | `settings.user.view` | View Users | View user management pages and user records. | No |
| system-admin | user_management | `settings.user.create` | Create Users | Create new user accounts. | Yes |
| system-admin | user_management | `settings.user.edit` | Edit Users | Edit user account information. | Yes |
| system-admin | user_management | `settings.user.delete` | Delete Users | Delete or deactivate user accounts. | Yes |
| system-admin | user_management | `settings.user.reset_password` | Reset Passwords | Reset another user password. | Yes |
| system-admin | user_management | `settings.user.force_logout` | Force Logout Users | Immediately revoke active sessions for another user. | Yes |
| training | training_access | `training.module.view` | View Training | Access the Training module and assigned training items. | No |
| training | training_admin | `training.material.manage` | Manage Training Materials | Create, update, review, and approve training materials. | Yes |
| training | training_admin | `training.session.manage` | Manage Training Sessions | Schedule and manage training sessions and attendance records. | Yes |
| training | training_admin | `training.assignment.manage` | Manage Training Assignments | Assign training courses and requirements to users or groups. | Yes |
