# Permission Catalog Inventory

**Purpose:** business review of the EQMS permission catalog before permission-model refactoring.

**Snapshot:** 16 July 2026. This inventory is source-based, not a live-database export.

**Sources reviewed:**

- Frontend catalog: `eqms/src/features/settings/permissionCatalog.ts` (111 entries shown in the current administration UI).
- Backend canonical additions and workflow permissions: database migrations `V156`, `V170`, and `V171`.

## How to Review This Catalog

Each permission is an **action capability**, not a job title and not a UI button. A user is allowed only when the capability is also compatible with the record scope, lifecycle status, workflow assignment, and SoD rules.

- `UI` means the item is currently in the frontend Permission Set catalog.
- `BE-only` means the backend/database defines it but the current frontend catalog does not list it correctly or at all.
- `ALIGNMENT REQUIRED` marks known mismatches. These must be resolved before using the catalog as the final security contract.

## Dashboard

- `dashboard.module.view` - View Dashboard
- `dashboard.admin.view` - View Administrative Dashboard

## Documents

### Module and Document Master

- `documents.module.view` - View Document Control
- `documents.document.view` - View one Document Master and its metadata. **BE-only; UI catalog missing.**
- `documents.document.create` - Create Document Shell
- `documents.document.edit_metadata` - Edit Document Metadata
- `documents.document.manage_relations` - Manage Related and Correlated Documents
- `documents.document.view_audit` - View Document Audit Trail
- `documents.document.obsolete` - Obsolete Document
- `documents.document.cancel` - Cancel Document. **BE-only; UI catalog missing.**

### Revision Authoring

- `documents.revision.create` - Create Revision. **BE-only; UI catalog missing.**
- `documents.revision.edit_metadata` - Edit Revision Metadata. **BE-only; UI catalog missing.**
- `documents.revision.upload_source` - Upload Revision Source File. **BE-only; current UI shows `documents.revision.upload_file`. ALIGNMENT REQUIRED.**
- `documents.revision.complete_authoring` - Complete Revision Authoring. **BE-only; UI catalog missing.**
- `documents.revision.open_publishing_workspace` - Open Publishing Workspace. **BE-only; UI catalog missing.**
- `documents.office_online.upload` - Upload To Office Online
- `documents.office_online.edit` - Edit File Online

### Revision Workflow

- `documents.revision.submit_review` - Submit Revision for Review. **BE canonical; current UI shows `documents.revision.submit`. ALIGNMENT REQUIRED.**
- `documents.revision.review` - Complete Review
- `documents.revision.reject_review` - Reject at Review step. **BE canonical; current UI shows `documents.revision.reject`. ALIGNMENT REQUIRED.**
- `documents.revision.approve` - Complete Approval
- `documents.revision.reject_approval` - Reject at Approval step. **BE-only; UI catalog missing.**
- `documents.revision.complete_training` - Complete Revision Training. **BE-only; current UI shows `documents.training.complete`. ALIGNMENT REQUIRED.**
- `documents.revision.publish` - Publish Revision
- `documents.revision.cancel` - Cancel Revision. **BE-only; UI incorrectly maps cancellation to submit. ALIGNMENT REQUIRED.**
- `documents.revision.obsolete` - Obsolete Revision. **BE-only; UI catalog missing.**
- `documents.revision.upgrade` - Upgrade Revision / create a new draft from an effective revision. **BE-only; UI catalog missing.**

### Training

- `documents.training.manage` - Manage Training Plan
- `documents.training.complete` - Complete Training

### Controlled Copies

- `documents.controlled_copy.request` - Request Controlled Copy
- `documents.controlled_copy.view` - View Controlled Copy Log. **BE-only; UI catalog missing.**
- `documents.controlled_copy.print` - Print Controlled Copy
- `documents.controlled_copy.approve_request` - Approve Controlled Copy Request. **BE canonical; UI currently exposes broad `documents.controlled_copy.authorize`. ALIGNMENT REQUIRED.**
- `documents.controlled_copy.reject_request` - Reject Controlled Copy Request. **BE-only; UI catalog missing.**
- `documents.controlled_copy.prepare_distribution` - Prepare Distribution. **BE-only; UI catalog missing.**
- `documents.controlled_copy.distribute` - Distribute Controlled Copy. **BE-only; UI catalog missing.**
- `documents.controlled_copy.recall` - Recall Controlled Copy. **BE-only; UI catalog missing.**
- `documents.controlled_copy.report_lost_damaged` - Report Lost/Damaged Copy. **BE-only; UI catalog missing.**
- `documents.controlled_copy.replace_lost_damaged` - Replace Lost/Damaged Copy. **BE-only; UI catalog missing.**
- `documents.controlled_copy.expire` - Expire Controlled Copy. **BE-only; UI catalog missing.**
- `documents.controlled_copy.destroy` - Destroy Controlled Copy. **BE-only; UI catalog missing.**
- `documents.controlled_copy.confirm_destroy` - Confirm Controlled Copy Destruction. **BE-only; UI catalog missing.**
- `documents.controlled_copy.cancel_request` - Cancel Controlled Copy Request. **BE-only; UI catalog missing.**

### Document Administration

- `documents.admin.view` - Access Document Administration
- `documents.admin.manage_workflow_roles` - Manage Document Workflow Roles
- `documents.admin.manage_sod_constraints` - Manage Document SoD Constraints

### Documents Legacy/UI Codes Needing Retirement or Migration

These are currently exposed by the UI but are not the final backend workflow action identifiers:

