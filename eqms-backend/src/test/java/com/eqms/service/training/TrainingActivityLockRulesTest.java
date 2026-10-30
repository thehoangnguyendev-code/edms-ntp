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

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

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

/** What can be changed in which status of a training activity: the title and the plan until it is notified, the remarks until it is completed, the session before the training starts. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingActivityLockRulesTest {

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
    private final UUID departmentId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingActivityService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getId()).thenReturn(UUID.randomUUID());
        when(signatures.createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);
        service = spy(new TrainingActivityService(jdbc, access, store, null, null, approvals, signatures, users, notifier, null, suspensions, null));
        doReturn(Map.of()).when(service).get(any(), any());
    }

    private Map<String, Object> activity(String status) {
        Map<String, Object> a = new HashMap<>();
        a.put("id", activityId);
        a.put("status", status);
        a.put("version", 3);
        a.put("kind", "INTERNAL");
        a.put("training_number", "TRN/QA/26-001");
        a.put("organizer_department_id", departmentId);
        when(store.activityForUpdate(activityId)).thenReturn(Optional.of(a));
        return a;
    }

    private void session(String status) {
        Map<String, Object> s = new HashMap<>();
        s.put("id", sessionId);
        s.put("activity_id", activityId);
        s.put("session_no", 1);
        s.put("status", "HELD".equals(status) ? "PLANNED" : status);
        s.put("held_on", "HELD".equals(status) ? java.sql.Date.valueOf("2026-10-20") : null);
        s.put("location_type", "ONSITE");
        s.put("venue", "Room 1");
        s.put("trainer_user_id", null);
        s.put("external_trainer_name", "Old Trainer");
        when(jdbc.queryForList(contains("select * from training_sessions where id=?"), eq(sessionId))).thenReturn(List.of(s));
    }

    private TrainingActivityService.SessionUpdateRequest change(String reason) {
        return new TrainingActivityService.SessionUpdateRequest(null, "New Trainer", LocalDate.of(2026, 11, 2), "Room 2", "ONSITE", null, null, reason);
    }

    @Test
    void theRemarksCanStillBeChangedOnceTheActivityIsInProgress() {
        activity("IN_PROGRESS");

        service.update(actor, activityId, new TrainingActivityService.UpdateRequest(3, null, "A new remark", null, null));

        verify(jdbc).update(contains("update training_activities set due_date=?"), any(), eq("A new remark"), any(), any(), eq(activityId));
    }

    @Test
    void theDueDateCannotBeChangedAfterTheActivityIsNotified() {
        activity("NOTIFIED");

        assertThatThrownBy(() -> service.update(actor, activityId, new TrainingActivityService.UpdateRequest(3, LocalDate.of(2027, 1, 1), "r", null, null)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_ACTIVITY_FIELD_LOCKED");
        verify(jdbc, never()).update(contains("update training_activities set due_date=?"), any(), any(), any(), any(), any(), any());
    }

    @Test
    void nothingCanBeChangedOnceTheActivityIsCompleted() {
        activity("COMPLETED");

        assertThatThrownBy(() -> service.update(actor, activityId, new TrainingActivityService.UpdateRequest(3, null, "r", null, null)))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void theTrainerAndThePlaceOfASessionCanBeChangedBeforeTheTrainingStartsAndAreAudited() {
        activity("NOTIFIED");
        session("PLANNED");

        service.updateSession(actor, sessionId, change("Trainer is ill"));

        verify(jdbc).update(contains("update training_sessions set trainer_user_id=?"), any(), eq("New Trainer"), any(), eq("Room 2"), eq("ONSITE"), any(), any(), eq(sessionId));
        verify(store).auditActivity(eq(actor), any(), eq("TRAINING_SESSION_UPDATED"), any(), any(), contains("Trainer is ill"), any(List.class));
    }

    @Test
    void aSessionCannotBeChangedOnceTheTrainingIsInProgress() {
        activity("IN_PROGRESS");
        session("PLANNED");

        assertThatThrownBy(() -> service.updateSession(actor, sessionId, change("why"))).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void aSessionThatHasBeenHeldCannotBeChanged() {
        activity("NOTIFIED");
        session("HELD");

        assertThatThrownBy(() -> service.updateSession(actor, sessionId, change("why")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_SESSION_STARTED");
    }

    @Test
    void aSessionChangeNeedsAReason() {
        activity("PLANNED");
        session("PLANNED");

        assertThatThrownBy(() -> service.updateSession(actor, sessionId, change(" ")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_REASON_REQUIRED");
    }

    @Test
    void reopeningContentNeedsContentThatWasReviewedOrApproved() {
        activity("PLANNED");
        when(jdbc.queryForList(contains("from training_active_confirmations where activity_id=? and kind in"), eq(activityId))).thenReturn(List.of());

        assertThatThrownBy(() -> service.reopenContent(actor, activityId, new TrainingActivityService.CommandRequest(3, "wrong slide", "token")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_CONTENT_NOT_APPROVED");
    }

    @Test
    void reopeningContentKeepsTheConfirmationsAsHistoryAndSendsANotifiedActivityBackToPlanned() {
        activity("NOTIFIED");
        UUID reviewed = UUID.randomUUID();
        UUID approved = UUID.randomUUID();
        when(jdbc.queryForList(contains("from training_active_confirmations where activity_id=? and kind in"), eq(activityId)))
                .thenReturn(List.of(Map.of("id", reviewed, "kind", "CONTENT_REVIEWED"), Map.of("id", approved, "kind", "CONTENT_APPROVED")));

        service.reopenContent(actor, activityId, new TrainingActivityService.CommandRequest(3, "wrong slide", "token"));

        verify(jdbc).update(contains("insert into training_confirmation_supersessions"), eq(reviewed), any(), eq("wrong slide"), any());
        verify(jdbc).update(contains("insert into training_confirmation_supersessions"), eq(approved), any(), eq("wrong slide"), any());
        verify(store).setStatus(activityId, "PLANNED");
    }

    @Test
    void theResultsCanBeReturnedForCorrectionOnlyWhileTheyWaitForQa() {
        activity("IN_PROGRESS");

        assertThatThrownBy(() -> service.returnForCorrection(actor, activityId, new TrainingActivityService.CommandRequest(3, "score wrong", "token")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void returningTheResultsNeedsAReasonAndSendsTheActivityBackToInProgress() {
        activity("PENDING_QA_CONFIRMATION");

        assertThatThrownBy(() -> service.returnForCorrection(actor, activityId, new TrainingActivityService.CommandRequest(3, " ", "token")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_REASON_REQUIRED");

        service.returnForCorrection(actor, activityId, new TrainingActivityService.CommandRequest(3, "score wrong", "token"));

        verify(store).setStatus(activityId, "IN_PROGRESS");
    }

    @Test
    void anActivityThatIsOnlyPlannedIsCancelledWithAReasonAndTheSignatureToo() {
        activity("PLANNED");
        when(jdbc.queryForObject(contains("result='PASSED'"), eq(Integer.class), eq(activityId))).thenReturn(0);

        assertThatThrownBy(() -> service.cancel(actor, activityId, new TrainingActivityService.CommandRequest(3, "Document withdrawn", null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_SIGNATURE_REQUIRED");
        verify(store, never()).cancel(any(), any(), any());

        service.cancel(actor, activityId, new TrainingActivityService.CommandRequest(3, "Document withdrawn", "token"));

        verify(signatures).createEntitySignature(any(), any(), any(), any(), eq("token"), eq("TRAINING_ACTIVITY_CANCELLED"), any(), any(), any(), any());
        verify(store).cancel(any(), eq("Document withdrawn"), eq(actor));
    }

    @Test
    void anActivityThatWasNotifiedCannotBeCancelledWithoutASignature() {
        activity("NOTIFIED");
        when(jdbc.queryForObject(contains("result='PASSED'"), eq(Integer.class), eq(activityId))).thenReturn(0);

        assertThatThrownBy(() -> service.cancel(actor, activityId, new TrainingActivityService.CommandRequest(3, "Trainer left", null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_SIGNATURE_REQUIRED");
        verify(store, never()).cancel(any(), any(), any());
    }

    @Test
    void anActivityThatWasNotifiedIsCancelledWithTheSignature() {
        activity("IN_PROGRESS");
        when(jdbc.queryForObject(contains("result='PASSED'"), eq(Integer.class), eq(activityId))).thenReturn(0);

        service.cancel(actor, activityId, new TrainingActivityService.CommandRequest(3, "Trainer left", "token"));

        verify(signatures).createEntitySignature(any(), any(), any(), any(), eq("token"), eq("TRAINING_ACTIVITY_CANCELLED"), any(), any(), any(), any());
        verify(store).cancel(any(), eq("Trainer left"), eq(actor));
    }

    @Test
    void anActivityWithPeopleWhoPassedCannotBeCancelledEvenWithASignature() {
        activity("IN_PROGRESS");
        when(jdbc.queryForObject(contains("result='PASSED'"), eq(Integer.class), eq(activityId))).thenReturn(2);

        assertThatThrownBy(() -> service.cancel(actor, activityId, new TrainingActivityService.CommandRequest(3, "Trainer left", "token")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_ACTIVITY_HAS_RESULTS");
    }

    @Test
    void postponingAfterTheDueDateMovesTheDueDateToTheEndOfThatMonthOnlyWhenTheUserAgreed() {
        activity("PLANNED").put("due_date", java.sql.Date.valueOf("2026-10-31"));
        session("PLANNED");

        service.postponeSession(actor, sessionId, new TrainingActivityService.PostponeRequest(LocalDate.of(2026, 11, 12), "Trainer is ill", true));

        verify(jdbc).update(contains("update training_activities set due_date=?"), eq(LocalDate.of(2026, 11, 30)), eq(activityId));
        verify(store).auditActivity(any(), any(), eq("TRAINING_DUE_DATE_MOVED"), eq("2026-10-31"), eq("2026-11-30"), eq("Trainer is ill"));
    }

    @Test
    void theLineOfTheRequirementFollowsTheDueDateAndKeepsTheMonthItWasApprovedFor() {
        activity("PLANNED").put("due_date", java.sql.Date.valueOf("2026-10-31"));
        session("PLANNED");
        UUID requirementId = UUID.randomUUID();
        UUID lineId = UUID.randomUUID();
        Map<String, Object> line = new HashMap<>();
        line.put("id", lineId);
        line.put("requirement_id", requirementId);
        line.put("planned_month", java.sql.Date.valueOf("2026-10-01"));
        line.put("postponed_from", null);
        line.put("request_no", "TRQ/26-001");
        UUID qa = UUID.randomUUID();
        line.put("prepared_by", qa);
        line.put("created_by", qa);
        UserAccount qaUser = mock(UserAccount.class);
        when(users.findById(qa)).thenReturn(Optional.of(qaUser));
        when(jdbc.queryForList(contains("from training_requirement_lines l"), eq(activityId))).thenReturn(List.of(line));

        service.postponeSession(actor, sessionId, new TrainingActivityService.PostponeRequest(LocalDate.of(2026, 11, 12), "Trainer is ill", true));

        verify(jdbc).update(contains("update training_requirement_lines set planned_month=?"), eq(LocalDate.of(2026, 11, 1)), eq(java.sql.Date.valueOf("2026-10-01")), eq("Trainer is ill"), eq(lineId));
        verify(store).auditRequirement(any(), eq("TRQ/26-001"), eq(requirementId), eq("TRAINING_REQUIREMENT_LINE_POSTPONED"), eq("2026-10-01"), eq("2026-11-01"), eq("Trainer is ill"));
        // one note to the QA who prepared it, once, and it does not say "later than the month after" for one month
        verify(notifier).send(eq("TRAINING_REQUIREMENT_LINE_MOVED"), eq(qaUser), any(), any(), org.mockito.ArgumentMatchers.argThat(m -> !m.contains("later than")), eq("TRAINING_REQUIREMENT"), eq(requirementId), any());
    }

    @Test
    void aMoveOfMoreThanOneMonthIsToldToQaAsLaterThanTheSopWindow() {
        activity("PLANNED").put("due_date", java.sql.Date.valueOf("2026-10-31"));
        session("PLANNED");
        UUID requirementId = UUID.randomUUID();
        UUID qa = UUID.randomUUID();
        Map<String, Object> line = new HashMap<>();
        line.put("id", UUID.randomUUID());
        line.put("requirement_id", requirementId);
        line.put("planned_month", java.sql.Date.valueOf("2026-10-01"));
        line.put("postponed_from", null);
        line.put("request_no", "TRQ/26-001");
        line.put("prepared_by", qa);
        UserAccount qaUser = mock(UserAccount.class);
        when(users.findById(qa)).thenReturn(Optional.of(qaUser));
        when(jdbc.queryForList(contains("from training_requirement_lines l"), eq(activityId))).thenReturn(List.of(line));

        service.postponeSession(actor, sessionId, new TrainingActivityService.PostponeRequest(LocalDate.of(2026, 12, 3), "Plant shutdown", true));

        verify(notifier).send(eq("TRAINING_REQUIREMENT_LINE_MOVED"), eq(qaUser), any(), any(), org.mockito.ArgumentMatchers.argThat(m -> m.contains("later than")), eq("TRAINING_REQUIREMENT"), eq(requirementId), any());
    }

    @Test
    void theLineIsLeftAloneWhenTheDueDateStays() {
        activity("PLANNED").put("due_date", java.sql.Date.valueOf("2026-10-31"));
        session("PLANNED");

        service.postponeSession(actor, sessionId, new TrainingActivityService.PostponeRequest(LocalDate.of(2026, 11, 12), "Trainer is ill", false));

        verify(jdbc, never()).update(contains("update training_requirement_lines"), any(), any(), any(), any());
    }

    @Test
    void postponingAfterTheDueDateKeepsTheDueDateWhenTheUserDidNotAgree() {
        activity("PLANNED").put("due_date", java.sql.Date.valueOf("2026-10-31"));
        session("PLANNED");

        service.postponeSession(actor, sessionId, new TrainingActivityService.PostponeRequest(LocalDate.of(2026, 11, 12), "Trainer is ill", false));

        verify(jdbc, never()).update(contains("update training_activities set due_date=?"), any(), any());
    }

    @Test
    void postponingWithinTheDueDateNeverTouchesTheDueDate() {
        activity("PLANNED").put("due_date", java.sql.Date.valueOf("2026-10-31"));
        session("PLANNED");

        service.postponeSession(actor, sessionId, new TrainingActivityService.PostponeRequest(LocalDate.of(2026, 10, 28), "Room busy", true));

        verify(jdbc, never()).update(contains("update training_activities set due_date=?"), any(), any());
    }

    private void waitingSelfReading(UUID department) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", UUID.randomUUID());
        row.put("person_user_id", UUID.randomUUID());
        row.put("department_id", department);
        when(jdbc.queryForList(contains("p.state='READ_CONFIRMED' and p.result='PENDING'"), eq(activityId))).thenReturn(List.of(row));
    }

    @Test
    void aDepartmentWithoutAHeadIsConfirmedByWhoMayCloseTheTrainingAndTheRecordSaysSo() {
        activity("IN_PROGRESS");
        waitingSelfReading(departmentId);
        when(access.has(any(), eq("training.activity.close"))).thenReturn(true);
        // no department has a head
        when(jdbc.queryForList(contains("department_head_id is not null"), eq(UUID.class))).thenReturn(List.of());

        service.verifySelfReading(actor, activityId, new TrainingActivityService.CommandRequest(3, null, "token"));

        verify(jdbc).update(contains("insert into training_activity_confirmations"), any(), eq(activityId), any(), eq("HEAD_SELF_READING"), any(), any(),
                org.mockito.ArgumentMatchers.argThat((String m) -> m.contains("in place of the department head")), eq(departmentId));
    }

    @Test
    void aDepartmentThatHasAHeadIsNotConfirmedBySomeoneElseEvenWithTheRightToClose() {
        activity("IN_PROGRESS");
        waitingSelfReading(departmentId);
        when(access.has(any(), eq("training.activity.close"))).thenReturn(true);
        when(jdbc.queryForList(contains("department_head_id is not null"), eq(UUID.class))).thenReturn(List.of(departmentId));

        assertThatThrownBy(() -> service.verifySelfReading(actor, activityId, new TrainingActivityService.CommandRequest(3, null, "token")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_NOT_DEPARTMENT_HEAD");
    }
}
