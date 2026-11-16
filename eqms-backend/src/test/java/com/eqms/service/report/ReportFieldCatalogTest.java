package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** REPORT-FIELD-CATALOG-2026-11-15: every field of a Report Type has a group, the sensitive fields are real columns, and a type never needs more columns than a report may carry. */
class ReportFieldCatalogTest {
    /** The sources of the field catalogue step (report runs, job assignments and roles, notification delivery, announcements). */
    static List<ReportMetadataProvider> catalogueSources() {
        var access = org.mockito.Mockito.mock(com.eqms.service.training.TrainingAccess.class);
        return List.of(new ReportRunReportMetadataProvider(), new TrainingJobAssignmentReportMetadataProvider(access), new TrainingJobRoleReportMetadataProvider(access), new TrainingMatrixReportMetadataProvider(access),
                new NotificationDeliveryReportMetadataProvider(), new BackupRunReportMetadataProvider(), new AnnouncementReportMetadataProvider());
    }

    static List<ReportMetadataProvider> providers() {
        var all = new ArrayList<>(ReportDocumentSourcesTest.providers());
        all.addAll(ReportTrainingSourcesTest.providers());
        all.addAll(ReportSecuritySourcesTest.providers());
        all.addAll(catalogueSources());
        return all;
    }

    @ParameterizedTest @MethodSource("providers")
    void everyGroupAndSensitiveFieldIsAColumnOfTheType(ReportMetadataProvider provider) {
        assertTrue(provider.columns().keySet().containsAll(provider.fieldGroups().keySet()), provider.code() + ": a group names a column the type has");
        assertTrue(provider.columns().keySet().containsAll(provider.sensitiveFields()), provider.code() + ": a sensitive field is a column of the type");
        provider.fieldGroups().values().forEach(group -> assertFalse(group.isBlank(), provider.code()));
    }

    @ParameterizedTest @MethodSource("providers")
    void theRequiredFieldsFitInOneReportAndTheGroupOfEveryColumnIsKnown(ReportMetadataProvider provider) {
        assertTrue(provider.requiredFields().size() <= ReportMetadataProvider.MAX_REPORT_COLUMNS);
        var groups = ReportTemplateService.groupsOf(provider);
        assertEquals(provider.columns().keySet(), groups.keySet());
        groups.values().forEach(group -> assertFalse(group.isBlank()));
    }

    /** REPORT-FIELD-NAMES-2026-11-15: five names were made to say what the field holds; the code of every field stays. */
    @ParameterizedTest @MethodSource("providers")
    void noFieldOfAnySourceKeepsAnOldName(ReportMetadataProvider provider) {
        var labels = provider.labels();
        assertNotEquals("Created", labels.get("createdAt"), provider.code() + ": the date of creation is Created At");
        assertNotEquals("Record", labels.get("recordStatus"), provider.code());
        assertNotEquals("Organisation (External)", labels.get("organisation"), provider.code());
        if ("requirement".equals(provider.identityColumn()) || labels.containsKey("requirement")) {
            assertNotEquals("Training Required", labels.get("requirement"), provider.code() + ": the name of the requirement is not a Yes/No field");
        }
        // The Yes/No field of the documents keeps its name.
        if (labels.containsKey("requiresTraining")) assertEquals("Training Required", labels.get("requiresTraining"), provider.code());
    }

    @org.junit.jupiter.api.Test
    void theNamedFieldsSayWhatTheyHold() {
        Map<String, ReportMetadataProvider> byCode = new HashMap<>();
        providers().forEach(provider -> byCode.put(provider.code(), provider));
        assertEquals("Created At", byCode.get("DOCUMENT_STATUS").labels().get("createdAt"));
        assertEquals("Created At", byCode.get("USER_ACCESS").labels().get("createdAt"));
        assertEquals("Required Training", byCode.get("TRAINING_MATRIX").labels().get("requirement"));
        assertEquals("Required Training", byCode.get("TRAINING_COMPLIANCE").labels().get("requirement"));
        assertEquals("Record Status", byCode.get("TRAINING_RECORDS").labels().get("recordStatus"));
        assertEquals("Organization (External)", byCode.get("TRAINING_PARTICIPANTS").labels().get("organisation"));
        assertEquals("Training Required", byCode.get("DOCUMENT_STATUS").labels().get("requiresTraining"));
    }

    @org.junit.jupiter.api.Test
    void theLimitIsThirtyColumns() { assertEquals(30, ReportMetadataProvider.MAX_REPORT_COLUMNS); }

    @org.junit.jupiter.api.Test
    void theAuditTextNamesTheSensitiveColumnsOfARun() {
        var users = new UserAccessReportMetadataProvider();
        var labels = ReportTemplateService.sensitiveLabels(users, List.of("fullName", "email", "status", "phone"));
        assertEquals(List.of("Email", "Phone"), labels);
        assertEquals("; exports sensitive columns: Email, Phone", com.eqms.service.ReportPlatformService.sensitiveNote(labels));
        assertEquals("", com.eqms.service.ReportPlatformService.sensitiveNote(ReportTemplateService.sensitiveLabels(users, List.of("fullName", "status"))));
    }

    /** A run is queued, signed and audited in one transaction: nothing placed between the annotation and the method may take it away. */
    @org.junit.jupiter.api.Test
    void queueingARunIsStillTransactional() throws Exception {
        var method = com.eqms.service.ReportPlatformService.class.getMethod("queueRun", com.eqms.entity.UserAccount.class, com.eqms.service.ReportPlatformService.RunRequest.class, String.class);
        assertNotNull(method.getAnnotation(org.springframework.transaction.annotation.Transactional.class));
    }

    @org.junit.jupiter.api.Test
    void theDocumentRegisterCanBeFilteredByAuthor() {
        var register = new DocumentReportMetadataProvider(ReportTestVisibility.everything());
        assertTrue(register.filters().stream().anyMatch(f -> "author".equals(f.get("code")) && "LOOKUP".equals(f.get("type"))));
        assertEquals("author", register.filterColumns().get("author"));
        assertEquals("au.id", register.lookupColumns().get("author"));
        assertTrue(register.narrowingFilters().contains("author"), "the author narrows a run");
    }
}
