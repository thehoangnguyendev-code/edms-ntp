# Audit objects: classification proposal (for the owner to approve before any code is changed)

Status: **PROPOSED, nothing built.** Source: the 96 entity types of the DEV audit log (41,899 records) and the entity types the code writes, read against the sidebar (`eqms/src/app/navigation.ts`). Decision Log entry to be written when approved: `AUDIT-OBJECT-REGISTRY`.

## The three rules the owner agreed (2026-11-17)

1. **Object Type = the default name of the function menu** where the object is shown or administered ("Controlled Copies", "Training Activities"). The default label is fixed by the system; it does not follow the labels an administrator gives the menus (Configuration > Navigation Labels), as for the Module.
2. **Object Code = a real business code** (a number the business uses), formatted by a rule an Admin can configure. Where a code is not needed the **name** stays, but never a technical name.
3. **Action = one short verb** (Create, Update, Approve...); the Object Type already says what it was done to ("Training Activities"). The stored action code is unchanged and the full text is on the Detail screen.

## The three classes

| Class | Meaning | Object Code |
|---|---|---|
| **A** | A business record a person works with, many of them | A real number, from a format an Admin configures (prefix, sequence, year, unit...). Immutable once given, never reused; a change of format applies to new records only; each change is audited. |
| **B** | A configuration object with a name of its own (a profile, a template, a rule, a setting) | The name is the identity: it must be a real name (not a technical code), and unique. A singleton setting has no code: the Detail lists what changed. |
| **C** | Part of another object, or an event of the system (a file of a report run, a login session, a notification) | No number of its own: it is identified by its parent's code (a file by its file name), or by the actor and the event. |

**Child objects** (a batch of copies, a file of a run) use the menu of their parent and say what they are: "Controlled Copies - Distribution Batch". *Decision D1.*

Numbering already exists in four places and must be reused, not copied: **Document Name Formats** (documents), **Training Code Rules** (+ the Training Number Allocation Log), **Report Name Formats** and the template number rule, and the numbers made by the backup service (BK-, EXP-, IS-) and by Controlled Copies (CC., CCB., RCB-). The proposal is one "Object Numbering" function in System Administration that these use.

"Today" below is what the DEV log holds. **Number** = a real business number is already there; **Name** = only a name; **Technical** = a technical or generated name that must be replaced; **None** = nothing.

## Document Control

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| DOCUMENT, documents, DocumentRecord (17,289) | Documents | A | Number (SOP.0037) | Keep. |
| REVISION, Revision (23,058) | Document Revisions | A | Number (SOP.0037 Rev.1.0.0) | Keep. |
| CONTROLLED_COPY, Controlled Copy, ControlledCopyRecord (2,842) | Controlled Copies | A | Number (CC.SOP.0007.003) | Keep. |
| CONTROLLED_COPY_DISTRIBUTION_BATCH (3 spellings, 104) | Controlled Copies - Distribution Batch | A | Number (CCB.SOP.0007.B002) | Keep. |
| Controlled Copy Recall Batch (16) | Controlled Copies - Recall Batch | A | Number (RCB-2026-00041) | Keep. |
| Uncontrolled Copy | Uncontrolled Copies | A | not in the DEV log | Verify the number its screen shows. |
| EXECUTED_RECORD (2) | Records | A | Number (EXEC-SOP.0037-001) | Keep. |
| EFORM_EDIT_SESSION (1) | Records - Edit Session | C | Number of the form (FORM.9904) | Code of the parent record. |
| PUBLISHED_PDF (12) | Document Revisions - Published PDF | C | **None** | Code of the revision it belongs to. The writer must pass it. |
| FORM_SETTINGS (3), OFFLINE_MEDIA (2) | *screen not traced* | ? | Number / Name | **Decision D2:** which menu. |

## Self-Service

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| KNOWLEDGE_SHARE_LINK (6), KNOWLEDGE_SHARE_DELEGATE (10) | Knowledge Base - Share Link / Delegate | B | Name ("Operation Unit") | Name is the scope; keep, unique. |

