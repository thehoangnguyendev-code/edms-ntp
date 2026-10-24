package com.eqms.service.training;

import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ElectronicSignatureService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** D-12: a failed assessment raises "work suspended"; the retraining that is passed ends it; the head of the unit may resume it with a reason and a signature, never for oneself. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingSuspensionServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock ElectronicSignatureService signatures;
    @Mock UserAccountRepository users;
    @Mock TrainingNotifier notifier;
    @Mock TrainingRecipients recipients;

    private final UUID activityId = UUID.randomUUID();
    private final UUID personId = UUID.randomUUID();
    private final UUID participantId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private final UserAccount trainee = mock(UserAccount.class);
    private TrainingSuspensionService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(actor.getFullName()).thenReturn("Head Of Unit");
        when(trainee.getId()).thenReturn(personId);
        when(users.findById(personId)).thenReturn(Optional.of(trainee));
        when(access.departmentOf(trainee)).thenReturn(departmentId);
        when(access.departmentOf(any(UserAccount.class))).thenReturn(departmentId);
        service = new TrainingSuspensionService(jdbc, access, store, signatures, users, notifier, recipients);
    }

    private Map<String, Object> activity() {
        Map<String, Object> a = new HashMap<>();
        a.put("id", activityId);
        a.put("training_number", "TRN/QA/26-001");
        a.put("training_title", "GMP basics");
        return a;
    }

    private Map<String, Object> participant(UUID person) {
        Map<String, Object> p = new HashMap<>();
        p.put("id", participantId);
        p.put("person_user_id", person);
        p.put("session_id", UUID.randomUUID());
        p.put("full_name", "Anne");
        return p;
    }

    @Test
    void aFailedAssessmentRaisesTheFlagWritesTheAuditTrailAndTellsThePerson() {
        when(jdbc.update(contains("insert into training_work_suspensions"), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        service.raise(actor, activity(), participant(personId), new BigDecimal("55.00"));

        verify(store).auditActivity(eq(actor), any(), eq("TRAINING_WORK_SUSPENSION_RAISED"), any(), eq("OPEN"), contains("did not pass (55.00%)"));
        verify(notifier).send(eq("TRAINING_WORK_SUSPENDED"), eq(trainee), eq(actor), any(), any(), any(), eq(activityId), any());
    }

    @Test
    void aSecondFailureOfTheSameParticipantChangesNothingBecauseTheFlagIsAlreadyUp() {
        when(jdbc.update(contains("insert into training_work_suspensions"), any(), any(), any(), any(), any(), any(), any())).thenReturn(0);

        service.raise(actor, activity(), participant(personId), new BigDecimal("40"));

        verify(store, never()).auditActivity(any(), any(), any(), any(), any(), any());
        verify(notifier, never()).send(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void anOutsiderHasNoAccountAndRaisesNoFlag() {
        service.raise(actor, activity(), participant(null), new BigDecimal("40"));

        verify(jdbc, never()).update(contains("insert into training_work_suspensions"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void passingTheRetrainingOfTheActivityEndsTheSuspensionAndIsAudited() {
        UUID parent = UUID.randomUUID();
        UUID suspension = UUID.randomUUID();
        Map<String, Object> retraining = activity();
        retraining.put("parent_activity_id", parent);
        when(jdbc.queryForList(contains("from training_work_suspensions where status = 'OPEN'"), any(Object[].class))).thenReturn(List.of(Map.of("id", suspension, "activity_id", parent)));
        when(jdbc.update(contains("update training_work_suspensions set status='CLEARED'"), any(), any(), eq(suspension))).thenReturn(1);
        when(store.activity(parent)).thenReturn(Optional.of(activity()));

        service.clearOnPass(actor, retraining, participant(personId));

        verify(store).auditActivity(eq(actor), any(), eq("TRAINING_WORK_SUSPENSION_CLEARED"), eq("OPEN"), eq("CLEARED"), contains("retraining was passed"));
    }

    private Map<String, Object> open() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", UUID.randomUUID());
        row.put("person_user_id", personId);
        row.put("activity_id", activityId);
        row.put("status", "OPEN");
        when(jdbc.queryForList(contains("from training_work_suspensions where id=? for update"), any(Object[].class))).thenReturn(List.of(row));
        when(store.activity(activityId)).thenReturn(Optional.of(activity()));
        return row;
    }

    @Test
    void thePersonConcernedCannotResumeTheirOwnWork() {
        Map<String, Object> row = open();
        when(actor.getId()).thenReturn(personId);

        assertThatThrownBy(() -> service.resume(actor, (UUID) row.get("id"), new TrainingSuspensionService.ResumeRequest("ok", "token")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(TrainingApprovalService.SEGREGATION);
    }

    @Test
    void resumingNeedsAReasonAndASignature() {
        Map<String, Object> row = open();
        UUID id = (UUID) row.get("id");

        assertThatThrownBy(() -> service.resume(actor, id, new TrainingSuspensionService.ResumeRequest(" ", "token"))).hasMessage("TRAINING_REASON_REQUIRED");
        assertThatThrownBy(() -> service.resume(actor, id, new TrainingSuspensionService.ResumeRequest("Retrained on the job", null))).hasMessage("TRAINING_SIGNATURE_REQUIRED");
    }

    @Test
    void aSuspensionThatIsAlreadyClearedCannotBeResumedAgain() {
        Map<String, Object> row = open();
        row.put("status", "CLEARED");

        assertThatThrownBy(() -> service.resume(actor, (UUID) row.get("id"), new TrainingSuspensionService.ResumeRequest("ok", "token")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_SUSPENSION_NOT_OPEN");
    }

    @Test
    void theHeadOfTheUnitResumesWithAReasonAndASignatureAndThePersonIsTold() {
        Map<String, Object> row = open();
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getId()).thenReturn(UUID.randomUUID());
        when(signatures.createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);

        service.resume(actor, (UUID) row.get("id"), new TrainingSuspensionService.ResumeRequest("Retrained on the job", "token"));

        verify(signatures).createEntitySignature(any(), any(), any(), any(), eq("token"), eq("TRAINING_WORK_RESUMED"), any(), any(), any(), any());
        verify(store).auditActivity(eq(actor), any(), eq("TRAINING_WORK_SUSPENSION_CLEARED"), eq("OPEN"), eq("CLEARED"), contains("Retrained on the job"));
        verify(notifier).send(eq("TRAINING_WORK_RESUMED"), eq(trainee), eq(actor), any(), any(), any(), eq(activityId), any());
    }
}
