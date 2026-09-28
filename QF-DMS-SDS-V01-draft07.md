**Document Management**

**Software Design Specification**

November 2025

This page is intentionally left blank.

**Table of Contents**

[**1 Revision History 5**](#_Toc219887600)

[**2 Abbreviations/Terms 5**](#_Toc219887601)

[**3 Introduction 5**](#_Toc219887602)

[**3.1 General Overview of Quality Forward Application 5**](#_Toc219887603)

[**3.2 Definition 5**](#_Toc219887604)

[**4 Module Authorizations 5**](#_Toc219887605)

[**5 Process Workflow Definitions 9**](#_Toc219887606)

[**5.1 Document Record 9**](#_Toc219887607)

[**5.1.1 Document Record Diagram 9**](#_Toc219887608)

[**5.1.2 Document Record Workflow 9**](#_Toc219887609)

[**5.2 Document Revision Record 11**](#_Toc219887610)

[**5.2.1 Document Revision Record Diagram 11**](#_Toc219887611)

[**5.2.2 Document Revision Record Workflow 12**](#_Toc219887612)

[**5.3 Controlled Copy Record 15**](#_Toc219887614)

[**5.3.1 Controlled Copy Record Diagram 15**](#_Toc219887615)

[**5.3.2 Controlled Copy Record Workflow 16**](#_Toc219887616)

[**5.4 Uncontrolled Copy 16**](#_Toc219887617)

[**5.5 Legend 18**](#_Toc219887617)

[**6 Data Fields 18**](#_Toc219887618)

[**6.1 Document Numbering Rules 18**](#_Toc219887619)

[**6.2 Document Data Fields 18**](#_Toc219887620)

[**6.3 Document Revision Data Fields 20**](#_Toc219887621)

[**6.4 Controlled Copies Data Fields 21**](#_Toc219887622)

[**6.5 Document Management Fields Choice/Reference Values Table 22**](#_Toc219887623)

[**7 Process Notifications 24**](#_Toc219887624)

[**7.1 Non-Workflow Notifications 24**](#_Toc219887625)

[**7.2 Workflow Notifications 25**](#_Toc219887626)

[**8 Access Interfaces 26**](#_Toc219887627)

[**9 User Management 29**](#_Toc219887628)

[**9.1 Create, update, and deactivate user accounts 29**](#_Toc219887629)

[**9.2 Manage user attributes 29**](#_Toc219887630)

[**9.3 Assign predefined roles 30**](#_Toc219887631)

[**9.4 Manage user lifecycle activities 30**](#_Toc219887632)

[**10 System Security 30**](#_Toc219887633)

[**10.1 Authentication Design 30**](#_Toc219887634)

[**10.1.1 User Authentication Mechanism 30**](#_Toc219887635)

[**10.2 Password Rules 30**](#_Toc219887636)

[**10.3 Account Lockout 31**](#_Toc219887637)

[**10.4 Session Management and Timeout 31**](#_Toc219887638)

[**10.5 Security Design 32**](#_Toc219887639)

[**10.5.1 Transport Layer Security (SSL/TLS) 32**](#_Toc219887640)

[**10.5.2 Access Control and Authorization 32**](#_Toc219887641)

[**10.5.3 Access Logs / Security Logs 32**](#_Toc219887642)

[**10.5.4 Audit Trail of GMP-Relevant Actions (Including View Actions) 33**](#_Toc219887643)

[**11 Dashboards 35**](#_Toc219887644)

[**12 Reporting 36**](#_Toc219887645)

[**13 Data Security and Data Governance 37**](#_Toc219887646)

**Document Review & Approval**

**Vendor Approval:**

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

**Client Review:**

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

**Client Approval:**

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

# 

1.  Revision History

|     |     |     |     |
| --- | --- | --- | --- |
| **Version** | **Prepared By** | **Date** | **Change Summary** |
| 01  | Çağla Çokar | xxx | First initial |

1.  Abbreviations/Terms

|     |     |
| --- | --- |
| **Abbreviations/Terms** | **Definition** |
| QMS | Quality Management System |
| DCO | Document Control Officer |
| ES  | Electronic Signature |
| KPI | Key Performance Indicator |
| SOP | Standard Operating Procedure |
| CAPA | Corrective and Preventive Actions |

1.  Introduction
    1.  General Overview of Quality Forward Application

The Quality Forward application is a comprehensive Quality Management System (QMS) designed to digitalize and streamline quality processes across the organization. It enables efficient management of key quality operations such as document control, training, audits, deviations, CAPA, and change management within a unified platform. The system ensures compliance with regulatory standards and internal procedures by providing traceability, version control, electronic signatures, and secure data handling. Quality Forward supports role-based access, workflow automation, and real-time monitoring, contributing to continuous improvement and organizational transparency.

- 1.  Definition

This document defines the functional specifications for the Document Management Module of the Quality Forward application. The purpose of Document Management module is to ensure controlled document creation, review, approval, distribution, and archiving quality-related documents in compliance with regulatory and organizational requirements.

The Document Management Module provides a centralized platform that enables users to manage document lifecycles effectively, maintain version control, ensure traceability, and enforce role-based access permissions.

1.  Module Authorizations

This section defines the user roles and corresponding access permissions within the Document Management Module. It outlines the authorization levels required to create, review, approve, revise, and archive documents, ensuring that all actions are performed by authorized personnel in accordance with predefined security and compliance requirements**.**

| **Functional Group** | **Specific Rights (Detailed)** | **Admin** | **DCO** | **Author** | Co-Authors | **Reviewer** | **Approver** | **Receiver/View Only** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| System Admin | Manage User Accounts & Role Mapping | X   |     |     |     |     |     |     |
| Configure System Settings & Backup | X   |     |     |     |     |     |     |
| View Audit Trail | X   | X   | X   | X   | X   | X   | &nbsp; X (only Published) |
| Delete Records |     |     |     |     |     |     |     |
| Metadata Management | Create New Document Shell (Metadata only) |     | X   |     |     |     |     |     |
| Edit Metadata (Title, Doc Code, Dept) |     | X   | X   | X   | X   |     |     |
| Modify Periodic Review Cycle (Months) |     | X   |     |     |     |     |     |
| Content Management<br><br>&nbsp; | Upload Initial Draft / Revision File |     |     | X   |     |     |     |     |
| Edit Online (MS Office Online integration) |     |     | X   | X   |     |     |     |
| Start / Submit Workflow |     | X   | X   |     |     |     |     |
| Cancel / Void Draft Revision |     |     | X   | X   |     |     |     |
| View document |     | X   | X   | X   | X   | X   | X (only Published) |
| View Metadata |     | X   | X   | X   | X   | X   | X (only Published) |
| Workflow Rights | Published |     | &nbsp;X |     |     |     |     |     |
| Add / Edit Review Comments |     |     |     |     | X   | X   |     |
| Return to Author (Reject with reason) |     |     |     |     | X   | X   |     |
|     | View Final PDF Preview (with Headers/Footers/Signatures) |     | X   | X   | X   | X   | X   | X (only Published) |
| Training & Effective | Create Training Plan & Notification |     | X   |     |     |     |     |     |
| Manage Distribution List (Email/Dept) |     | X   |     |     |     |     |     |
| Sign-off Training Completion |     | X   |     |     |     |     |     |
| Set/Modify Effective Date | X   | X   |     |     |     |     |     |
| Controlled Copy | Request / Initiate Copy Issuance |     | X   | X   | X   | X   | X   | X   |
| Authorize Distribution (Apply Stamp) |     | X   |     |     |     |     |     |
| Print Watermarked Copy (Paper/PDF) |     | X   |     |     |     |     |     |
| Record Reconciliation / Return Date |     | X   |     |     |     |     |     |
| View/Export Copy Log (Tracking) | X   | X   | X   | X   |     |     | X   |
| Archive & Obsolete | Set Status to Obsolete (Manual) |     | X   |     |     |     |     |     |
| View Obsolete/Archived Versions | X   | X   |     |     |     |     |     |
| Knowledge Access |     | X   | X   | X   | X   | X   | X   | X   |
| Left Menu Access |     | X   | X   | X   | X   | X   | X   | X   |

1.  Process Workflow Definitions
    1.  Document Record
        1.  Document Record Diagram

  

- - 1.  Document Record Workflow
- A new Document record is created by DCO.
- Primary documents can be uploaded to the system in following formats: Word
- Documents will be published in PDF format.
- The record starts in the Draft state.
- The DCO fills in the required fields and can either send the record for approval or cancel it.
- When the Cancel activity is triggered, the system requires the Activity Summary to be filled in. The record then moves to the Closed – Cancelled state.
- Upon submission of the first document revision record, according to BR_DOCR01 (Active Document), the system automatically moves the parent Document record to the Active state.
- The DCO assigns the Author, Co-Author, Reviewer, and Approver to the record during the creation.
- After the revision is uploaded, the Author and Co-Author cannot be changed.
- If the Reviewer is changed before the revision reaches the Pending Review state, a review task is assigned to the newly selected Reviewer for that revision. If the revision has already reached the Pending Review state, no review task is assigned to the updated Reviewer.
- If the Approver is changed before the revision reaches the Pending Approval state, an approval task is assigned to the newly selected Approver for that revision. If the revision has already reached the Pending Approval state, no approval task is assigned to the updated Approver.
- When a new version of document revision is effective, previous version will be Obsoleted by the system automatically.
- When required, an Obsolete activity can be initiated for the Document record in order to deactivate it.
- During the Obsolete activity, the system enforces the completion of the Activity Summary field.
- Once the Obsolete activity is completed, the document record moves to the Obsoleted state.
- According to BR_DOC02 (Obsolete Revisions), all related open Document Revisions linked to the parent record are automatically marked as Obsoleted by the system.
- Records in the Obsoleted state are locked, and no further edits can be made.
- The Upload Revision button is visible only when there is no other active revision in progress.
- Training Completion information tab will be visible if “Requires Training?” is selected Yes. The coordinator will be responsible to enter training period, and distribution list and proceeding with the document revision record with Training Completed action.
- All Closed - Cancelled States are locked, and no field modifications are allowed.
- Throughout the workflow, the system triggers automatic email notifications according to defined Business Rules:
    
    - BR_01 – Email to Assigned Author Person once Assigned.
    - BR_02 – Email to Assigned Co-Authors Person once Assigned.
    - BR_04 – Email Assigned To Person 1 Day before Valid Date.
    - BR_05 – Email Assigned To Person 7 Days before Valid Date.
    
    1.  Document Revision Record
        1.  Document Revision Record Diagram

- - 1.  Document Revision Record Workflow
- A new Document Revision is created by the user selected in Author field while the parent Document is in an active or editable state.
- The record initially starts in the Draft state.
- The Author completes the required fields and can perform one of the following actions:
    - Cancel – the system requires the Activity Summary field to be filled in; the record then moves to Closed – Cancelled.
    - Upload to Microsoft Office Online – Author uploads the document to the Office Online by clicking this button to allow users to edit the main document.
    - Edit File Online – Author and Co-Authors can make changes in the main document online before proceeding the record through workflow.
    - Submit Revision – The DCO and Author perform this action (After the Author/Co-Author uploads the document to Microsoft Office Online and completes the editing process); the record then proceeds to the Pending Review state. Approval will need an electronic signature.
- According to BR_DOCR01 (Submit), when the first revision is initiated, the parent Document is automatically progressed to the Active state.
- In the Pending Review state, assigned Reviewers evaluate the content.
- Reviewers can perform followings:
    - Reject – the system requires the Activity Summary and electronic signature; the record returns to Draft.
    - Complete Review – Moves the record to Pending Approval. Review will need electronic signature.
- When the review is completed, the record moves to the Pending Approval state.
- Assigned Approver review the revision and can either:
    - Reject – the system requires the Activity Summary and electronic signature; the record returns to Draft.
    - Approve – progresses the record to the Pending Training state if training is required, or directly to Ready for Publishing if training is not required. Approval will need electronic signature.
- The system automatically generates a PDF rendition in the Pending Approval states. This PDF will be visible directly in the Document tab, allowing reviewers and approvers to preview and download the completed document.
- The Pending Approval state is locked; no fields can be modified while approval is in progress.
- After approval is completed, if training is required, the record progresses to the Pending Training state.
- In Pending Training, the responsible user ensures training completion the coordinator is responsible for entering the Training Planned Date and Training Period End Date. After the Training Planned Date is entered, the system will automatically send the training information to the personnel in the Distribution List. After the training is actually completed, the DCO will enter the Training Completion Date; once the user clicks the Training Completed button, BR_TRG07 (Training Completed) transitions the record to Ready for Publishing.
- In Ready for Publishing, the system locks the record and waits for the publishing action.
- The Publish activity is electronically signed (ES required) and moves the record to the Effective state.
- When the record reaches Effective, the system performs the following based on business rules:
    - BR_DOCR06 – PDF Rendition: Converts the attached Word document to PDF automatically.
    - BR_DOCR11 – Link to Knowledge: Creates a Knowledge Base article linked to the published revision.
    - BR_DOCR02 – Obsolete Opened Revisions: Marks all older open revisions of the same document as Obsoleted.
- The Effective state is locked and not editable.
- When the document revision becomes outdated, the Obsolete activity is initiated.
- During Obsolete, the system requires an Activity Summary.
- Upon completion, the record moves to the Obsoleted state.
- BR_DOC02, BR_DOCR06, and BR_DOCR11 are applied automatically during obsolescence to update related references and status of older revisions.
- All Closed States are locked, and no edits are allowed.
- Throughout the entire process, the system triggers General Business Rules (BR_01 – BR_05) for email notifications at assignment, re-assignment, due-date population, and reminders (1 day / 7 days before Due Date).
    - BR_01 – Email to Assigned Reviewer on Pending Review State.
    - BR_02 – Email to Assigned Approver on Pending Approve State.
    - BR_03 – Email to Assigned Distribution List on Pending Training State.
    - BR_04 – Email Assigned To Person 1 Day before Valid Date.
- BR_05 – Email Assigned To Person 7 Days before Valid Date.In Periodic Review Notification (Days) field, user can setup the warning time.
- Document Revision Business Rules:
    
    - BR_DOC02- Obsolete Revisions: Obsoletes all related opened revisions when the parent Document is obsoleted.
    - BR_DOCR01- Active Document: Progresses the parent Document record to the Active state when the first revision is initiated.
    - BR_DOCR02 - Obsolete Opened Revisions: Obsoletes all related opened revisions when a document revision is published.
    - BR_DOCR06 - PDF Rendition: Renders the WORD attachment in the Document Revision record to PDF when one of the 2 following scenarios occur:  
        \- Doesn't Require Training: The Document Revision is progressed to the Ready for Publishing state  
        \- Requires Training: The Document Revision is progressed to the Pending Training state
    - BR_DOCR11 - Link to Knowledge: Creates a Knowledge article in the Knowledge Base that is specified in the parent Document record when the Document Revision is published
    - BR_DOCR16 - Revision Obsoleted: Obsoletes all the older revisions once a revision is published.
    
    1.  Controlled Copy Record
        1.  Controlled Copy Record Diagram

- - 1.  Controlled Copy Record Workflow
- When a controlled copy is requested, the Controlled Copy record start the workflow in the Ready for Distribution state. At this state, the Recall Date and Reason for Recall Date fields are not available for data entry.
- Once the DCO distributes the controlled copy and the record transitions to the Distributed state, the Recall Date and Reason for Recall Date fields become available and can be populated.
- If the associated document revision becomes obsolete, the Controlled Copy record automatically transitions to the Obsolete state. If the Recall Date and Reason for Recall Date fields were not completed while the record was in the Distributed state, they can still be populated in the Obsolete state.
- When the Cancel activity is initiated, the system requires the Activity Summary to be completed.
- Upon completion of the Cancel activity, the record moves to the Closed – Cancelled state.
- From the Ready for Distribution state, the Distribute activity is performed by the DCO to send the controlled copy to the distribution list. Distribution List can be displayed in order to see the final list of users for this Controlled Copy before proceed. Providing a comment is mandatory before publishing the distribution list.
- According to BR_CON01 (Request a Copy), a controlled copy of the related effective revision is generated.
    - The controlled copy becomes available for download via an email link for 8 hours after the request is made.
- After successful distribution, the record transitions to the Distributed state.
- The Distributed state is locked, and no further edits are allowed.
- When the related Effective Revision becomes obsolete, BR_CON02 (Revision Obsoleted) automatically obsoletes the controlled copy record.
- The record then moves to the Obsoleted state.
- The Obsoleted state is locked and not editable.
- All Closed and Obsoleted records are locked, preventing any modifications.
- Throughout the workflow, automatic email notifications are triggered according to the General Business Rules (BR_01 – BR_05):
    
    - BR_01 – Email Assigned Distribution List once Distribute.
    - BR_02 – Email DCO Person once record on Ready for Distribution state.
    - BR_03 – Email Opened by Person & DCO Person once record on Obsolete state.
    
    1.  Uncontrolled Copy

- The system supports the generation and downloading of uncontrolled copies for informational, training, or temporary reference purposes.
- Authorized users can directly download an uncontrolled copy from the document record or the Knowledge portal. The system generates a PDF version of the currently effective document marked as “Uncontrolled Copy.”
- Uncontrolled copies are not managed or tracked in the same manner as controlled copies and are not subject to standard distribution control processes. These copies are intended for temporary or reference use only.
- Since uncontrolled copies are downloaded directly by users, there is no approval workflow, distribution list, or obsolete notification process associated with uncontrolled copies.
- The uncontrolled copy reflects the current approved/effective version of the document at the time of generation.

- 1.  Legend

1.  Data Fields
    1.  Document Numbering Rules

Document types wlil be reflected with following abbreviations while document code creation:

|     |     |
| --- | --- |
| **Document Type** | **Abbreviation** |
| Guideline | GUI |
| Instruction (Working Instruction, Drafting Instruction) | INS |
| Quality Manual | QMA |
| Standard Operating Procedure | SOP |
| Site Master File | SMF |
| Forms | FRM |
| Addendum / Annex / Appendix | APD |
| User Requirement Specification | URS |
| Design Qualification Protocol and report | DQPR |
| Factory Acceptance Testing /Site Acceptance testing protocol and report | FATPR/SATPR |
| Installation Qualification Protocol and Report | IQPR |
| Operational Qualification Protocol and Report | OQPR |
| Performance Qualification Protocol and Report | PQPR |
| Process Validation Protocol and Report | PVPR |
| Cleaning Validation Protocol and Report | CVPR |
| Record | REC |
| Contamination Control Strategy | CCS |
| Cross Contamination Risk Management Program | QRM |
| Specification | SPC |

Document Codes will be assigned by the system as;

**XXX-YYYY**

**XXX:** Document Type Abbreviation (Assigned by the system based on the abbreviations table above)

**YYYY:** Number of document (From 0001 to 9999, assigned by the system in sequence)

- 1.  Document Data Fields

| **Data Field** | **Field Type** | **Mandatory\*** | **Locked\*\*** | **Single/**<br><br>**Repeating** |
| --- | --- | --- | --- | --- |
| Document Number | String |     | x   | N/A |
| Created | Date/Time |     | x   | N/A |
| Opened by | Reference - User |     | x   | N/A |
| Author | Reference - User | **x** |     | Single |
| Co-authors | Reference - User | **x** |     | Repeating |
| Is Template? | True/False |     |     | N/A |
| Business Unit | Reference - Business Unit | **x** |     | Single |
| Document Name | String | **x** |     | N/A |
| Title in Local Language | String |     |     | N/A |
| Department | Reference - Department | **x** |     | Single |
| Knowledge Base | Reference - Knowledge Base |     | x   | Single |
| Document Type | Reference | **x** |     | Single |
| Sub-Type | Reference |     |     | Single |
| Periodic Review Cycle (Months) | Integer | **x** |     | Single |
| Periodic Review Notification (Days) | Integer | **x** |     | Single |
| Effective Date | Date |     | x   | N/A |
| Valid Until | Date |     | x   | N/A |
| Language | Choice | **x** |     | Single |
| Review Date | Date |     |     | N/A |
| Description | String | **x** |     | N/A |
| Requires Training | True/False |     |     | N/A |
| Training Period (Days) | Integer | X (If Requires Training field is true) |     | N/A |
| Distribution List | Choice |     |     | Repeating |
| Manage Attachment | File Attachment |     |     | N/A |
| Obsoleted By | Reference - User |     | x   | N/A |
| Obsoleted On | Date/Time |     | x   | N/A |
| Cancelled By | Reference - User |     | x   | N/A |
| Cancelled On | Date/Time |     | x   | N/A |
| Activities |     |     | x   | N/A |
| Workflow Diagram |     |     | x   | N/A |
| Document Revisions |     |     | x   | Single |
| Reviewers |     |     | x   | Repeating |
| Approvers |     |     | x   | Single |
| Document Knowledges |     |     | x   | N/A |
| Controlled Copies |     |     | x   | N/A |
| Related Documents |     |     | x   | Repeating |
| Correlated Documents |     |     | x   | Repeating |

- 1.  Document Revision Data Fields

| **Data Field** | **Field Type** | **Mandatory\*** | **Locked\*\*** | **Single/**<br><br>**Repeating** |
| --- | --- | --- | --- | --- |
| Revision number | String |     | x   | N/A |
| Created | Date/Time |     | x   | N/A |
| Opened by | Reference - User |     | x   | N/A |
| Author | Reference - User |     | x   | Single |
| Co-authors | Reference - User |     | x   | Repeating |
| Revision Name | String |     | x   | N/A |
| Title in Local Language | String |     |     | N/A |
| Effective Date | Date |     | x   | N/A |
| Valid Until | Date |     | x   | N/A |
| Business Unit | Refernce - Business Unit |     | x   | Single |
| Notes | String |     |     | N/A |
| Additional Attachment | File Attachment |     |     | N/A |
| Document Name | Reference - Document |     | x   | N/A |
| Document Number | String |     | x   | N/A |
| Document Created | String |     | x   | N/A |
| Training Planned Date | Date |     | x   | N/A |
| Training Period End Date | Date |     | x   | N/A |
| Training Completion Date | Date |     | x   | N/A |
| Reviewers Name | Name |     | x   | N/A |
| Reviewers Signed On | Date/Time |     | x   | N/A |
| Approvers Name | Name |     | x   | N/A |
| Approvers Signed On | Date/Time |     | x   | N/A |
| Document Attachment | formatter |     | x   | N/A |
| Submitted By | Reference - User |     | x   | N/A |
| Submitted On | Date/Time |     | x   | N/A |
| Rejected By | Reference - User |     | x   | N/A |
| Rejected On | Date/Time |     | x   | N/A |
| Published By | Reference - User |     | x   | N/A |
| Published On | Date/Time |     | x   | N/A |
| Obsoleted By | Reference - User |     | x   | N/A |
| Obsoleted On | Date/Time |     | x   | N/A |
| Cancelled By | Reference - User |     | x   | N/A |
| Cancelled On | Date/Time |     | x   | N/A |
| Activities |     |     | x   | N/A |
| Workflow Diagram |     |     | x   | N/A |
| Working Notes |     |     |     | N/A |
| Document |     |     | x   | N/A |

\* Mandatory throughout the whole process  
\*\* Locked throughout the whole process

- 1.  Controlled Copies Data Fields

| **Data Field** | **Field Type** | **Mandatory\*** | **Locked\*\*** | **Single/**<br><br>**Repeating** |
| --- | --- | --- | --- | --- |
| Document Number | String |     | x   | N/A |
| Created | Date/Time |     | x   | N/A |
| Opened by | Reference - User |     | x   | N/A |
| Business Unit | Reference - Business Unit |     | x   | N/A |
| Name | String |     | x   | N/A |
| Document | String |     | x   | N/A |
| Document Revision | String |     | x   | N/A |
| Valid Until | Reference |     | x   | N/A |
| Revision Number | Reference |     | x   | N/A |
| Copy Number | Integer |     | x   | N/A |
| Total Copies Number | Integer |     | x   | N/A |
| Recall Date | Date |     |     | N/A |
| Delivered By | Choice |     |     | N/A |
| Comments | String | x   |     | N/A |
| Distribution | Choice | x   |     | Single |
| Suppliers/Customers | Choice |     |     | Single |
| Suppliers | List - Suppliers |     |     | Repeating |
| Customers | List - Customers |     |     | Repeating |
| Employees | List - Employees |     |     | Repeating |
| Groups | List - Groups |     |     | Repeating |
| Business Units | List - Business Units |     |     | Repeating |
| Departments | List - Curriculums |     |     | Repeating |
| Requested By | Reference - User |     | x   | N/A |
| Requested On | Date/Time |     | x   | N/A |
| Distributed By | Reference - User |     | x   | N/A |
| Distributed On | Date/Time |     | x   | N/A |
| Obsoleted By | Reference - User |     | x   | N/A |
| Obsoleted On | Date/Time |     | x   | N/A |
| Activities |     |     | x   | N/A |
| Workflow Diagram |     |     | x   | N/A |

- 1.  Document Management Fields Choice/Reference Values Table

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>Data Field</strong></p></th><th><p><strong>Field Type</strong></p></th></tr></thead><tbody><tr><td><p>Department</p></td><td><p>If Business Unit is selected as Operation Unit, values include:</p><ul><li>Human Resources &amp; Administrator</li><li>Injection WS</li><li>Logistics</li><li>Mechanical and Electrical</li><li>Technology Service</li></ul><p>If Business Unit is selected as Quality Unit, values include:</p><ul><li>Quality Assurance</li><li>Quality Control</li><li>Regulatory Affairs</li></ul></td></tr><tr><td><p>Document Type</p></td><td><p>Values include:</p><ul><li>Addendum / Annex / Appendix</li><li>Cleaning Validation Protocol and report</li><li>Contamination Control Strategy</li><li>Cross Contamination Risk Management Program</li><li>Design Qualification Protocol and report</li><li>Factory Acceptance Testing / Site Acceptance Testing Protocol and report</li><li>Forms</li><li>Guideline</li><li>Installation Qualification Protocol and report</li><li>Operational Qualification Protocol and report</li><li>Performance Qualification Protocol and report</li><li>Process Validation Protocol and report</li><li>Quality Manual</li><li>Specification</li><li>Site Master File</li><li>Standard Operating ProcedureUser Requirement Specification</li><li>Instruction (Working Instruction, Drafting Instruction)Record</li></ul></td></tr><tr><td><p>Sub-Type</p></td><td><p>If Document Type is selected as Guideline, values include:</p><ul><li>Guideline</li></ul><p>If Document Type is selected as Quality Manual, values include:</p><ul><li>Manual</li></ul><p>If Document Type is selected as Standard Operating Procedure, values include:</p><ul><li>Procedure</li></ul><p>If Document Type is selected as Instruction (Working Instruction, Drafting Instruction), values include:</p><ul><li>Work Instruction</li></ul></td></tr></tbody></table></div>

1.  Process Notifications
    1.  Non-Workflow Notifications

|     |     |     |
| --- | --- | --- |
| **System Activity** | **Notification Recipient** | **Role or Data Field** |
| Assign | Assigned To | Data Field |
| Re-assign | Assigned To | Data Field |

- 1.  Workflow Notifications

| **Prcoess** | **System Activity** | **Notification Recipient** | **Note** |
| --- | --- | --- | --- |
| Document Revision | Notify Reviewers | Document Reviewers | N/A |
| Document Revision | Notify Approvers | Document Approvers | N/A |
| Document | Notify Co Author Assigned | Document Co Author | N/A |
| Document | Notify Author Assigned | Document Author | N/A |
| Document Revision | Pending Training | Department Manager(s) selected in the Distribution List field on the parent document record | N/A |
| Document Revision | Periodic Review | Author and Co-Authors of the document revision record | Based on Periodic Review Notification (Days) field on the document record |
| Document | 7 Days Alert Before Valid Until Expiration / One Day Alert Before Valid Until Expiration | The recipients are the Author and Co-Authors of the document record and the Department Head of the department associated with the document record. | N/A |
| Controlled Copy | Distribute Copy | Distribution list users | N/A |
| Controlled Copy | Controlled Copy Request | Document coordinator | N/A |
| Controlled Copy | Notify Obsolete | Document coordinator and distribution list users | N/A |
| Document Revision | Document Revision Expired | Document coordinator, Document Reviewers and Document Approvers | N/A |

1.  Access Interfaces

Quality Forward Document Management provides two distinct access interfaces for document interaction within the system environment.

**Portal Interface:** This interface is designated for end users with read-only privileges. Users can access and view documents through the Portal; however, they are restricted from creating, modifying, or performing any workflow actions on the documents. The Portal serves as a controlled environment to ensure the integrity and security of approved content.

All documents will be visible in Documents page with only read-only permission.

Selected documents will be visible with limited metadata of document.

Main document will be visible with read-only permission.

**Main Environment Interface:** This interface is intended for authorized users with elevated access rights. Depending on their assigned roles and permissions, users operating in this environment are able to create, edit, review, and approve documents in accordance with defined workflows and organizational authorization structures. Access controls within this interface are configured to ensure compliance with applicable regulatory and quality management requirements.

Document Management, Document Revisions, Controlled Copies and Document Administration pages are visible under “All” tab in menu bar. Users will allow to reach the pages based on their user roles& rights.

All documents can be displayed under “All Documents”. Authors will be able to initiate new documents via using New button in this page.

Users will be able to display Document record and can see all document revisions, reviewers, approvers, document knowledges, controlled copies, related documents, controlled documents related with this main document.

1.  User Management
    1.  Create, update, and deactivate user accounts by admin role

The eQMS uses ServiceNow functionality to manage user accounts through the User \[sys_user\] table. The system ensures that each User ID is unique to an individual. The creation or use of shared/generic accounts is strictly prohibited to ensure that all electronic signatures are attributable to a specific person, maintaining data integrity in accordance with EU-GMP Annex 11. Authorized administrators can create new user accounts to grant system access, update existing accounts to reflect changes in responsibilities or organizational information, and deactivate accounts when access is no longer required.

Deactivation of a user account prevents system access while preserving historical data, audit trails, and electronic records associated with the user. User records are not deleted, ensuring data integrity and compliance with audit and regulatory requirements.

- 1.  Manage user attributes

Each user account contains configurable attributes that define the user’s identity and organizational context. These attributes include, but are not limited to, user name, email address, department, business unit, and manager.

User attributes are maintained by authorized administrators and are used by the system to support access control, workflow routing, notifications, and reporting. Updates to user attributes take effect immediately and are logged by the system for traceability.

- 1.  Assign predefined roles

Access to system functionality is controlled through predefined roles. Roles define the actions a user is authorized to perform within the system, such as document creation, review, approval, administration or view-only access.

Roles are assigned to users by administrators through role assignment mechanisms provided by ServiceNow. A user may have one or multiple roles, and role changes are applied dynamically without requiring user re-creation. All role assignments and changes are recorded for audit purposes.

- 1.  Manage user lifecycle activities

The system supports full user lifecycle management, including onboarding, role modification, temporary access changes, and offboarding. User lifecycle activities are managed by enabling, modifying, or deactivating user accounts and updating assigned roles as needed.Throughout the user lifecycle, the system maintains a complete audit history of user status changes, role assignments, and access modifications. This ensures traceability, accountability, and compliance with quality system and regulatory requirements.

1.  System Security
    1.  Authentication Design
        1.  User Authentication Mechanism

The eQMS uses ServiceNow’s native authentication framework, integrated with the customer’s corporate identity provider (e.g., SSO/LDAP/AD/IDP) where applicable. Each user is uniquely identified by a personal account and is granted access based on role and authorization approved by Quality and IT.

Multi-Factor Authentication (MFA) is supported and can be enforced through the integrated identity provider as part of the organization’s security policies. The users are required to complete an additional authentication step beyond username and password to access the system, such as a mobile authenticator application or a one-time passcode (OTP).

No generic accounts are used for GMP-relevant activities, except for technically justified service accounts that are documented, controlled, and monitored.

- 1.  Password Rules

For locally authenticated users (where SSO is not used), the following password policies are enforced via ServiceNow’s security configuration:

- **Minimum length:** 8–12 characters (configurable, typically 12 for GMP environments)
- **Complexity:** Combination of upper- and lower-case letters, numbers, and at least one special character
- **Prohibited values:** Password may not contain the user’s login name or easily guessable words (e.g., “password,” company name)
- **Reuse prevention:** Last _N_ passwords (e.g., 5) are remembered and cannot be reused
- **Expiry:** Passwords expire at a defined interval (e.g., every 90 days) in line with company IT security policy
- **Change on first login / reset:** Users must change system-generated or reset passwords on first logon

All password rules are defined and enforced centrally in ServiceNow and documented in the eQMS System Configuration Specification.

- 1.  Account Lockout

To mitigate brute-force attacks and unauthorized access attempts:

- **Failed login threshold:** After a configurable number of consecutive failed login attempts (e.g., 5), the account is automatically locked.
- **Lockout duration:** The account remains locked for a defined period (e.g., 15–30 minutes) or until manually unlocked by an authorized system administrator per SOP.
- **Notification / logging:** All failed login attempts and lockout events are recorded in the security logs and are available for review by IT / Security.

These measures align with GMP expectations to prevent unauthorized access and ensure traceability of access attempts.

- 1.  Session Management and Timeout

To reduce the risk of unauthorized access from unattended terminals:

- **Inactivity timeout:** User sessions are automatically terminated after **30 minutes of inactivity**. Inactivity is defined as no user interaction (e.g., no clicks, navigation, or data entry) within the session.
- **Re-authentication:** After timeout or manual logoff, access to the eQMS requires re-authentication using valid credentials/SSO.
- **Concurrent sessions:** The platform can be configured to limit or control concurrent sessions per user, according to customer policy.

The session timeout is documented as a GMP-relevant parameter and verified in system testing.

- 1.  Security Design
        1.  Transport Layer Security (SSL/TLS)

All communication between end-user devices and the ServiceNow-based eQMS is protected using industry-standard **HTTPS over TLS**:

- **Encrypted communication:** All data in transit is encrypted with strong ciphers (TLS 1.2+ or as per current corporate security standard).
- **Certificates:** Server certificates are issued by a trusted Certificate Authority. Certificate validity is monitored and renewed according to IT procedures.
- **HSTS and secure cookies:** Where configured, HTTP Strict Transport Security (HSTS) and secure/HttpOnly cookies are used to reduce risk of session hijacking and man-in-the-middle attacks.

This ensures confidentiality and integrity of GMP data during transmission.

- - 1.  Access Control and Authorization

The eQMS uses **role-based access control (RBAC)** implemented via ServiceNow groups and roles:

- **Least privilege:** Users are granted only those permissions necessary for their job responsibilities (GMP principle of least privilege).
- **Segregation of duties:** Administrative roles (e.g., system admin, configuration manager) are segregated from business roles (e.g., QA reviewer, approver) where feasible.
- **Change control:** Creation, modification, or removal of roles and permissions is controlled via formal change management and approved by Administrator.
- **Periodic review:** User access rights are periodically reviewed and re-certified according to internal SOPs.
    - 1.  Access Logs / Security Logs

ServiceNow maintains detailed **access and security logs** that capture:

- Successful and failed login attempts
- Session start and end times
- Lockout events and administrative actions on user accounts (including creation, deactivation, and role/permission modifications).
- Changes to key configuration and security settings

These logs are:

- Time-stamped using a synchronized system time source to ensure accuracy and prevent manual tampering.
- Protected from unauthorized modification or deletion by any user role, including System Administrators.
- Retained for a defined period in line with company policies and regulatory requirements, ensuring full availability for audit purposes.

Access to security logs is restricted to authorized personnel. Periodic reviews are performed by IT team and overseen by Quality Assurance according to internal SOPs to identify and investigate potential security breaches or unauthorized activities based on SOPs.

- - 1.  Time synchronization

The ServiceNow instance uses the platform’s centralized system time, which is managed and maintained by the ServiceNow infrastructure. The system time is synchronized with standard time servers within the ServiceNow cloud environment to ensure consistent and accurate timestamps across the platform.

System administrators from the customer organization do not have the ability to modify the system time through the user interface or application configuration. Time settings are controlled exclusively by the ServiceNow platform infrastructure.

As a result, all system-generated timestamps, including those recorded in the Audit Trail, are automatically applied by the platform and cannot be altered by users or customer administrators. This ensures that audit trail records remain accurate, consistent, and protected from manipulation, supporting data integrity requirements.

- - 1.  Audit Trail of GMP-Relevant Actions (Including View Actions)

For GMP-relevant records managed within the **Document Management module** ():

- **Audit trail activation:** Audit functionality is enabled for the relevant tables and fields associated with document records and document metadata within the module.
- **Captured data:** For each relevant creation, modification, or update, the audit trail records:
    - User ID
    - Date and time (with time zone)
    - Old and new values (where applicable)
    - Type of action (create, update, delete)
- **Tracked Document Lifecycle Actions**  
    The audit trail records key document lifecycle activities, including but not limited to:
- Document creation
- Document revision or metadata update
- Workflow status changes (e.g., draft, under review, approved, effective, obsolete)
- Document approval actions
- Document retirement or obsolescence
- **Non-modifiability:** Audit trail records are system-generated and cannot be modified or deleted by standard users through the application interface. Access to audit data is restricted according to user roles and permissions.
- **Availability for review:** Admin user can retrieve and review audit trail information via system reports and dashboards, supporting investigations and inspections.

These mechanisms support GMP and data integrity expectations (ALCOA+ – Attributable, Legible, Contemporaneous, Original, Accurate).

1.  System Administration Console

The System Administration Console refers to the administrative capabilities available within the system for configuration and management.

Admin users have access to dedicated management functions through the system menu, including:

- User and role management
- Configuration of system settings and properties
- Management of access controls and permissions
- Dedicated management pages such as Approver Management and Reviewer Management, where admin users can define and maintain the predefined user lists

These capabilities allow the customer to manage the system independently without requiring ongoing technical support for routine configuration changes.

1.  Saved Searches

The system allows users to create Saved Searches by defining filters within the search forms (for example, document lists or revision lists). Once the desired criteria are set, the user can save the search and assign it a name. The system then generates a reusable link representing the configured query.

When saving the search, the visibility is defined as follows:

• Private Link – can be created by all users and is visible only to the user who created it, intended for personal use.

• Public Link – can be defined only by Admin users and is visible to all authorized users in the system. This is typically used to share common queries or standard views.

It is important to note that access to data is still controlled by user permissions. Even when using a public link, users will only see records they are authorized to access.

Users can manage their own saved searches (edit/delete), while public links are managed by Admin users.

1.  Dashboards

Dashboard functionality of the Quality Forward application provides users with a visual overview of key performance indicators (KPIs), process metrics, and document-related statistics in real time. This feature is designed to facilitate data-driven decision-making, continuous improvement, and proactive monitoring of quality processes.

Dashboards display aggregated data retrieved from the modules. Information is presented through configurable visual components such as charts, graphs, and status indicators. The data displayed on each dashboard is dynamically updated according to user roles, access rights, and predefined filters to ensure that users only view information relevant to their authorization level.

Authorized users can personalize their dashboard layout by selecting widgets, defining preferred metrics, or applying filters, depending on the system configuration. All dashboard configurations and data retrieval activities are subject to system audit logging to maintain traceability and compliance with applicable quality and regulatory standards.

The dashboard screen presented above provides an integrated overview of document management activities within the Quality Forward application. It displays a consolidated list of document revisions with key attributes such as revision name, document name, current state, effective date, and validity period, allowing users to quickly assess the status of controlled documents (e.g. Draft, Ready for Publishing, Effective, Rejected, Obsoleted). In addition, the dashboard includes graphical representations such as bar charts and pie charts illustrating the distribution of effective documents by document type. These visual components enable users to easily identify document type trends, monitor document lifecycle statuses, and gain insight into the overall document landscape, thereby supporting effective document control, compliance monitoring, and management oversight.

1.  Reporting

The Reporting functionality of the Quality Forward application enables administrators to generate, view, and export predefined and ad-hoc reports based on the data stored within the system. This feature is designed to support operational monitoring, quality management, and compliance reporting requirements. The administrator selects the relevant data table associated with the Document Management module and defines the report configuration, including:

Data source (e.g., document records table)

Fields to be displayed in the report

Filters and conditions (e.g. document type, revision number)

Sorting and grouping criteria

Visualization format (list, chart, or Bar)

Once configured, the reports can be added to a system dashboards

Reports can be generated according to user roles and permissions to ensure data confidentiality and integrity. The system retrieves data from validated data sources within the application database, applying predefined filters, parameters, and formatting rules as configured by system administrators.

Generated reports can be displayed on-screen or exported in various formats (e.g., PDF, Excel) in accordance with user privileges. All reporting activities, including report generation and export actions, are recorded in the system audit trail to ensure traceability and regulatory compliance.

1.  Data Security and Data Governance

The system complies with the data integrity and security requirements defined under 21 CFR Part 11, ensuring that all electronic records and related information are protected against unauthorized access, alteration, or deletion. Access controls, audit trails, and secure authentication mechanisms are implemented to maintain compliance and traceability.

Audit Trail will be include the following information of the activities:

User Name, Date/ Time, Type of Change, Data Before, Data After.

This feature utilizes the standard out-of-the-box capabilities of the ServiceNow platform. Upon enabling the Auditing attribute for the designated tables and fields, the system automatically captures transaction details. This requirement is met through native platform functionality, requiring no additional customization.

The Audit Trail function is permanently enabled and cannot be disabled under any circumstances by any user role.

All application data, including document metadata and attachments, are stored and managed within the ServiceNow platform, which is responsible for ensuring the security, confidentiality, and integrity of stored information. Data can be downloaded at the end of each month according to the contract.

Regular automated backups are performed by the platform according to predefined retention and recovery policies to prevent data loss and support disaster recovery procedures.

The ServiceNow instance is hosted within the ServiceNow cloud infrastructure and operates under a Software-as-a-Service (SaaS) model. Backup and recovery operations are managed at the platform level by ServiceNow.

Regular automated backups of the ServiceNow instance are performed by the platform as part of standard operational procedures. These backups include system databases, application data, configuration settings, and attachments stored within the instance.

Backups are executed according to predefined retention and recovery policies maintained by ServiceNow. Backup data is stored in secure and redundant storage environments within the ServiceNow cloud infrastructure.

The platform utilizes data replication and geographically distributed data centers to support system availability and disaster recovery capabilities. In the event of system failure or data corruption, the ServiceNow operations team can restore the instance or relevant data components from the most recent valid backup in accordance with platform recovery procedures.

As backup management is controlled by the ServiceNow platform, customer administrators do not have the ability to modify, disable, or directly manage the backup mechanism through the application interface.

These controls help prevent data loss and support system recovery and business continuity.

Data governance principles, incorporating ALCOA+ standards, are applied throughout the system lifecycle, ensuring that data is handled consistently, securely, and in accordance with regulatory and organizational standards.