## Training Management

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| TRAINING_ACTIVITY (14,120) | Training Activities | A | Number (TRN/QA/26-502) | Keep (Training Code Rules). |
| TRAINING_REQUIREMENT (266) | Training Requirements | A | Number (REQ/2026-001) | Keep. |
| TRAINING_MATRIX, TRAINING_MATRIX_VERSION (193) | Training Matrix | A | Number + version (TM-ME v1) | Keep. |
| TRAINING_ASSESSMENT (287) | Training Assessments | A | Number exists (TAS-0063) but **only in the text of the record**; the name is the type | Writer passes the number as the code. |
| TRAINING_FORM_TEMPLATE (120) | Training Assessments - Form Template | A | Number exists (APD.0118 1.0.4) only in the text; the name is the type | Writer passes it. |
| TRAINING_JOB_ASSIGNMENT (652) | Job Assignments | A | Name with a counter ("DCO Test 1 #1") | **Decision D3:** a real number. |
| TRAINING_PERSONNEL_REVIEW (28) | Training Reviews | A | Name with a counter ("Training review 1") | A real number (D3). |
| TRAINING_SPECIMEN (69), TRAINING_SPECIMEN_SIGNATURE (294) | Specimen Signatures | A | Name with a counter ("Specimen signature #7") | A real number (D3). |
| TRAINING_LEGACY_EVIDENCE (149) | Legacy Training Evidence | A | Name as text ("Legacy training evidence SOP.7100 Rev 1.0.0") | A real number (D3). |
| TRAINING_RECORD_EXPORT, _BATCH (386) | Training Record Exports | A | Name, generic ("Record export") | A real number (the Number Allocation Log exists). |
| TRAINING_COMPLETION | Training Records | A | not in the DEV log | Verify. |
| TRAINING_TOPIC (97), TRAINING_INITIAL_PART (53) | Training Activities - Topic / Initial Part | B | Name | Unique name. |
| TRAINING_TRAINER_EXCEPTION (31) | Training Activities - Trainer Exception | C | Parent's number in the name | Code of the activity. |
| TRAINING_PERSON_POSITION (3), TRAINING_CALENDAR (6) | *screen not traced* | ? | Name | **D2.** |

## Reports

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| REPORT_DEFINITION, REPORT_TEMPLATE (181) | Report Templates | A | Number (RPT.0008) | Keep. |
| REPORT_RUN (176) | Report Run History | A | The template's code, **the same for every run of it** (31 names for 176 records) | The run number (RUN-000176) already exists; the writer passes it. |
| REPORT_ARTIFACT (206) | Report Run History - Report File | C | File name (RPT.0008-RUN-000176.csv) | Keep. |
| REPORT_SCHEDULE (47) | Scheduled Reports | A | Name; half of the old records only an identifier | A real number (D3). |

## Audit Trail

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| AUDIT_TRAIL, AuditTrail (4) | All Records (export) | C | "System Audit Trail" | No code. |
| AUDIT_TRAIL_REVIEW (2) | Periodic Review | A | Name typed by the user ("dgergerg") | A real number (D3). |

## Backup & Restore

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| BACKUP (33) | Backup History | A | Number (BK-20261111-2000-0005) | Keep. |
| BACKUP_RESTORE (86) | Restore Backup | A | The number of the backup restored (BK-...), **not a number of the restore request** | A number for the request (D3). |
| BACKUP_EXPORT (5), BACKUP_INSPECTION (4) | Backup History - Export / Inspection | A | Number (EXP-..., IS-...) | Keep. |
| BACKUP_STORE_SCRUB (2) | Backup Status Overview - Store Check | C | Name or identifier | No code; event. |

## Security & Authorization

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| USER, UserAccount (884) | User Management | A | Number (employee code) | Keep. |
| ACCESS_PROFILE (54) | Access Profiles | B | Name | Unique name. |
| ROLE (11) | Access Profiles - Role | B | Name | Unique name. |
| PERMISSION_SET (28) | Shared Permission Sets | B | Name | Unique name. |
| OBJECT_ACCESS_RULE (83) | Object Access Rules | A | A **generated sentence** ("Share: Operation Unit - Department: ...") | A real number (D3); the sentence is the Detail. |
| SOD_CONSTRAINT (4) | Segregation of Duties | B | Name | Unique name. |
| WORKFLOW_ROLE, WORKFLOW_ACTION_POLICY, LIFECYCLE_STATE_POLICY | Workflow Role Catalog / Workflow Authorization | B | not in the DEV log | Verify names. |
| ACCESS_REVIEW (4) | Access Review | A | Name typed by the user | A real number (D3). |
| SESSION (9,751) | Logged in Users | C | **None** ("Authentication Session") | Identity = the user and the time; no code. |

## Notifications and System Administration

