package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The Audit Trail of a Training Matrix tells what changed, who is concerned and which signature backs it (not only that something happened). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingMatrixAuditDetailTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock TrainingApprovalService approvals;
    @Mock ElectronicSignatureService signatures;
    @Mock AuditTrailService audit;
    @Mock UserAccountRepository users;
    @Mock TrainingNotifier notifier;

    private final UUID versionId = UUID.randomUUID();
    private final UUID matrixId = UUID.randomUUID();
    private final UUID signatureId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingMatrixService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(actor.getFullName()).thenReturn("Approver Test");
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getId()).thenReturn(signatureId);
        when(signatures.createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);
        when(jdbc.queryForList(contains("from training_matrices where id=?"), eq(matrixId))).thenReturn(List.of(Map.of("id", matrixId, "code", "TM-QA", "department_id", UUID.randomUUID())));
        service = spy(new TrainingMatrixService(jdbc, access, store, approvals, signatures, audit, users, notifier));
        doReturn(Map.of()).when(service).version(any(), any());
    }

    private void version(String status, Integer versionNo) {
        Map<String, Object> row = new java.util.HashMap<>();
        row.put("id", versionId);
        row.put("matrix_id", matrixId);
        row.put("status", status);
        row.put("version", 7);
        row.put("version_no", versionNo);
        row.put("change_reason", "Added gowning");
        when(jdbc.queryForList(contains("from training_matrix_versions where id=? for update"), eq(versionId))).thenReturn(List.of(row));
    }

    @SuppressWarnings("unchecked")
    private List<AuditTrailChangeResponse> captured(String action, String from, String to) {
        ArgumentCaptor<List<AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(List.class);
        verify(audit).logAs(eq(actor), eq("TRAINING_MATRIX"), any(), eq(versionId), eq(action), eq(from), eq(to), any(), changes.capture(), any());
        return changes.getValue();
    }

    @SuppressWarnings("unchecked")
    private List<AuditTrailChangeResponse> capturedWithoutSignature(String action) {
        ArgumentCaptor<List<AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(List.class);
        verify(audit).logAs(eq(actor), eq("TRAINING_MATRIX"), any(), eq(versionId), eq(action), any(), any(), any(), changes.capture());
        return changes.getValue();
    }

    @Test
    void approvalRecordsTheStatusTheApproverAndTheVersionItMakesObsoleteLinkedToTheSignature() {
        version("PENDING_APPROVAL", 3);
        when(jdbc.queryForList(contains("select version_no from training_matrix_versions where matrix_id=? and status='EFFECTIVE'"), eq(Integer.class), any())).thenReturn(List.of(2));

        service.approve(actor, versionId, new TrainingMatrixService.SignRequest(7, "token"));

        List<AuditTrailChangeResponse> changes = captured("TRAINING_MATRIX_APPROVED", "PENDING_APPROVAL", "EFFECTIVE");
        assertThat(changes).extracting(AuditTrailChangeResponse::field).containsExactly("Status", "Approved by", "Version 2 status");
        assertThat(changes.get(0).oldValue()).isEqualTo("Pending Approval");
        assertThat(changes.get(0).newValue()).isEqualTo("Effective");
        assertThat(changes.get(1).newValue()).isEqualTo("Approver Test");
        assertThat(changes.get(2).newValue()).isEqualTo("Obsoleted");
    }

    @Test
    void submissionRecordsThePreparerTheDesignatedApproverAndTheReasonLinkedToTheSignature() {
        version("DRAFT", 3);
        UUID approverId = UUID.randomUUID();
        UserAccount approver = mock(UserAccount.class);
        when(approver.getFullName()).thenReturn("Ann Approver");
        when(users.findById(approverId)).thenReturn(Optional.of(approver));
        when(jdbc.queryForObject(contains("count(*) from training_matrix_rows where version_id=?"), eq(Integer.class), any())).thenReturn(4);
        when(jdbc.queryForObject(contains("not exists (select 1 from training_matrix_cells"), eq(Integer.class), any())).thenReturn(0);

        service.submit(actor, versionId, new TrainingMatrixService.SubmitRequest(7, "token", approverId));

        List<AuditTrailChangeResponse> changes = captured("TRAINING_MATRIX_SUBMITTED", "DRAFT", "PENDING_APPROVAL");
        assertThat(changes).extracting(AuditTrailChangeResponse::field).containsExactly("Status", "Prepared by", "Designated approver", "What changed in this version");
        assertThat(changes.get(2).newValue()).isEqualTo("Ann Approver");
        assertThat(changes.get(3).newValue()).isEqualTo("Added gowning");
    }

    @Test
    void aSaveRecordsTheRowThatWasRemovedWithItsPositionsAndYearlyRule() {
        version("DRAFT", 3);
        UUID rowId = UUID.randomUUID();
        when(jdbc.queryForList(contains("from training_matrix_rows r left join documents"), eq(versionId)))
                .thenReturn(List.of(Map.of("id", rowId, "annual_required", true, "title", "GMP overview")), List.of());
        when(jdbc.queryForList(contains("from training_matrix_cells c join training_job_roles p"), eq(String.class), any())).thenReturn(List.of("Operator"));

        service.save(actor, versionId, new TrainingMatrixService.SaveRequest(7, "Added gowning", List.of()));

        List<AuditTrailChangeResponse> changes = capturedWithoutSignature("TRAINING_MATRIX_SAVED");
        assertThat(changes).extracting(AuditTrailChangeResponse::field).containsExactly("Row removed: GMP overview");
        assertThat(changes.get(0).oldValue()).isEqualTo("Operator | every year");
        assertThat(changes.get(0).newValue()).isNull();
    }
}
