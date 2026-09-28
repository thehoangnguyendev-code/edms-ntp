**Document Management**

**Functional Requirements Specification**

**Table of Contents**

[**1** **Revision History** 3](#_Toc224727848)

[**2** **Introduction** 4](#_Toc224727849)

[**4** **Process Description** 5](#_Toc224727850)

[**5** **References** 6](#_Toc224727851)

[**6** **Regulatory Requirements** 6](#_Toc224727852)

[**7** **Operational Requirements** 8](#_Toc224727853)

[**8** **Process Requirements** 10](#_Toc224727854)

[**8.1** **User Roles** 10](#_Toc224727855)

[**User Roles** 10](#_Toc224727856)

[**8.2** **Workflow** 11](#_Toc224727857)

[**8.3** **Document - Data Fields** 17](#_Toc224727859)

[**8.4** **Document Revision - Data Fields** 18](#_Toc224727860)

[**8.5** **Controlled Copies - Data Fields** 20](#_Toc224727861)

[**8.6** **Document Management Fields Choice/Reference Values Table** 21](#_Toc224727862)

[**8.7** **Process Notifications (Non Workflow)** 23](#_Toc224727863)

[**8.8** **Requirements** 24](#_Toc224727865)

**Document Review & Approval**

**Prepared By:**

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

**Reviewed By:**

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

**Approved By:**

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|     |     |     |     |     |
| Name / Title |     | Signature |     | Date |

# 

# **Revision History**

|     |     |     |     |
| --- | --- | --- | --- |
| **Version** | **Prepared By** | **Date** | **Change Summary** |
| 01  | Çağla Çokar | xxx | First initial |

# **Introduction**

The objective of this document is to give a brief overview of the business process that the Document Management module of the Quality Forward eQMS application will support. This Functional Requirements Specification (FRS) will also describe the user requirements for this specific module, along with any constraints and requirements for the information technology environment in which it will be placed.

This document should be used as the basis for planning Performance Qualification (PQ), training of end users, and the development of user manuals specifically for the Document Management processes..

1.  **Application Description**

Almost every type of operation, whether performed by an individual or a group of people requires some sort of tracking procedure for it to succeed. Whenever goals are set, tracking the progress towards these goals is of great importance. By tracking a process, all the people involved can tell what stage the process is in at any given moment, how much work has already been done, and what still remains to be done

The Quality Forward application is designed to be a fully integrated and extremely configurable tracking system used for managing any event or Action Item, including, but not limited to, problem reports, bugs/defects, change requests, customer Complaints, Investigations, audit observations, and Corrective Actions.

Any tracking mechanism will need a basic building block. It should contain a variety of descriptive fields, and it needs to have a unique identifier that will enable the system to distinguish it from all other building blocks. In the application, this building block is called a Record.

The principal objective of keeping track of tasks is to be able to know the status of the task at any given moment in time. A good tracking system should provide easy answers to questions such as: ‘How much progress was made on the task?’ ‘What is the status of this customer’s request?’ ‘Has problem X been resolved?’

Providing quick answers to such questions is of great importance, not only to managers and process leaders who need to prepare progress reports and the like, but also to team members and co-workers who can benefit greatly from coordinated work. The status of a Record is an important descriptor field, since it provides a qualifier that can immediately answer the aforementioned questions. Quality Forward calls this qualifier the Status of a Record.

The possible status of a Record can be pre-determined at each organization by the Quality Forward administrator. They describe the various stages in the life cycle of a Record. For example: ‘Opened’, ‘Work in Progress’, ‘Pending Approval’, ‘Closed’ and ‘Re-Opened’ are all possible Statuses that may exist for Records on the Quality Forward application.

The work that is done in order to move a Record from one Status to another, is best described in terms of actions. Examples of ‘Submit’, ‘Supervisor Review’, ‘Work in Progress’, ‘Quality Approval’, etc., are all appropriate descriptions of steps taken to further advance a certain Record. Accordingly, Quality Forward uses the term Action to describe actions that are taken in order to bring a Record closer to completion. Each Record can have many Actions performed during its life cycle. A group of Action types is defined as a Task. When all of the actions are performed, the Record will go through a Status change. The list of Actions posted becomes the Action History of the Record.

Posting an Action involves selecting from a pre-defined list of allowable Actions, which may vary depending on the Status the Record is in. Certain Actions advance the Record to the next Status, hopefully on towards its completion. At any Status, authorized users must have the option of sending the Record back to a _prior_ Status by posting an action. The order of actions is configurable based on the customer’s needs and is referred to as the “Workflow” for the specific business process.

The Quality Forward application interface will enable users to access centralized databases in real-time, allowing them to enter new Records, update status (via posting actions), query, and report information. Quality Forward will streamline the process and provide staff members and management with the necessary tools for achieving quick and timely resolutions and closure to problem and issue management.

Quality Forward is designed to be a configurable tracking system, as it is clear that the validation of customized code is time consuming, labor intensive and very expensive.

# **Process Description**

The Quality Forward application provides customers with an out-of the box configuration specifically designed for managing controlled documents within the Document Management Module. This configuration is built upon best practices derived from implementing electronic Quality Management Systems (eQMS) in highly regulated industries. Upon installation, customers have predefined workflows, forms, user roles, locked and mandatory fields, notifications, business rules, and reports already established to support document lifecycle management. The out-of-the-box Document Management Module offers:

- Simple configuration tailored for document control activities
- User-friendly interface for document creation, review, approval, and distribution
- Meet GxP and other regulatory requirements
- Provide scalable foundation for adding additional processes

# **References**

To define the objectives, scope, and procedures the following documents were used as references in the development of the following Functional Requirements.

\[1\] United States, Title 21 Code of Federal Regulations: Part 11 – Electronic Records; Electronic Signatures; Final Rule.

\[2\] URS.0020.01 User Requirement Specification

# **Regulatory Requirements**

The Quality Forward application is to be validated in accordance with current GMP. The following table represents the requirements from Title 21 of the United States Code of Federal Regulation Part 11 that are embedded within the core Quality Forward application and not specific to Quality Forward.

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Reg. Reference</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>11.10 a</p></td><td><p>Discern invalid or altered Records.</p></td><td><p>Audit Trail popup</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 a</p></td><td><p>Provide a mechanism that will identify Record modifications. The mechanism must be beyond the control of systems users and enabled at all times.</p></td><td><p>Audit Trail Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 b</p></td><td><p>Produce accurate and complete copies of the electronic Record in human readable form.</p></td><td><p>Printable Version Export</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 b</p></td><td><p>Export data and supporting regulatory information (i.e., audit information).</p></td><td><p>Printable Version Export</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 c</p></td><td><p>Retain data for long periods (throughout the Records retention period) – regardless of software or operating system upgrades.</p></td><td><p>Data is kept in system with no time limit</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 d</p></td><td><p>Allow restricted access in accordance with pre-defined rules.</p></td><td><p>Role-based access control (RBAC)</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 e</p></td><td><p>Capture information relevant to all Record creation, modification and deletion actions. Data to be Recorded minimally is time and date, unambiguous description of event and identity of operator. This Record must occur independently of operator control and once captured, must be unalterable. Time stamps will use server time.</p></td><td><p>Audit Trail Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 e</p></td><td><p>Retain original information if the Record is modified.</p></td><td><p>Audit Trail Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 e</p></td><td><p>Retain the Record’s audit trail throughout the retention of the Record.</p></td><td><p>Audit Trail Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 e</p></td><td><p>Retrieve the audit trail for review and copying.</p></td><td><p>Audit Trail Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 f</p></td><td><p>Enforce the sequence of operations when sequencing is required.</p></td><td><p>Workflow Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.10 g</p></td><td><p>To restrict use of system functions according to pre-defined procedures and internal processes.</p></td><td><p>Roles and ACLs</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.50</p></td><td><p>To ensure signed electronic Records contain information associated with the signing which clearly indicates all of the following:</p><p>1. the printed name of the signer</p><p>2. the date and time of the signing</p><p>3. the meaning (such as review, approval, authorship) associated with the signature</p><p>To control this information as other electronic Records. To show this information whenever the Record is shown, displayed or printed.</p></td><td><p>E-signature Tab &amp; Approval/Reviewer Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.70</p></td><td><p>Link the electronic signatures to their respective Records in a manner that would prohibit their modification, duplication or movement.</p></td><td><p>E-signature Tab &amp; Approval/Reviewer Tab</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.70</p></td><td><p>Enforce uniqueness of electronic signatures, prevent reallocation or duplication of electronic signatures, and prevent the deletion of information relating to the electronic signature once it has been executed.</p></td><td><p>Unique user identity + signature controls</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.200 (a)(1)</p></td><td><p>Require at least 2 distinct components of non-biometric electronic signatures.</p></td><td><p>Username + password authentication</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.200 (a)(1)(i)</p></td><td><p>Enforce that both electronic signature components are entered at least at the first signing, and following any break of system action.</p></td><td><p>Login page</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.200 (a)(1)(ii)</p></td><td><p>Enforce that both electronic signature components are entered at each signing when signings are not performed in a continuous session.</p></td><td><p>Signature re-entry enforcement</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.300 (b)</p></td><td><p>Enforce the periodic changing of passwords and the retention of the Record of historic use of an id/password combination after the combination has been rendered inactive.</p></td><td><p></p><p>Built in password management within software</p></td></tr><tr><td><ol><li></li></ol></td><td><p>11.300 (d)</p></td><td><p>Provide urgent and immediate notification of attempted unauthorized access and take preventative measures to prevent another (e.g., locking terminals, retaining access cards).</p></td><td><p>Account lockout + security alerts</p></td></tr></tbody></table></div>

# **Operational Requirements**

The core Quality Forward application will manage and maintain Records, and meet the following operational requirements:

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>The system will allow authorized users to create records and their associated children. Authorized users will be allowed to work in the system in parallel.</p></td><td><p>DMS record creation module</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will provide notifications to users upon initiation and assignment. The system supports integration with the email server for sending alerts and notifications, and notifications can be customized according to the sender’s needs.</p></td><td><p>Notification engine</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will support workflows for Records requiring action to be taken.</p></td><td><p>Workflow engine</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will segregate the display of information, edit or view based on a user’s privileges.</p></td><td><p>Role-based UI filtering</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will support the use of both system and user defined queries, delete and reload the previous queries. System will enable users to select the number of rows they want to show on the screen.</p></td><td><p>Query builder</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will support the use of detailed reports.</p></td><td><p>Reporting module</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will support to generation of report that are exportable in Excel, XLSX, PDF formats.</p></td><td><p>Report export service</p></td></tr><tr><td><ol><li></li></ol></td><td><p>System will support to create following reports:</p><p>-Distribution List</p><p>-Effective Documentation</p><p>-Employee Training Record</p><p>-Controlled Copy Tracking</p><p>-Training Sign-off Pending List</p></td><td><p>Predefined report library</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Assignees and their Managers will receive a notification when a record is past due.</p></td><td><p>Overdue notification service</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Assignees will receive a notification seven days prior to a record’s due date and one day prior to a record’s due date.</p></td><td><p>Due date reminder service</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will support the use of Electronic signatures.</p></td><td><p>E-Signature framework</p></td></tr><tr><td><ol><li></li></ol></td><td><p>All users will be able to login using a Unique ID and Password. System allows to deactivate/disable any user account in system.</p></td><td><p>Authentication service</p></td></tr><tr><td><ol><li></li></ol></td><td><p>All users will have access to Quality Forward dashboards showing, Open, Overdue Pending Record’s and Type Trend</p></td><td><p>Dashboard analytics</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall automatically log out inactive users after a defined inactivity period.</p></td><td><p>Session timeout control</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall terminate any duplicate sessions if the same user logs in from another browser or device.</p></td><td><p>N/A for current SaaS solutions</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall allow system administrators to configure platform parameters and install or deactivate functional modules as required.</p></td><td><p>System administration console</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall make specific records or fields read-only depending on their lifecycle state and user role.</p></td><td><p>State-based field control</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall implement record-level security, restricting access to records based on predefined authorization rules.</p></td><td><p>Record access control</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall provide data-grid functionalities such as sorting, filtering, column resizing, and Excel export while maintaining applied filters and order. Saved filters will be used for future. Users will be able to reset settings to the default.</p></td><td><p>Data-grid management</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall allow administrators and users to configure manual reminders with repeat options (daily, weekly, monthly, yearly).</p></td><td><p>Reminder scheduling module</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system shall allow users to select personal preferences such as date format, decimal format, and interface language.</p></td><td><p>User preference settings</p><p></p></td></tr></tbody></table></div>

# **Process Requirements**

## **User Roles****User Roles**

|     |     |     |
| --- | --- | --- |
| **User Req. No.** | **Requirement Description** | **System Function** |
| PR-1 | The system is able to provide a user role called Document Control Officer. This role will allow users to initiate and assign new Document Records as well as view existing Document Records. | Unlimited roles can be created in the system as needed |
| PR-2 | The system will provide a user role called View Only. This role will allow users to view existing effective(published) Document Records. | Unlimited roles can be created in the system as needed |
| PR-3 | The system is able to provide a user role called System Administrator. This role will allow full form and workflow access to Document Records for the purposes of system administration. | Unlimited roles can be created in the system as needed |
| PR-4 | The system is able to provide a user role called Author. This role will allow users to progress Document Revisions assigned to them within the defined workflow. | Unlimited roles can be created in the system as needed |
| PR-5 | The system is able to provide a user role called Co-Author. This role will allow users to collaborate on assigned Document Revisions. | Unlimited roles can be created in the system as needed |
| PR-6 | The system is able to provide a user role called Approver. This role will allow users to approve Document Revisions assigned to them within the defined workflow. | Unlimited roles can be created in the system as needed |
| PR-7 | The system is able to provide a user role called Reviewer. This role will allow users to review Document Revisions assigned to them within the defined workflow. | Unlimited roles can be created in the system as needed |

## **Workflow**The workflow for the Document Management process is in the following diagram.

  
  
  
  

**Legend**

## **Document - Data Fields**

| **Data Field** | **Field Type** | **Mandatory\*** | **Locked\*\*** | **Single/ Repeating** |
| --- | --- | --- | --- | --- |
| Document Number | String |     | x   | N/A |
| Created | Date/Time |     | x   | N/A |
| Opened by | Reference - User |     | x   | N/A |
| Author | Reference - User | x   |     | Single |
| Co-authors | Reference - User | **x** |     | Repeating |
| Is Template? | True/False |     |     | N/A |
| Business Unit | Reference - Business Unit |     |     | Single |
| Document Name | String | x   |     | N/A |
| Title in Local Language | String |     |     | N/A |
| Department | Reference - Department | x   |     | Single |
| Knowledge Base | Reference - Knowledge Base |     | x   | Single |
| Document Type | Reference | x   |     | Single |
| Sub-Type | Reference |     |     | Single |
| Periodic Review Cycle (Months) | Integer | x   |     | Single |
| Periodic Review Notification (Days) | Integer | x   |     | Single |
| Effective Date | Date |     | x   | N/A |
| Valid Until | Date |     | x   | N/A |
| Language | Choice |     |     | Single |
| Review Date | Date |     |     | N/A |
| Description | String |     |     | N/A |
| Requires Training | True/False |     |     | N/A |
| Training Period (Days) | Integer |     |     | N/A |
| Distribution List | Choice |     |     | Repeating |
| Manage Attachment | File Attachment |     | x   | N/A |
| Obsoleted By | Reference - User |     | x   | N/A |
| Obsoleted On | Date/Time |     | x   | N/A |
| Cancelled By | Reference - User |     | x   | N/A |
| Cancelled On | Date/Time |     | x   | N/A |
| Activities |     |     | x   | N/A |
| Workflow Attachment |     |     | x   | N/A |
| Document Revisions |     |     | x   | Single |
| Reviewers |     |     | x   | Repeating |
| Approvers |     |     | x   | Single |
| Document Knowledges |     |     | x   | N/A |
| Controlled Copies |     |     | x   | N/A |
| Related Documents |     |     | x   | Repeating |
| Correlated Documents |     |     | x   | Repeating |

## **Document Revision - Data Fields**

| **Data Field** | **Field Type** | **Mandatory\*** | **Locked\*\*** | **Single/ Repeating** |
| --- | --- | --- | --- | --- |
| Revision number | String |     | x   | N/A |
| Created | Date/Time |     | x   | N/A |
| Opened by | Reference - User |     | x   | N/A |
| Author | Reference - User |     |     | Single |
| Co-authors | Reference - User |     |     | Repeating |
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
| Approver Name | Name |     | x   | N/A |
| Approver Signed On | Date/Time |     | x   | N/A |
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
| Workflow Attachment |     |     | x   | N/A |
| Working Notes |     |     |     | N/A |
| Document |     |     | x   | N/A |

\* Mandatory throughout the whole process  
\*\* Locked throughout the whole process

## **Controlled Copies - Data Fields**

| **Data Field** | **Field Type** | **Mandatory\*** | **Locked\*\*** | **Single/ Repeating** |
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
| Comments | String |     |     | N/A |
| Distribution | Choice |     |     | Single |
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
| Workflow Attachment |     |     | x   | N/A |

## **Document Management Fields Choice/Reference Values Table**

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>Data Field</strong></p></th><th><p><strong>Field Type</strong></p></th></tr></thead><tbody><tr><td><p>Department</p></td><td><ul><li>If Business Unit is selected as Operation Unit, values include:</li><li>Human Resources &amp; Administrator</li><li>Injection WS</li><li>Logistics</li><li>Mechanical and Electrical</li><li>Technology Transfer</li><li>If Business Unit is selected as Quality Unit, values include:</li><li>Quality Assurance</li><li>Quality Control</li><li>Regulatory Affairs</li></ul><p></p></td></tr><tr><td><p>Type</p></td><td><p>Values include:</p><ul><li>Addendum / Annex / Appendix</li><li>Cleaning Validation Protocol and report</li><li>Contamination Control Strategy</li><li>Cross Contamination Risk Management Program</li><li>Design Qualification Protocol and report</li><li>Factory Acceptance Testing / Site Acceptance Testing Protocol and report</li><li>Forms</li><li>Guideline</li><li>Installation Qualification Protocol and report</li><li>Operational Qualification Protocol and report</li><li>Performance Qualification Protocol and report</li><li>Process Validation Protocol and report</li><li>Quality Manual</li><li>Site Master File</li><li>Specification</li><li>Standard Operating Procedure</li><li>User Requirement Specification</li><li>Instruction (Working Instruction, Drafting Instruction)</li><li>Record</li></ul></td></tr><tr><td><p>Sub-Type</p></td><td><p>If Document Type is selected as Guideline, values include:</p><ul><li>Guideline</li></ul><p>If Document Type is selected as Quality Manual, values include:</p><ul><li>Manual</li></ul><p>If Document Type is selected as Standard Operating Procedure, values include:</p><ul><li>Procedure</li></ul><p>If Document Type is selected as Instruction (Working Instruction, Drafting Instruction), values include:</p><ul><li>Work Instruction</li></ul></td></tr></tbody></table></div>

## **Process Notifications (Non Workflow)**

| **System Activity** | **Notification Recipient** | **Role or Data Field** |
| --- | --- | --- |
| Assign | Assigned To | Data Field |
| Re-assign | Assigned To | Data Field |

8.8 Workflow Notifications

| **Process** | **System Activity** | **Notification Recipient** | **Note** |
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

## **Requirements**

**Creation and Initiation of a Document Record**

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>A user will be able to create a Document Record by clicking on the New button at the top of the Documents list.</p></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>A user will be able to create a new Document record by clicking Create a Copy button. Created copy will be in Draft stage.</p></td><td><p>Create a Copy button in New Document Creation Page</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Creation of documents in different types will be possible.</p></td><td><p>Users are able to change document type after copying.</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Document number will be customized based on document type.</p><p>XXX- YYY</p><p>XXX – Document type (QMS,FATP, FATR, SOP…)</p><p>YYYY- Number of document from 0001 to 9999 given by system</p><p></p></td><td><p>Document Administration</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The system will support the automatic launch of client applications to edit the document content depending on the format of the template.</p></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The following fields will be automatically populated:</p><ul><li>Opened by</li><li>Document Number</li><li>Created</li></ul></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The following fields are mandatory and must be populated prior to submitting the Document Record:</p><ul><li>Document Name</li><li>Business Unit</li><li>Author</li><li>Co-authors</li><li>Department</li><li>Document Type</li><li>Periodic Review Cycle(Months)</li><li>Periodic Review Notification(Days)</li><li>Description</li><li>Language</li><li>Selection of at least one reviewer and one approver</li></ul></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The following optional fields will be available for a user to populate if applicable:</p><ul><li>Sub - Type</li><li>Is Template?</li><li>Requires Training?</li></ul></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When leaving a screen with unsaved input, the application will warn the user about potential data loss.</p></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>A user will be able to perform the Save activity.</p></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>After the Save activity is performed, the following fields will be automatically populated:</p><ul><li>Document Number</li><li>Created</li></ul></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Two buttons will appear: <em>Reviewers</em> and <em>Approvers</em>. The user can click on either button to add users to the respective list.</p></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Selecting multiple reviewers will be possible. Only one approver selection will be possible.</p></td><td><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>System will support to create documents with different document types as part of system setup.</p></td><td><p>Document Administration</p><p>New Document Record Creation workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Configuring automated notification during workflow and special cases will be possible.</p></td><td><p>Unlimited notifications can be configured</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Documents will be visible in folder structure based on record type.</p></td><td><p>Knowledge base view</p></td></tr></tbody></table></div>

**Cancelation of a Document Record**

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>A user will be able to cancel a Document Record by clicking on the Cancel button .</p></td><td><p>Cancel button in New Document Creation Page</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The Cancel activity progresses the Document record state to Closed-Cancelled.</p></td><td><p>Cancel button in New Document Creation Page</p></td></tr></tbody></table></div>

**Uploading a Document**

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>A user will be able to Upload a Document by clicking on the Upload Revision button.</p></td><td><p>Upload revision button in new document creation page</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When the user clicks on the Upload Revision button, a window will appear. The user will be able to choose the Document and Upload it by clicking on the OK button.</p></td><td><p>Upload Revision window</p></td></tr><tr><td><ol><li></li></ol></td><td><p>A user will be able to Create a Document from a Template by selecting the desired Template in the Template field when uploading or creating a new Document. The system must support the preview of templates before selecting templates for document creation.</p><p></p></td><td><p>Upload Revision window</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When the user selects the Template and clicks on the OK button, the system will create the new Document based on the selected Template.</p></td><td><p>Upload Revision window</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When a Document is uploaded, a new Document Revision record is created, and the Document record state will automatically advance to the state of Active. The document revision record will be in a minor version (such as 0.0.1), and once it becomes effective, it will take a major version (such as 1.0.0).</p></td><td><p>Document Record and Document Revision Record</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The following fields in the Related Record - Document Revision below will automatically be populated when a Document Revision record is created:</p><ul><li>Revision Name</li><li>Revision Number</li><li>Author</li><li>Opened By (The person who Created the record)</li><li>Effective Date</li><li>Valid Until</li><li>Created (with the Time and Date that the record has created)</li><li>Business Unit</li></ul></td><td><p>Document Revision Record</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The lifecycle of document revision will consist the following life cycle states: Draft, Pending Review, Pending Approval, Pending Training, Ready For Publishing, Effective, Obsoleted, Closed-Cancelled.</p></td><td><p>Document Revision Record</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Users will be able to click Upload to Microsoft Office Online to start Document Revision process. After uploading main document to Microsoft office, authorized users will be able to Edit File during workflow.</p></td><td><p>Document Revision Record</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Users will be able to use Edit File Online button in Draft stages</p></td><td><p>Document Revision Record</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Users authorized in Pending Review and Pending Approval stages will be able to Reject the record.</p></td><td><p>Document Revision Record</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Rejected record stage will proceed to the Draft stage.</p></td><td><p>Document Revision Record</p></td></tr><tr><td><ol><li></li></ol></td><td><p>N/A (Excluded from the scope based on custom configurations)</p></td><td><p>N/A</p></td></tr><tr><td><ol><li></li></ol></td><td><p>N/A (Excluded from the scope based on custom configurations)</p></td><td><p>N/A</p></td></tr></tbody></table></div>

**Completing the Document Management**

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>The following fields will be populated automatically on the Document Revision record creation and will not be editable:</p><ul><li>Revision Name</li><li>Revision number</li><li>Author</li><li>Co-authors</li><li>Title in Local Language</li><li>Created</li><li>Bussines Unit</li><li>Revision Number</li><li>Opened By</li></ul><p></p></td><td><p>Document Revision record workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The DCO will be able to perform the Submit activity for changing the Document Revision record state to Ready for Publishing. Note: if there is a Reviewer or Approver to the document after performing the Submit activity the Document Revision record state will change to Pending Review/Pending Approval state.</p></td><td><p>Document Revision record workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>A user will be able to perform the Publish activity for changing the Document Revision record state to Effective only if it is approved by all the reviewers and approvers and the training is completed.</p></td><td><p>Document Revision record workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When the user performs the Publish activity, the Revision is Effective.</p></td><td><p>Document Revision record workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When a Revision is published, a new Knowledge Record is created.</p></td><td><p>Document Revision record workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The Publish activity will mandatory an electronic signature.</p></td><td><p>Document Revision record workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When the Publish activity is performed, the Published By and the Published On fields will be automatically populated with the name of the person who performed the activity and the date and time the activity was performed.</p></td><td><p>Document Revision record workflow</p></td></tr></tbody></table></div>

**Request Controlled Copy**

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>A user may request a Controlled Copy of a Document Revision when the revision is in the Effective state, by selecting the Request Controlled Copy link under the Related Links section.</p></td><td><p>Controlled Copy worklow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Document Authors will be allowed to request controlled copies.&nbsp;&nbsp;</p></td><td><p>Controlled Copy worklow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When the user clicks on the Request Controlled Copy link, a window will appear. In this window, the user can specify the recipients who will receive the Controlled Copy and confirm the action by clicking the OK button</p></td><td><p>Controlled Copy worklow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When performing the distribution of a Controlled Copy, the system must require entry of comments in the Comments field.</p></td><td><p>Controlled Copy worklow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>After clicking on the link, a new Controlled Copy record is created.</p></td><td><p>Controlled Copy worklow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>The following fields in the Related Document – Controlled Copy below will automatically be populated when a Controlled Copy record is created:</p><ul><li>Created</li><li>Document Number</li><li>Business Unit</li><li>Opened By (The person who Created the record)</li><li>Document</li><li>Document Revision</li><li>Copy Number</li><li>Total Copies Number</li><li>Valid Until</li><li>Revision Number</li><li>Distribution</li><li>Name</li></ul></td><td><p>Controlled Copy worklow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>A user will be able to perform the Distribute activity to move the Controlled Copy record state to Distributed.</p></td><td><p>Controlled Copy worklow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When a Document Revision is published, the system automatically calculates the Effective Date based on the Published Date or Training Completion Date (if training is activated) and the configured Effective Period.</p></td><td><p>Document Revision workflow</p></td></tr><tr><td><ol><li></li></ol></td><td><p>When the Distribute activity is performed, the people populated in the distribution list&nbsp;will receive a notification with the controlled copy details and a link to the PDF document. Distributed users will be able to export the document via this link.</p></td><td><p>Controlled Copy worklow</p></td></tr></tbody></table></div>

**General Requirements**

<div class="joplin-table-wrapper"><table><thead><tr><th><p><strong>User Req. No.</strong></p></th><th><p><strong>Requirement Description</strong></p></th><th><p><strong>System Function</strong></p></th></tr></thead><tbody><tr><td><ol><li></li></ol></td><td><p>The system shouldn’t enable the deletion of records from any state.</p></td><td><p>N/A</p></td></tr><tr><td><ol><li></li></ol></td><td><p>System will allow users be able to leave the application by logging out.</p></td><td><p>Log out functionality</p></td></tr><tr><td><ol><li></li></ol></td><td><p>System will allow users to edit record information only while in the Draft state. Once submitted for Review/Approval, all fields must be locked (except for some exceptional cases), and any further changes must be recorded in the Audit Trail.</p></td><td><p>Edit record button</p></td></tr><tr><td><ol><li></li></ol></td><td><p>System will enable live refresh of the values in dropdown input fields on all input forms after the values are updated in Admin module.</p></td><td><p>Data Management</p></td></tr><tr><td><ol><li></li></ol></td><td><p>System will ensure that a change made to the existing original template document does not affect the content and format of the documents created from the original template.</p></td><td><p>Document Revision</p></td></tr><tr><td><ol><li></li></ol></td><td><p>Documents will be connected with each other via Related and Corelated documents.</p></td><td><p>Document Record workflow</p></td></tr></tbody></table></div>