| Stored type(s) | Object Type | Class | Today | Proposal |
|---|---|---|---|---|
| NOTIFICATION (9,805), NOTIFICATION_INBOX (5) | Notifications | C | Event name shared by thousands | Identity = event and recipient (exists in the text). |
| NOTIFICATION_POLICY (67) | Notifications Administration - Policy | B | Name (event name) | Keep. |
| EMAIL_TEMPLATE, EmailTemplate (14), EMAIL_DESIGN (9), IN_APP_DESIGN (2) | Notifications Administration | B | Name | Keep. |
| SYSTEM_CONFIGURATION (372) | Configuration | B | Singleton, name = type | No code; the Detail lists the settings changed. |
| ELECTRONIC_SIGNATURE_SETTINGS (7) | E-Sign Config | B | Singleton | No code. |
| STORAGE_USAGE_POLICY, ADMINISTRATIVE_NETWORK_POLICY, DASHBOARD_ROLE_LAYOUT | Configuration | B | not in the DEV log | Verify names (a layout is per role). |
| SYSTEM_ANNOUNCEMENT (2) | System Announcements | A or B | Title | **D4:** a number or the title. |
| SETTINGS (38) | **Catch-all: it hides which dictionary** (Document Types, Sub-Types, Departments, Positions...) | B | Name; one has a generated suffix | Split into one kind per screen, each with its own menu name. |
| PUBLISHING_TEMPLATE (68), STORAGE_OBJECT (2) | Publishing Templates / - File | B / C | Name / an address | Name; the file by its file name. |
| CONTROLLED_COPY_POLICY (163), _EXPIRY_LIMIT, _PLACEHOLDER_FIELD | Controlled Copies Policy | B | Singleton / scope ("Global Default") | No code. |
| UNCONTROLLED_COPY_POLICY, _ELIGIBILITY_RULE | Uncontrolled Copies Policy | B | not in the DEV log | Verify. |
| KNOWLEDGE_HIERARCHY (44), KNOWLEDGE_COMPONENT (8) | Knowledge Categories Hierarchies / Components | B | Name; some generated ("Bulk-1789988676945") | Real unique names. |
| TRAINING_SETTINGS (45), TRAINING_NOTIFICATIONS (22) | Training Properties / Training Notifications | B | Singleton; one name technical ("TRAINING_NUMBER_COUNTER QA 2026") | No code; readable name. |
| TRAINING_CODE_RULE (6), TRAINING_JOB_ROLE (152), TRAINING_VENDOR/PROVIDER | Training Code Rules / Work Positions / Training Vendors | B | Name | Unique name. |
| REPORT_PROPERTIES (6), REPORT_APPEARANCE (15), REPORT_NAME_FORMAT (7), REPORT_TYPE (2) | Report Properties / Appearance / Name Formats / Types | B | Singleton / Name / Name / **Technical (DOCUMENT_STATUS)** | Types need a display name. |
| BACKUP_POLICY (14), BACKUP_TARGET (4) | Backup Policy / Backup Storage & Encryption | B | Name with a version / Name (T1) | Keep. |
| BACKUP_ALERT (7) | Backup Alerts & Recipients | A | **An identifier** | A real number (D3). |
| BACKUP_ALERT_RULE (2), BACKUP_ALERT_RECIPIENT (3) | Backup Alerts & Recipients | B | **Technical (CAPACITY_HIGH)** / Name | A readable name for the rule. |
| BACKUP_DR_*, BACKUP_MANUAL_COPY | Disaster Recovery Plan / Backup Storage & Encryption | B / C | not in the DEV log | Verify. |
| TABLE_EXPORT (9) | *the screen it was exported from* | C | The name of the table | **D5:** the owner does not know its module; the writer must record the screen it came from. |
| PROMPT_SPECIFICATION, PROMPT_GENERATION_RUN | *legacy, no screen* | ? | not in the DEV log | **D5:** keep or retire. |

## Decisions for the owner

- **D1.** Child objects read "Menu - Kind" (above). Or only the menu?
- **D2.** The menu of `FORM_SETTINGS`, `OFFLINE_MEDIA`, `TRAINING_PERSON_POSITION`, `TRAINING_CALENDAR` (their screens were not traced).
- **D3.** The records of class A that have only a counter-name today get a real number: Job Assignments, Training Reviews, Specimen Signatures, Legacy Training Evidence, Training Record Exports, Scheduled Reports, Periodic Review, Access Review, Restore requests, Object Access Rules, Backup Alerts. **The format of each** (prefix, year, unit, digits) is for the Admin to configure; the owner/QA gives the default.
- **D4.** System Announcements: numbered or by title.
- **D5.** `TABLE_EXPORT` and the `PROMPT_*` types.
- **D6.** Existing records of class A that get a number: one audited backfill; records already deleted keep the name stored.

## Order of work (after approval)

1. **The registry** (no data change): every kind declares its Object Type, module, class and actions; the writers must use it and the build fails for a kind not declared. It fixes the Object Type, the Action and the writers that pass the wrong thing (Report Run, Training Assessment, Form Template, Published PDF, Backup Alert).
2. **The numbering function** and its Admin screen, reusing the four engines.
3. **Class A, kind by kind**, with the backfill; class B: unique names.
