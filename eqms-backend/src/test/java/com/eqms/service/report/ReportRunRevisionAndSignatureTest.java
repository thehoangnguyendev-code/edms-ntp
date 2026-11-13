package com.eqms.service.report;

import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * REPORT-OBSOLETE-REVISION-2026-11-12 and REPORT-RUN-SIGNATURE-2026-11-12: a run of a revision that is no longer effective is not generated; a run of the Audit Trail report is
 * signed by the person who requests it.
 */
class ReportRunRevisionAndSignatureTest {
    private final ObjectMapper json = new ObjectMapper();
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ReportTemplateService service = new ReportTemplateService(jdbc, json, mock(EffectivePermissionService.class), mock(AuditTrailService.class),
            List.of(new AuditTrailReportMetadataProvider(), new StorageUsageReportMetadataProvider()));

    private com.fasterxml.jackson.databind.JsonNode snapshot(Object version) {
        var definition = json.createObjectNode();
        if (version != null) definition.put("definitionVersion", (Integer) version);
        return json.createObjectNode().set("definition", definition);
    }

    private void live(int version, String approval, Integer approvedVersion) {
        var row = new java.util.HashMap<String, Object>();
        row.put("definition_version", version);
        row.put("approval_status", approval);
        row.put("approved_version", approvedVersion);
        when(jdbc.queryForList(anyString(), eq("QA_REGISTER"))).thenReturn(List.of(row));
    }

    @Test
    void aRunOfTheEffectiveApprovedRevisionMayBeGenerated() {
        live(3, "APPROVED", 3);
        assertDoesNotThrow(() -> service.requireRunRevisionEffective("QA_REGISTER", snapshot(3)));
    }

    @Test
    void aRunOfARevisionThatANewerOneHasReplacedIsRefused() {
        live(4, "APPROVED", 4);
        assertEquals("REPORT_REVISION_OBSOLETE", assertThrows(IllegalArgumentException.class, () -> service.requireRunRevisionEffective("QA_REGISTER", snapshot(3))).getMessage());
    }

    @Test
    void aRunIsRefusedWhenTheTemplateIsNoLongerApprovedForItsVersion() {
        live(3, "DRAFT", 2);
        assertThrows(IllegalArgumentException.class, () -> service.requireRunRevisionEffective("QA_REGISTER", snapshot(3)));
        live(3, "APPROVED", null);
        assertThrows(IllegalArgumentException.class, () -> service.requireRunRevisionEffective("QA_REGISTER", snapshot(3)));
    }

    @Test
    void aTemplateThatNoLongerExistsRefusesTheRun() {
        when(jdbc.queryForList(anyString(), eq("GONE"))).thenReturn(List.of());
        assertThrows(IllegalArgumentException.class, () -> service.requireRunRevisionEffective("GONE", snapshot(1)));
    }

    @Test
    void aRunMadeBeforeRevisionsExistedHasNoVersionAndIsNotChecked() {
        assertDoesNotThrow(() -> service.requireRunRevisionEffective("QA_REGISTER", snapshot(null)));
        verifyNoInteractions(jdbc);
    }

    @Test
    void everyFileOfAuditRecordsIsSignedAtTheRun() {
        assertTrue(service.runNeedsSignature("AUDIT_TRAIL"));
        assertFalse(service.runNeedsSignature("STORAGE_USAGE"));
        assertFalse(service.runNeedsSignature("UNKNOWN"));
        assertTrue(new AuditTrailReportMetadataProvider().runNeedsSignature());
        assertTrue(new BackupActivityReportMetadataProvider().runNeedsSignature());
        assertTrue(new AuthEventReportMetadataProvider().runNeedsSignature());
        assertTrue(new ElectronicSignatureReportMetadataProvider().runNeedsSignature());
    }
}
