package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Opening a legacy training scan in the page is audited as a view, a download as a download, and both read the file only after the same checks. */
class TrainingLegacyEvidenceViewTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TrainingAccess access = mock(TrainingAccess.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final FileStorageService files = mock(FileStorageService.class);
    private final UserAccount actor = mock(UserAccount.class);
    private final UUID evidenceId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final byte[] bytes = "%PDF-1.4 scan".getBytes();
    private TrainingLegacyEvidenceService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new TrainingLegacyEvidenceService(jdbc, access, mock(ElectronicSignatureService.class), audit, files, mock(ClamAvScanService.class), mock(TrainingNumberService.class), mock(TrainingRecipients.class), mock(TrainingNotifier.class));
        String sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        Map<String, Object> evidence = Map.of("id", evidenceId, "revision_id", revisionId, "provider", "minio", "stored_path", "training/legacy-evidence/x.pdf",
                "sha256", sha, "content_type", "application/pdf", "original_name", "Danh sách đào tạo 26-010.pdf");
        Map<String, Object> revision = Map.of("id", revisionId, "revision_number", "2.0", "training_origin", "LEGACY_IMPORT", "requires_training", true,
                "document_number", "SOP.0010", "document_name", "Cleaning", "department_id", departmentId);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(call -> {
            String sql = call.getArgument(0);
            return sql.contains("from training_legacy_evidence") ? List.of(evidence) : List.of(revision);
        });
        when(files.readReportArtifact(anyString(), anyString())).thenReturn(bytes);
    }

    @Test
    void viewIsWrittenToTheAuditTrailAsAViewAndReturnsTheUploadedName() {
        Map<String, Object> file = service.view(actor, evidenceId);
        assertArrayEquals(bytes, (byte[]) file.get("bytes"));
        assertEquals("Danh sách đào tạo 26-010.pdf", file.get("name"));
        ArgumentCaptor<String> action = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), anyString(), anyString(), eq(evidenceId), action.capture(), any(), any(), anyString());
        assertEquals("TRAINING_LEGACY_EVIDENCE_VIEWED", action.getValue());
    }

    @Test
    void downloadKeepsItsOwnAuditAction() {
        service.download(actor, evidenceId);
        ArgumentCaptor<String> action = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), anyString(), anyString(), eq(evidenceId), action.capture(), any(), any(), anyString());
        assertEquals("TRAINING_LEGACY_EVIDENCE_DOWNLOADED", action.getValue());
    }

    @Test
    void aPersonOutsideTheDepartmentCannotViewAndNothingIsRead() throws Exception {
        doThrow(new SecurityException(TrainingAccess.DENIED)).when(access).requireScope(actor, departmentId);
        assertThrows(SecurityException.class, () -> service.view(actor, evidenceId));
        verify(files, never()).readReportArtifact(anyString(), anyString());
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }

    @Test
    void aChangedFileIsNotShown() throws Exception {
        when(files.readReportArtifact(anyString(), anyString())).thenReturn("other bytes".getBytes());
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.view(actor, evidenceId));
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }
}
