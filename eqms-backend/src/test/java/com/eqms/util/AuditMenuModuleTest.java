package com.eqms.util;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static com.eqms.util.AuditMenuModule.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Plain unit test (no Spring context, no database). */
class AuditMenuModuleTest {

    /** Every entity type that exists in the DEV audit log, with the level-1 menu it is shown under. */
    private static final Map<String, String> WRITTEN_SO_FAR = Map.ofEntries(
            // placed after the rule of the top menu of the screen (REPORT-MODULE-FIXED-2026-11-17)
            Map.entry("REPORT_APPEARANCE", SYSTEM_ADMINISTRATION), Map.entry("REPORT_TEMPLATE_NUMBER_RULE", SYSTEM_ADMINISTRATION),
            Map.entry("NOTIFICATION_POLICY", SYSTEM_ADMINISTRATION), Map.entry("EMAIL_DESIGN", SYSTEM_ADMINISTRATION), Map.entry("IN_APP_DESIGN", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUP_ALERT", SYSTEM_ADMINISTRATION), Map.entry("BACKUP_ALERT_RULE", SYSTEM_ADMINISTRATION), Map.entry("BACKUP_ALERT_RECIPIENT", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUP_MANUAL_COPY", SYSTEM_ADMINISTRATION), Map.entry("BACKUP_DR_SETTING", SYSTEM_ADMINISTRATION), Map.entry("BACKUP_DR_SCENARIO", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUP_DR_KIT", SYSTEM_ADMINISTRATION), Map.entry("BACKUP_DR_DECLARATION", SYSTEM_ADMINISTRATION),
            Map.entry("DASHBOARD_ROLE_LAYOUT", SYSTEM_ADMINISTRATION), Map.entry("ADMINISTRATIVE_NETWORK_POLICY", SYSTEM_ADMINISTRATION), Map.entry("STORAGE_USAGE_POLICY", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUP_STORE_SCRUB", BACKUP_RESTORE),
            Map.entry("WORKFLOW_ROLE", SECURITY), Map.entry("LIFECYCLE_STATE_POLICY", SECURITY), Map.entry("TRAINING_COMPLETION", TRAINING),
            Map.entry("CONTROLLED_COPY_DISTRIBUTION_JOB", DOCUMENT_CONTROL),
            Map.entry("DOCUMENT", DOCUMENT_CONTROL), Map.entry("documents", DOCUMENT_CONTROL),
            Map.entry("REVISION", DOCUMENT_CONTROL), Map.entry("Revision", DOCUMENT_CONTROL),
            Map.entry("CONTROLLED_COPY", DOCUMENT_CONTROL), Map.entry("Controlled Copy", DOCUMENT_CONTROL),
            Map.entry("ControlledCopyRecord", DOCUMENT_CONTROL),
            Map.entry("CONTROLLED_COPY_DISTRIBUTION_BATCH", DOCUMENT_CONTROL), Map.entry("Controlled Copy Distribution Batch", DOCUMENT_CONTROL),
            Map.entry("ControlledCopyDistributionBatch", DOCUMENT_CONTROL), Map.entry("Controlled Copy Recall Batch", DOCUMENT_CONTROL),
            Map.entry("CONTROLLED_COPY_POLICY", SYSTEM_ADMINISTRATION), Map.entry("CONTROLLED_COPY_EXPIRY_LIMIT", SYSTEM_ADMINISTRATION),
            Map.entry("CONTROLLED_COPY_PLACEHOLDER_FIELD", SYSTEM_ADMINISTRATION),
            Map.entry("Uncontrolled Copy", DOCUMENT_CONTROL), Map.entry("UNCONTROLLED_COPY_POLICY", SYSTEM_ADMINISTRATION),
            Map.entry("UNCONTROLLED_COPY_ELIGIBILITY_RULE", SYSTEM_ADMINISTRATION),
            Map.entry("PUBLISHED_PDF", DOCUMENT_CONTROL), Map.entry("PUBLISHING_TEMPLATE", SYSTEM_ADMINISTRATION),
            Map.entry("EXECUTED_RECORD", DOCUMENT_CONTROL), Map.entry("EFORM_EDIT_SESSION", DOCUMENT_CONTROL),
            Map.entry("FORM_SETTINGS", DOCUMENT_CONTROL), Map.entry("OFFLINE_MEDIA", DOCUMENT_CONTROL),
            Map.entry("TRAINING_ACTIVITY", TRAINING), Map.entry("TRAINING_ASSESSMENT", TRAINING), Map.entry("TRAINING_CALENDAR", TRAINING),
            Map.entry("TRAINING_CODE_RULE", SYSTEM_ADMINISTRATION), Map.entry("TRAINING_FORM_TEMPLATE", TRAINING), Map.entry("TRAINING_INITIAL_PART", TRAINING),
            Map.entry("TRAINING_JOB_ASSIGNMENT", TRAINING), Map.entry("TRAINING_JOB_ROLE", SYSTEM_ADMINISTRATION), Map.entry("TRAINING_LEGACY_EVIDENCE", TRAINING),
            Map.entry("TRAINING_MATRIX", TRAINING), Map.entry("TRAINING_MATRIX_VERSION", TRAINING), Map.entry("TRAINING_NOTIFICATIONS", SYSTEM_ADMINISTRATION),
            Map.entry("TRAINING_PERSONNEL_REVIEW", TRAINING), Map.entry("TRAINING_PERSON_POSITION", TRAINING), Map.entry("TRAINING_PROVIDER", SYSTEM_ADMINISTRATION),
            Map.entry("TRAINING_RECORD_EXPORT", TRAINING), Map.entry("TRAINING_RECORD_EXPORT_BATCH", TRAINING), Map.entry("TRAINING_REQUIREMENT", TRAINING),
            Map.entry("TRAINING_SETTINGS", SYSTEM_ADMINISTRATION), Map.entry("TRAINING_SPECIMEN", TRAINING), Map.entry("TRAINING_SPECIMEN_SIGNATURE", TRAINING),
            Map.entry("TRAINING_TOPIC", TRAINING), Map.entry("TRAINING_TRAINER_EXCEPTION", TRAINING), Map.entry("TRAINING_VENDOR", SYSTEM_ADMINISTRATION),
            Map.entry("REPORT_ARTIFACT", REPORTS), Map.entry("REPORT_DEFINITION", REPORTS), Map.entry("REPORT_NAME_FORMAT", SYSTEM_ADMINISTRATION),
            Map.entry("REPORT_PROPERTIES", SYSTEM_ADMINISTRATION), Map.entry("REPORT_RUN", REPORTS), Map.entry("REPORT_SCHEDULE", REPORTS),
            Map.entry("REPORT_TEMPLATE", REPORTS), Map.entry("REPORT_TYPE", SYSTEM_ADMINISTRATION),
            Map.entry("AUDIT_TRAIL", AUDIT_TRAIL), Map.entry("AUDIT_TRAIL_REVIEW", AUDIT_TRAIL), Map.entry("AuditTrail", AUDIT_TRAIL),
            Map.entry("BACKUP", BACKUP_RESTORE), Map.entry("BACKUP_EXPORT", BACKUP_RESTORE), Map.entry("BACKUP_INSPECTION", BACKUP_RESTORE),
            Map.entry("BACKUP_POLICY", SYSTEM_ADMINISTRATION), Map.entry("BACKUP_RESTORE", BACKUP_RESTORE), Map.entry("BACKUP_TARGET", SYSTEM_ADMINISTRATION),
            Map.entry("USER", SECURITY), Map.entry("UserAccount", SECURITY), Map.entry("ROLE", SECURITY), Map.entry("ACCESS_PROFILE", SECURITY),
            Map.entry("ACCESS_REVIEW", SECURITY), Map.entry("PERMISSION_SET", SECURITY), Map.entry("OBJECT_ACCESS_RULE", SECURITY),
            Map.entry("SOD_CONSTRAINT", SECURITY), Map.entry("WORKFLOW_ACTION_POLICY", SECURITY), Map.entry("SESSION", SECURITY),
            Map.entry("EMAIL_TEMPLATE", SYSTEM_ADMINISTRATION), Map.entry("EmailTemplate", SYSTEM_ADMINISTRATION), Map.entry("SYSTEM_ANNOUNCEMENT", APPLICATION_SETTINGS),
            Map.entry("SETTINGS", SYSTEM_ADMINISTRATION), Map.entry("SYSTEM_CONFIGURATION", SYSTEM_ADMINISTRATION),
            Map.entry("ELECTRONIC_SIGNATURE_SETTINGS", SYSTEM_ADMINISTRATION), Map.entry("STORAGE_OBJECT", SYSTEM_ADMINISTRATION),
            Map.entry("NOTIFICATION", NOTIFICATIONS), Map.entry("NOTIFICATION_INBOX", NOTIFICATIONS),
            Map.entry("KNOWLEDGE_COMPONENT", SYSTEM_ADMINISTRATION), Map.entry("KNOWLEDGE_HIERARCHY", SYSTEM_ADMINISTRATION),
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
    @Test
    void theSqlExpressionIsMadeFromTheSameListAsTheJavaMapping() {
        String sql = sqlCase("al.entity_type");
        // every exact key and every prefix is in it, under its own module; what is not placed is "Other"
        assertTrue(sql.contains("upper(replace(replace(al.entity_type,' ',''),'_',''))"));
        assertTrue(sql.contains("'DOCUMENT'") && sql.contains("'ROLE'") && sql.contains("'SYSTEMCONFIGURATION'"));
        assertTrue(sql.contains("like 'TRAINING%' then 'Training Management'") && sql.contains("like 'BACKUP%' then 'Backup & Restore'"));
        assertTrue(sql.endsWith("else 'Other' end)"));
        // the exact keys are tried before the prefixes, as in the Java mapping
        assertTrue(sql.indexOf("'DOCUMENT'") < sql.indexOf("like 'TRAINING%'"));
        // fixed text only: no input reaches it, and a quote in the column name is the caller's own text
        assertTrue(sql.indexOf("'") > 0 && !sql.contains(";"));
    }
}
