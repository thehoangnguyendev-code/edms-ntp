package com.eqms.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Every placeholder the senders of the system fill in, by module: the mail and notification builders (EmailNotificationService, AuthService),
 * the document, revision and workflow notifiers, the controlled and uncontrolled copy services, Training Management, the Knowledge Base, access
 * review, user management and Backup & Restore. A placeholder is listed here when some sender of that module supplies a value for it; the events
 * and the email messages add their own on top of these. Kept in code, beside the senders, so a new placeholder is added where it is first sent.
 */
public final class NotificationPlaceholderCatalog {

    public static final String GENERAL = "General";
    public static final String USERS = "Users and recipients";
    public static final String DOCUMENTS = "Document Control";
    public static final String WORKFLOW = "Workflow";
    public static final String CONTROLLED = "Controlled Copies";
    public static final String UNCONTROLLED = "Uncontrolled Copies";
    public static final String TRAINING = "Training Management";
    public static final String KNOWLEDGE = "Knowledge Base";
    public static final String SECURITY = "Security and Access";
    public static final String ACCESS_REVIEW = "Access Review";
    public static final String BACKUP = "Backup & Restore";
    public static final String PREFERENCES = "Preferences";
    /** What a placeholder that only an event or an email message uses is filed under. */
    public static final String OTHER = "Other";

    public record Entry(String name, String module, String label, String sample) {
    }

    private static final Map<String, Entry> ENTRIES = new LinkedHashMap<>();

    private static void one(String module, String name, String label, String sample) {
        ENTRIES.putIfAbsent(name, new Entry(name, module, label, sample));
    }

