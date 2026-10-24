package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** SOP.0003 5.3.1: the department assesses the effect of a new document on the matrix; the assessment is signed, has a reason, and is checked against the matrix by the server. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingImpactServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock ElectronicSignatureService signatures;

    private final UUID activityId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final UUID positionId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingImpactService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(actor.getFullName()).thenReturn("Matrix Manager");
        Map<String, Object> activity = new HashMap<>();
        activity.put("id", activityId);
        activity.put("document_id", UUID.randomUUID());
        activity.put("document_number", "SOP.10292");
        activity.put("training_number", "TRN/QA/26-002");
        activity.put("status", "PLANNED");
        activity.put("organizer_department_id", departmentId);
        when(store.activityForUpdate(activityId)).thenReturn(Optional.of(activity));
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getId()).thenReturn(UUID.randomUUID());
        when(signatures.createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);
        when(jdbc.queryForList(contains("from positions where id = ? and is_active and department_id = ?"), any(Object[].class))).thenReturn(List.of(Map.of("id", positionId, "name", "QA Specialist")));
        service = spy(new TrainingImpactService(jdbc, access, store, signatures));
        doReturn(Map.of()).when(service).context(any(), any());
    }

    private TrainingImpactService.AssessRequest request(String outcome, String reason, List<UUID> positions, String token) {
        return new TrainingImpactService.AssessRequest(outcome, reason, positions, token);
    }

    @Test
    void anAssessmentNeedsAKnownOutcomeAReasonAndASignature() {
        assertThatThrownBy(() -> service.assess(actor, activityId, request("SOMETHING", "r", List.of(), "t"))).hasMessage("TRAINING_IMPACT_OUTCOME_INVALID");
        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", " ", List.of(), "t"))).hasMessage("TRAINING_REASON_REQUIRED");
        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", "Editorial change only", List.of(), null))).hasMessage("TRAINING_SIGNATURE_REQUIRED");
        verify(jdbc, never()).update(contains("insert into training_impact_assessments"), any(Object[].class));
    }

    @Test
    void whenTheMatrixMustBeUpdatedThePositionsToTrainMustBeNamed() {
        assertThatThrownBy(() -> service.assess(actor, activityId, request("MATRIX_UPDATE_NEEDED", "New SOP", List.of(), "t"))).hasMessage("TRAINING_IMPACT_POSITION_REQUIRED");
    }

    @Test
    void aPositionOfAnotherDepartmentIsRefused() {
        when(jdbc.queryForList(contains("from positions where id = ? and is_active and department_id = ?"), any(Object[].class))).thenReturn(List.of());

        assertThatThrownBy(() -> service.assess(actor, activityId, request("MATRIX_UPDATE_NEEDED", "New SOP", List.of(positionId), "t"))).hasMessage("TRAINING_IMPACT_POSITION_INVALID");
    }

    @Test
    void sayingThatTheMatrixAlreadyCoversTheDocumentIsRefusedWhenNoEffectiveMatrixHasIt() {
        when(jdbc.queryForObject(contains("from training_activities x where x.id = ?"), eq(Boolean.class), eq(activityId))).thenReturn(false);

        assertThatThrownBy(() -> service.assess(actor, activityId, request("MATRIX_ALREADY_COVERS", "Already in", List.of(), "t")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_IMPACT_NOT_IN_MATRIX");
    }

    @Test
    void aSignedAssessmentIsWrittenAndAuditedWithTheOutcomeThePositionsAndTheReason() {
        service.assess(actor, activityId, request("MATRIX_UPDATE_NEEDED", "New SOP for the QA team", List.of(positionId), "token"));

        verify(signatures).createEntitySignature(any(), any(), any(), any(), eq("token"), eq("TRAINING_IMPACT_ASSESSED"), any(), any(), any(), any());
        verify(jdbc).update(contains("insert into training_impact_assessments"), any(), eq(activityId), eq("MATRIX_UPDATE_NEEDED"), eq("New SOP for the QA team"), any(), any(), any());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(List.class);
        verify(store).auditActivity(eq(actor), any(), eq("TRAINING_IMPACT_ASSESSED"), any(), any(), contains("SOP.10292"), changes.capture());
        assertThat(changes.getValue()).extracting(AuditTrailChangeResponse::field).containsExactly("Impact on the training matrix", "Positions to be trained", "Reason");
        assertThat(changes.getValue().get(1).newValue()).isEqualTo("QA Specialist");
    }

    @Test
    void aCancelledActivityHasNothingToAssess() {
        Map<String, Object> cancelled = new HashMap<>(store.activityForUpdate(activityId).orElseThrow());
        cancelled.put("status", "CANCELLED");
        when(store.activityForUpdate(activityId)).thenReturn(Optional.of(cancelled));

        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", "r", List.of(), "t")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_IMPACT_NOT_APPLICABLE");
    }
}
