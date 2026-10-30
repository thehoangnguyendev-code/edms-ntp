package com.eqms.service.training;

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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** How a person takes part (owner decision 2026-10-28): who takes the assessment, what the result is on attendance, and when the role may be changed. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingParticipationRoleTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock TrainingApprovalService approvals;
    @Mock ElectronicSignatureService signatures;
    @Mock UserAccountRepository users;
    @Mock TrainingNotifier notifier;
    @Mock TrainingSuspensionService suspensions;

    private final UUID activityId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();
    private final UUID participantId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingActivityService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        service = spy(new TrainingActivityService(jdbc, access, store, null, null, approvals, signatures, users, notifier, null, suspensions, null));
        doReturn(Map.of()).when(service).get(any(), any());
    }

    private Map<String, Object> activity(String status, String kind) {
        Map<String, Object> a = new HashMap<>();
        a.put("id", activityId);
        a.put("status", status);
        a.put("kind", kind);
        a.put("version", 3);
        a.put("training_number", "TRN/QA/26-001");
        a.put("organizer_department_id", departmentId);
        when(store.activityForUpdate(activityId)).thenReturn(Optional.of(a));
        return a;
    }

    private void session(String method) {
        Map<String, Object> s = new HashMap<>();
        s.put("id", sessionId);
        s.put("activity_id", activityId);
        s.put("session_no", 1);
        s.put("method", method);
        when(jdbc.queryForList(contains("select * from training_sessions where id=?"), eq(sessionId))).thenReturn(List.of(s));
    }

    private void participant(String role, String reason, String state, String result, UUID person) {
        Map<String, Object> p = new HashMap<>();
        p.put("id", participantId);
        p.put("activity_id", activityId);
        p.put("session_id", sessionId);
        p.put("person_user_id", person);
        p.put("full_name", "Nguyen Van A");
        p.put("participation_role", role);
        p.put("participation_reason", reason);
        p.put("state", state);
        p.put("result", result);
        when(jdbc.queryForList(contains("select * from training_participants where id=? for update"), eq(participantId))).thenReturn(List.of(p));
    }

    private void usedResults(int count) {
        when(jdbc.queryForObject(contains("training_assessments"), eq(Integer.class), any(), any(), any())).thenReturn(count);
    }

    @Test
    void anAttendeeOrAListedPersonIsDoneOnAttendanceAndATraineeWaitsForTheScore() {
        Map<String, Object> internal = Map.of("kind", "INTERNAL");
        assertThat(TrainingActivityService.resultOnAttendance(internal, Map.of("participation_role", "TRAINEE"), "ATTENDED")).isEqualTo("PENDING");
                assertThat(TrainingActivityService.resultOnAttendance(internal, Map.of("participation_role", "ATTENDEE"), "ONLINE")).isEqualTo("PASSED");
        assertThat(TrainingActivityService.resultOnAttendance(internal, Map.of("participation_role", "NAME_ONLY"), "ATTENDED")).isEqualTo("PASSED");
    }

    @Test
    void anAbsentPersonHasNoResultWhateverTheRole() {
        assertThat(TrainingActivityService.resultOnAttendance(Map.of("kind", "INTERNAL"), Map.of("participation_role", "ATTENDEE"), "ABSENT")).isEqualTo("PENDING");
        assertThat(TrainingActivityService.resultOnAttendance(Map.of("kind", "EXTERNAL"), Map.of("participation_role", "TRAINEE"), "ABSENT")).isEqualTo("PENDING");
    }

    @Test
    void aRoleOtherThanTraineeNeedsAReason() {
        activity("NOTIFIED", "INTERNAL");
        session("CLASSROOM");
        participant("TRAINEE", null, "INVITED", "PENDING", UUID.randomUUID());
        usedResults(0);

        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("ATTENDEE", "  ")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_REASON_REQUIRED");
        verify(jdbc, never()).update(contains("participation_role=?"), any(), any(), any(), any(), any());
    }

    @Test
    void theTrainerIsNotARoleOnTheList() {
        activity("NOTIFIED", "INTERNAL");
        session("CLASSROOM");
        participant("TRAINEE", null, "INVITED", "PENDING", UUID.randomUUID());

        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("TRAINER", "r")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_PARTICIPATION_INVALID");
    }

    @Test
    void anUnknownRoleIsRefused() {
        activity("NOTIFIED", "INTERNAL");
        session("CLASSROOM");
        participant("TRAINEE", null, "INVITED", "PENDING", UUID.randomUUID());

        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("MANAGER", "r")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_PARTICIPATION_INVALID");
    }

    @Test
    void aPersonDoesNotSetTheirOwnRole() {
        activity("IN_PROGRESS", "INTERNAL");
        session("CLASSROOM");
        participant("TRAINEE", null, "ATTENDED", "PENDING", actor.getId());

        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("ATTENDEE", "Senior management attending")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(TrainingApprovalService.SEGREGATION);
    }

    @Test
    void theRoleDoesNotApplyToAnExternalTrainingOrASelfReading() {
        activity("NOTIFIED", "EXTERNAL");
        session(null);
        participant("TRAINEE", null, "INVITED", "PENDING", UUID.randomUUID());
        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("ATTENDEE", "r")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_PARTICIPATION_NOT_APPLICABLE");

        activity("NOTIFIED", "INTERNAL");
        session("SELF_READING");
        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("ATTENDEE", "r")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_PARTICIPATION_NOT_APPLICABLE");
    }

    @Test
    void theRoleIsLockedOnceThePersonHasAScoreAnAttemptOrATypedResult() {
        activity("IN_PROGRESS", "INTERNAL");
        session("CLASSROOM");
        participant("TRAINEE", null, "ATTENDED", "PASSED", UUID.randomUUID());
        usedResults(1);

        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("ATTENDEE", "Senior management attending")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_PARTICIPATION_HAS_RESULT");
        verify(jdbc, never()).update(contains("participation_role=?"), any(), any(), any(), any(), any());
    }

    @Test
    void theRoleIsLockedOnceTheTrainerFinishedTheTraining() {
        Map<String, Object> a = activity("IN_PROGRESS", "INTERNAL");
        a.put("results_finished_at", java.sql.Timestamp.valueOf("2026-10-20 10:00:00"));
        participant("TRAINEE", null, "ATTENDED", "PENDING", UUID.randomUUID());

        assertThatThrownBy(() -> service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("ATTENDEE", "r")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_ALREADY_FINISHED");
    }

    @Test
    void aPersonWhoAlreadyAttendedBecomesDoneWhenTheyTakeNoAssessmentAndWaitsAgainAsATrainee() {
        activity("IN_PROGRESS", "INTERNAL");
        session("CLASSROOM");
        participant("TRAINEE", null, "ATTENDED", "PENDING", UUID.randomUUID());
        usedResults(0);

        service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("ATTENDEE", "Senior management attending"));
        verify(jdbc).update(contains("participation_role=?"), eq("ATTENDEE"), eq("Senior management attending"), any(), eq("PASSED"), eq(participantId));

        participant("ATTENDEE", "Senior management attending", "ATTENDED", "PASSED", UUID.randomUUID());
        service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("TRAINEE", null));
        verify(jdbc).update(contains("participation_role=?"), eq("TRAINEE"), eq(null), any(), eq("PENDING"), eq(participantId));
    }

    @Test
    void thePersonThenHasTheirResultWrittenAsTheRoleSaysWhereAuditIsKept() {
        activity("NOTIFIED", "INTERNAL");
        session("CLASSROOM");
        participant("TRAINEE", null, "INVITED", "PENDING", UUID.randomUUID());
        usedResults(0);

        service.setParticipation(actor, participantId, new TrainingActivityService.ParticipationRequest("NAME_ONLY", "Senior management attending"));

        // Before the training the person has not attended, so the result stays as it was; the audit trail keeps the old and the new role and the reason.
        verify(jdbc).update(contains("participation_role=?"), eq("NAME_ONLY"), eq("Senior management attending"), any(), eq("PENDING"), eq(participantId));
        verify(store).auditActivity(any(), any(), eq("TRAINING_PARTICIPATION_SET"), eq("TRAINEE"), eq("NAME_ONLY"), contains("Senior management attending"));
        verify(store, never()).auditActivity(any(), any(), eq("TRAINING_ATTENDANCE_RECORDED"), anyString(), anyString(), anyString());
    }
}