    static {
        // General
        one(GENERAL, "systemName", "System name", "EQMS");
        one(GENERAL, "companyName", "Company name", "Ngoc Thien Pharma");
        one(GENERAL, "currentDate", "Today's date", "12/11/2026");
        one(GENERAL, "currentDateTime", "Today's date and time", "12/11/2026 14:30:00");
        one(GENERAL, "currentTime", "The time now", "14:30:00");
        one(GENERAL, "publicAppUrl", "Address of the application", "https://eqms.example.com");
        one(GENERAL, "actionUrl", "Address the notification opens", "https://eqms.example.com/documents/sample");
        one(GENERAL, "changeSummary", "Summary of the change", "Updated the scope");
        one(GENERAL, "detail", "Details", "Details of the action");
        one(GENERAL, "entityName", "Name of the record the action was done on", "RS-20261112-0001");
        one(GENERAL, "actionName", "What was done, in words", "Report template disabled");
        one(GENERAL, "actionComment", "Comment given with the action", "Restore for the rehearsal");
        one(GENERAL, "title", "Title of the notice (composed by the module)", "Training: your action is needed");
        one(GENERAL, "message", "Text of the notice (composed by the module)", "Approve the training content of SOP.0003.");

        // Users and recipients
        one(USERS, "recipientName", "Recipient name", "Nguyen Van A");
        one(USERS, "recipientEmail", "Recipient e-mail", "a.nguyen@company.example");
        one(USERS, "recipientDate", "Date of the recipient's action", "12/11/2026");
        one(USERS, "userName", "User name (full name)", "Nguyen Van A");
        one(USERS, "username", "Username", "a.nguyen");
        one(USERS, "fullName", "Full name", "Nguyen Van A");
        one(USERS, "displayName", "Display name", "Nguyen Van A");
        one(USERS, "employeeCode", "Employee code", "NTP.0001");
        one(USERS, "userEmail", "User e-mail", "a.nguyen@company.example");
        one(USERS, "userDepartment", "User department", "Quality Assurance");
        one(USERS, "userPosition", "User position", "QA Manager");
        one(USERS, "userRole", "User role", "Document Controller");
        one(USERS, "businessUnit", "Business unit", "Manufacturing");
        one(USERS, "actorName", "Name of the person who acted", "Tran Thi B");
        one(USERS, "actorEmail", "E-mail of the person who acted", "b.tran@company.example");
        one(USERS, "actorRole", "Role of the person who acted", "QA Manager");

        // Document Control
        one(DOCUMENTS, "documentId", "Document id", "3f2a9c1e");
        one(DOCUMENTS, "reviewDate", "Periodic review date", "28/07/2026");
        one(DOCUMENTS, "reviewStatus", "Periodic review wording (is due ... on / is overdue ... since)", "is due for periodic review on");
        one(DOCUMENTS, "documentNumber", "Document number", "SOP.0001");
        one(DOCUMENTS, "documentTitle", "Document title", "Sample Document Title");
        one(DOCUMENTS, "documentUrl", "Document address", "https://eqms.example.com/documents/3f2a9c1e");
        one(DOCUMENTS, "documentVersion", "Document version", "02");
        one(DOCUMENTS, "documentStatus", "Document status", "Effective");
        one(DOCUMENTS, "documentAuthorName", "Document author", "Tran Thi B");
        one(DOCUMENTS, "documentAuthorEmail", "Document author e-mail", "b.tran@company.example");
        one(DOCUMENTS, "documentDepartment", "Document department", "Quality Assurance");
        one(DOCUMENTS, "documentBusinessUnit", "Document business unit", "Manufacturing");
        one(DOCUMENTS, "documentEffectiveDate", "Document effective date", "01/12/2026");
        one(DOCUMENTS, "documentReviewDate", "Document review date", "01/12/2028");
        one(DOCUMENTS, "documentValidUntil", "Document valid until", "01/12/2028");
        one(DOCUMENTS, "effectiveDate", "Effective date", "01/12/2026");
        one(DOCUMENTS, "revisionId", "Revision id", "9b1d2e7f");
        one(DOCUMENTS, "revisionName", "Revision name", "SOP.0001 v02");
        one(DOCUMENTS, "revisionNumber", "Revision number", "02");
        one(DOCUMENTS, "revisionTitle", "Revision title", "Sample Document Title");
        one(DOCUMENTS, "revisionStatus", "Revision status", "Pending review");
        one(DOCUMENTS, "revisionUrl", "Revision address", "https://eqms.example.com/revisions/9b1d2e7f");
        one(DOCUMENTS, "revisionEffectiveDate", "Revision effective date", "01/12/2026");
        one(DOCUMENTS, "revisionPublishedAt", "Revision published at", "30/11/2026 09:00:00");
        one(DOCUMENTS, "revisionPublishedBy", "Revision published by", "Tran Thi B");
        one(DOCUMENTS, "revisionValidUntil", "Revision valid until", "01/12/2028");
        one(DOCUMENTS, "officeEditUrl", "Address to edit online", "https://eqms.example.com/office/edit/9b1d2e7f");
        one(DOCUMENTS, "officeViewUrl", "Address to view online", "https://eqms.example.com/office/view/9b1d2e7f");

        // Workflow
        one(WORKFLOW, "workflowAction", "Workflow action", "Approve");
        one(WORKFLOW, "workflowComment", "Workflow comment", "Please review the new limits");
        one(WORKFLOW, "workflowReason", "Workflow reason", "Updated after the change control");
        one(WORKFLOW, "workflowScope", "Workflow scope", "Revision");
        one(WORKFLOW, "workflowStage", "Workflow stage", "Review");
        one(WORKFLOW, "participantType", "Role in the workflow", "Reviewer");
        one(WORKFLOW, "daysPending", "Days waiting", "3");
        one(WORKFLOW, "comment", "Comment", "Please check");
        one(WORKFLOW, "requestReason", "Reason of the request", "Needed for the audit");

        // Controlled Copies
        one(CONTROLLED, "controlledCopyId", "Controlled copy id", "5c7e1a40");
        one(CONTROLLED, "controlledCopyNumber", "Controlled copy number", "CC-0001");
        one(CONTROLLED, "controlledCopyStatus", "Controlled copy status", "Distributed");
        one(CONTROLLED, "controlledCopyUrl", "Controlled copy address", "https://eqms.example.com/controlled-copies/5c7e1a40");
        one(CONTROLLED, "controlledCopyPreviewUrl", "Controlled copy preview address", "https://eqms.example.com/controlled-copies/preview/abc");
        one(CONTROLLED, "controlledCopyBatchId", "Batch id", "b4d9");
        one(CONTROLLED, "batchNumber", "Batch number", "B-2026-014");
        one(CONTROLLED, "batchQuantity", "Quantity of the batch", "12");
        one(CONTROLLED, "copyNumber", "Copy number", "3");
        one(CONTROLLED, "copyCount", "Number of copies", "3");
        one(CONTROLLED, "totalCopies", "Total copies", "12");
        one(CONTROLLED, "expiryDate", "Expiry date", "31/12/2026");
        one(CONTROLLED, "expiryDateDisplay", "Expiry date (as shown)", "31/12/2026");
        one(CONTROLLED, "expiryReminderSentAt", "Expiry reminder sent at", "20/12/2026");
        one(CONTROLLED, "recallReason", "Recall reason", "Obsoleted when a newer revision was published");
        one(CONTROLLED, "recipientSignature", "Signature of the recipient", "Nguyen Van A");
        one(CONTROLLED, "witnessName", "Witness", "Le Van C");
        one(CONTROLLED, "destroyReason", "Destruction reason", "The copy is obsolete");
        one(CONTROLLED, "destroyedAt", "Destroyed at", "31/12/2026 10:00:00");
        one(CONTROLLED, "destroyedBy", "Destroyed by", "Le Van C");
        one(CONTROLLED, "destructionMethod", "Destruction method", "Shredding");
        one(CONTROLLED, "destructionType", "Destruction type", "Physical");
        one(CONTROLLED, "distributionComment", "Distribution comment", "Hand over in the QA office");
        one(CONTROLLED, "distributionList", "Distribution list", "QA, Production");
        one(CONTROLLED, "distributionLocation", "Distribution location", "Production line 2");
        one(CONTROLLED, "distributionScope", "Distribution scope", "Department");
        one(CONTROLLED, "locationCode", "Location code", "PL2");
        one(CONTROLLED, "dcoZipDownloadUrl", "Address to download the batch (zip)", "https://eqms.example.com/downloads/batch.zip");

        // Uncontrolled Copies
        one(UNCONTROLLED, "uncontrolledCopyId", "Uncontrolled copy id", "1a2b3c");
        one(UNCONTROLLED, "uncontrolledCopyNumber", "Uncontrolled copy number", "UC-0001");
        one(UNCONTROLLED, "validUntil", "Valid until", "31/12/2026");
        one(UNCONTROLLED, "issuedAt", "Issued at", "12/11/2026 14:30:00");
        one(UNCONTROLLED, "distributedAt", "Distributed at", "12/11/2026 14:30:00");
        one(UNCONTROLLED, "capturedAt", "Captured at", "12/11/2026 14:30:00");
        one(UNCONTROLLED, "downloadLink", "Address to download", "https://eqms.example.com/downloads/uc-0001");
        one(UNCONTROLLED, "externalRecipient", "External recipient", "Auditor, Example Ltd");

        // Training Management
        one(TRAINING, "trainingNumber", "Training number", "TRN/QA/26-501");
        one(TRAINING, "trainingDueDate", "Due date of the training", "30/11/2026");
        one(TRAINING, "requestNumber", "Training requirement number", "REQ/QA/26-003");
        one(TRAINING, "trainingPlannedDate", "Planned date of the training", "20/11/2026");
        one(TRAINING, "trainingPeriodEndDate", "End of the training period", "30/11/2026");
        one(TRAINING, "trainingCompletionDate", "Completion date of the training", "25/11/2026");

        // Knowledge Base
        one(KNOWLEDGE, "knowledgeBase", "Knowledge Base", "Knowledge Base");
        one(KNOWLEDGE, "itemLabel", "Item", "SOP.0001 Sample Document");
        one(KNOWLEDGE, "scopeName", "Scope", "Quality Assurance");
        one(KNOWLEDGE, "actionTitle", "Action title", "A document was shared");
        one(KNOWLEDGE, "actionText", "Action text", "shared the item with you");

        // Security and Access
        one(SECURITY, "roleName", "Role name", "Document Controller");
        one(SECURITY, "suspendReason", "Suspension reason", "Long leave");
        one(SECURITY, "suspendedAt", "Suspended at", "12/11/2026 08:00:00");
        one(SECURITY, "terminatedAt", "Terminated at", "12/11/2026 08:00:00");
        one(SECURITY, "terminationReason", "Termination reason", "Left the company");
        one(SECURITY, "tempPassword", "Temporary password", "Tmp#4821");
        one(SECURITY, "resetLink", "Address to reset the password", "https://eqms.example.com/reset-password?token=abc");
        one(SECURITY, "loginLink", "Address to sign in", "https://eqms.example.com/login");

        // Access Review
        one(ACCESS_REVIEW, "campaignName", "Campaign name", "Q3 Audit Trail Review");
        one(ACCESS_REVIEW, "dueDate", "Due date", "31/12/2026");

        // Backup & Restore
        one(BACKUP, "backupNumber", "Backup number", "BK-2026-0042");

        // Preferences
        one(PREFERENCES, "preferenceName", "Preference", "Email notifications");
        one(PREFERENCES, "preferenceSection", "Preference section", "Notifications");
    }

    private NotificationPlaceholderCatalog() {
    }

    /** The entry of a placeholder, or null when no module sends it. */
    public static Entry find(String name) {
        return name == null ? null : ENTRIES.get(name);
    }

    public static List<Entry> all() {
        return new ArrayList<>(ENTRIES.values());
    }
}
