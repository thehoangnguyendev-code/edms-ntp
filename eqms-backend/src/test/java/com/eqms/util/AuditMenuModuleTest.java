package com.eqms.util;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static com.eqms.util.AuditMenuModule.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** Plain unit test (no Spring context, no database). */
class AuditMenuModuleTest {

    /** Every entity type that exists in the DEV audit log, with the level-1 menu it is shown under. */
    private static final Map<String, String> WRITTEN_SO_FAR = Map.ofEntries(
            Map.entry("DOCUMENT", DOCUMENT_CONTROL), Map.entry("documents", DOCUMENT_CONTROL),
            Map.entry("REVISION", DOCUMENT_CONTROL), Map.entry("Revision", DOCUMENT_CONTROL),
            Map.entry("CONTROLLED_COPY", DOCUMENT_CONTROL), Map.entry("Controlled Copy", DOCUMENT_CONTROL),
            Map.entry("ControlledCopyRecord", DOCUMENT_CONTROL),
            Map.entry("CONTROLLED_COPY_DISTRIBUTION_BATCH", DOCUMENT_CONTROL), Map.entry("Controlled Copy Distribution Batch", DOCUMENT_CONTROL),
            Map.entry("ControlledCopyDistributionBatch", DOCUMENT_CONTROL), Map.entry("Controlled Copy Recall Batch", DOCUMENT_CONTROL),
            Map.entry("CONTROLLED_COPY_POLICY", DOCUMENT_CONTROL), Map.entry("CONTROLLED_COPY_EXPIRY_LIMIT", DOCUMENT_CONTROL),
            Map.entry("CONTROLLED_COPY_PLACEHOLDER_FIELD", DOCUMENT_CONTROL),
            Map.entry("Uncontrolled Copy", DOCUMENT_CONTROL), Map.entry("UNCONTROLLED_COPY_POLICY", DOCUMENT_CONTROL),
            Map.entry("UNCONTROLLED_COPY_ELIGIBILITY_RULE", DOCUMENT_CONTROL),
            Map.entry("PUBLISHED_PDF", DOCUMENT_CONTROL), Map.entry("PUBLISHING_TEMPLATE", DOCUMENT_CONTROL),
            Map.entry("EXECUTED_RECORD", DOCUMENT_CONTROL), Map.entry("EFORM_EDIT_SESSION", DOCUMENT_CONTROL),
            Map.entry("FORM_SETTINGS", DOCUMENT_CONTROL), Map.entry("OFFLINE_MEDIA", DOCUMENT_CONTROL),
            Map.entry("TRAINING_ACTIVITY", TRAINING), Map.entry("TRAINING_ASSESSMENT", TRAINING), Map.entry("TRAINING_CALENDAR", TRAINING),
            Map.entry("TRAINING_CODE_RULE", TRAINING), Map.entry("TRAINING_FORM_TEMPLATE", TRAINING), Map.entry("TRAINING_INITIAL_PART", TRAINING),
            Map.entry("TRAINING_JOB_ASSIGNMENT", TRAINING), Map.entry("TRAINING_JOB_ROLE", TRAINING), Map.entry("TRAINING_LEGACY_EVIDENCE", TRAINING),
            Map.entry("TRAINING_MATRIX", TRAINING), Map.entry("TRAINING_MATRIX_VERSION", TRAINING), Map.entry("TRAINING_NOTIFICATIONS", TRAINING),
            Map.entry("TRAINING_PERSONNEL_REVIEW", TRAINING), Map.entry("TRAINING_PERSON_POSITION", TRAINING), Map.entry("TRAINING_PROVIDER", TRAINING),
            Map.entry("TRAINING_RECORD_EXPORT", TRAINING), Map.entry("TRAINING_RECORD_EXPORT_BATCH", TRAINING), Map.entry("TRAINING_REQUIREMENT", TRAINING),
            Map.entry("TRAINING_SETTINGS", TRAINING), Map.entry("TRAINING_SPECIMEN", TRAINING), Map.entry("TRAINING_SPECIMEN_SIGNATURE", TRAINING),
            Map.entry("TRAINING_TOPIC", TRAINING), Map.entry("TRAINING_TRAINER_EXCEPTION", TRAINING), Map.entry("TRAINING_VENDOR", TRAINING),
            Map.entry("REPORT_ARTIFACT", REPORTS), Map.entry("REPORT_DEFINITION", REPORTS), Map.entry("REPORT_NAME_FORMAT", REPORTS),
            Map.entry("REPORT_PROPERTIES", REPORTS), Map.entry("REPORT_RUN", REPORTS), Map.entry("REPORT_SCHEDULE", REPORTS),
            Map.entry("REPORT_TEMPLATE", REPORTS), Map.entry("REPORT_TYPE", REPORTS),
            Map.entry("AUDIT_TRAIL", AUDIT_TRAIL), Map.entry("AUDIT_TRAIL_REVIEW", AUDIT_TRAIL), Map.entry("AuditTrail", AUDIT_TRAIL),
            Map.entry("BACKUP", BACKUP_RESTORE), Map.entry("BACKUP_EXPORT", BACKUP_RESTORE), Map.entry("BACKUP_INSPECTION", BACKUP_RESTORE),
            Map.entry("BACKUP_POLICY", BACKUP_RESTORE), Map.entry("BACKUP_RESTORE", BACKUP_RESTORE), Map.entry("BACKUP_TARGET", BACKUP_RESTORE),
            Map.entry("USER", SECURITY), Map.entry("UserAccount", SECURITY), Map.entry("ROLE", SECURITY), Map.entry("ACCESS_PROFILE", SECURITY),
            Map.entry("ACCESS_REVIEW", SECURITY), Map.entry("PERMISSION_SET", SECURITY), Map.entry("OBJECT_ACCESS_RULE", SECURITY),
            Map.entry("SOD_CONSTRAINT", SECURITY), Map.entry("WORKFLOW_ACTION_POLICY", SECURITY), Map.entry("SESSION", SECURITY),
            Map.entry("EMAIL_TEMPLATE", APPLICATION_SETTINGS), Map.entry("EmailTemplate", APPLICATION_SETTINGS), Map.entry("SYSTEM_ANNOUNCEMENT", APPLICATION_SETTINGS),
            Map.entry("SETTINGS", SYSTEM_ADMINISTRATION), Map.entry("SYSTEM_CONFIGURATION", SYSTEM_ADMINISTRATION),
            Map.entry("ELECTRONIC_SIGNATURE_SETTINGS", SYSTEM_ADMINISTRATION), Map.entry("STORAGE_OBJECT", SYSTEM_ADMINISTRATION),
            Map.entry("NOTIFICATION", NOTIFICATIONS), Map.entry("NOTIFICATION_INBOX", NOTIFICATIONS),
            Map.entry("KNOWLEDGE_COMPONENT", SELF_SERVICE), Map.entry("KNOWLEDGE_HIERARCHY", SELF_SERVICE),
            Map.entry("KNOWLEDGE_SHARE_DELEGATE", SELF_SERVICE), Map.entry("KNOWLEDGE_SHARE_LINK", SELF_SERVICE)
    );

    @Test
    void everyEntityTypeWrittenSoFarHasAMenuModule() {
        WRITTEN_SO_FAR.forEach((entityType, expected) ->
                assertEquals(expected, forEntityType(entityType), "entity type " + entityType));
    }

    @Test
    void everyModuleIsTheNameOfALevelOneSidebarMenuOrOther() {
        List<String> levelOneMenus = List.of(DOCUMENT_CONTROL, TRAINING, REPORTS, AUDIT_TRAIL, BACKUP_RESTORE, SECURITY,
                APPLICATION_SETTINGS, SYSTEM_ADMINISTRATION, NOTIFICATIONS, SELF_SERVICE);
        WRITTEN_SO_FAR.values().forEach(module ->
                org.junit.jupiter.api.Assertions.assertTrue(levelOneMenus.contains(module), module));
    }

    @Test
    void anUnplacedOrMissingEntityTypeIsShownAsOtherNotGuessed() {
        assertEquals(OTHER, forEntityType("SOMETHING_NEW"));
        assertEquals(OTHER, forEntityType(""));
        assertEquals(OTHER, forEntityType(null));
    }
}