- `documents.revision.upload_file` -> replace with `documents.revision.upload_source`
- `documents.revision.submit` -> replace with `documents.revision.submit_review`
- `documents.revision.reject` -> replace with separate `documents.revision.reject_review` and `documents.revision.reject_approval`
- `documents.controlled_copy.authorize` -> replace with explicit controlled-copy actions above

## Training Management

- `training.module.view` - View Training
- `training.material.manage` - Manage Training Materials
- `training.session.manage` - Manage Training Sessions
- `training.assignment.manage` - Manage Training Assignments

## Equipment Management

- `equipment.module.view` - View Equipment
- `equipment.record.create` - Add Equipment
- `equipment.record.edit` - Edit Equipment Record
- `equipment.record.calibrate` - Manage Calibration
- `equipment.record.retire` - Retire Equipment

## Deviations and Nonconformances

- `deviations.module.view` - View Deviations & NCs
- `deviations.record.create` - Report Deviation / NC
- `deviations.record.edit` - Edit Deviation Record
- `deviations.record.investigate` - Investigate Deviation
- `deviations.record.approve` - Approve Deviation
- `deviations.record.close` - Close Deviation

## CAPA

- `capa.module.view` - View CAPA
- `capa.record.create` - Create CAPA
- `capa.record.edit` - Edit CAPA Record
- `capa.record.assign` - Assign CAPA Actions
- `capa.record.implement` - Implement CAPA Action
- `capa.record.verify` - Verify CAPA Effectiveness
- `capa.record.close` - Close CAPA

## Change Control

- `change_control.module.view` - View Change Controls
- `change_control.record.create` - Create Change Control
- `change_control.record.edit` - Edit Change Control
- `change_control.record.review` - Review Change Control
- `change_control.record.approve` - Approve Change Control
- `change_control.record.implement` - Implement Change Control
- `change_control.record.close` - Close Change Control

## Risk Management

- `risk_management.module.view` - View Risk Management
- `risk_management.record.create` - Create Risk Assessment
- `risk_management.record.edit` - Edit Risk Record
- `risk_management.record.review` - Review Risk Assessment
- `risk_management.record.approve` - Approve Risk

## Complaints

- `complaints.module.view` - View Complaints
- `complaints.record.create` - Create Complaint
- `complaints.record.edit` - Edit Complaint Record
- `complaints.record.investigate` - Investigate Complaint
- `complaints.record.close` - Close Complaint

## Supplier Management

- `supplier.module.view` - View Supplier Management
- `supplier.record.create` - Add Supplier
- `supplier.record.edit` - Edit Supplier Record
- `supplier.record.approve` - Approve Supplier
- `supplier.record.audit` - Manage Supplier Audit

## Product Management

- `product.module.view` - View Product Management
- `product.record.create` - Add Product
- `product.record.edit` - Edit Product Record

## Regulatory Management

- `regulatory.module.view` - View Regulatory Management
- `regulatory.record.create` - Create Regulatory Record
- `regulatory.record.edit` - Edit Regulatory Record
- `regulatory.record.submit` - Submit Regulatory Filing

## Reports and Audit Trail

- `report.module.view` - View Reports & Analytics
- `report.module.export` - Export Reports
- `audittrail.module.view` - View Audit Trail
- `audittrail.module.export` - Export Audit Trail

## My Tasks, Notifications, Preferences, and Help

- `my_tasks.module.view` - View My Tasks
- `notifications.module.view` - View Notifications
- `preferences.module.view` - View Preferences
- `preferences.module.edit` - Edit Preferences
- `help_support.module.view` - View Help & Support
- `user_manual.module.view` - View User Manual

## System Administration

### User Management

- `settings.user.view` - View Users
- `settings.user.create` - Create Users
- `settings.user.edit` - Edit Users
- `settings.user.delete` - Delete Users
- `settings.user.reset_password` - Reset Passwords
- `settings.user.force_logout` - Force Logout Users

### Legacy Role / Access Profile Administration

- `settings.role.view` - View Access Profiles
- `settings.role.manage` - Manage Access Profiles
- `settings.role.assign_permissions` - Assign Permissions

### Security and Authorization

- `security.permission_sets.view` - View Permission Sets
- `security.permission_sets.update` - Manage Permission Sets
- `security.access_profiles.view` - View Access Profiles
- `security.access_profiles.update` - Manage Access Profiles
- `security.access_profiles.assign` - Assign Access Profiles
- `security.workflow_authorization.view` - View Workflow Authorization
- `security.workflow_authorization.manage` - Manage Workflow Authorization
- `security.object_rules.view` - View Object Access Rules
- `security.object_rules.manage` - Manage Object Access Rules
- `security.sod.view` - View Segregation of Duties
- `security.sod.manage` - Manage Segregation of Duties

## Application Settings

- `settings.configuration.view` - View Configuration
- `settings.configuration.edit` - Edit Configuration
- `settings.dictionary.view` - View Data Dictionaries
- `settings.dictionary.manage` - Manage Data Dictionaries
- `settings.controlled_copy_policy.view` - View Controlled Copies Policy
- `settings.controlled_copy_policy.manage` - Manage Controlled Copies Policy

## Review Decisions Required

1. Confirm the full canonical Documents list, especially the split between authoring, review, approval, training, publishing, and controlled-copy actions.
2. Decide whether each non-Documents module needs only a short MVP catalog or a full lifecycle/action catalog before it is released for GxP use.
3. Confirm whether System Administrator is deliberately prevented from business approval/publishing actions unless separately assigned an appropriate Access Profile.
4. Confirm whether generic `settings.role.*` permissions remain as transitional aliases or are retired in favour of `security.access_profiles.*`.
5. Approve a rule that every new action must be added to this catalog, enforced in the backend, exposed through a record capability API, and covered by authorization tests.
