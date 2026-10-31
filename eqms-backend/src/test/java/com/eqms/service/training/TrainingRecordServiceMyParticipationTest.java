package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The screen where an employee reads a training and signs the reading (self-reading) needs only {@code training.self.view} and is only for the person invited (UAT 2026-10-31, owner choice "own screen for the
 * employee"): the answer is read with the id of the person in the query, so another person's invitation gives nothing, and it holds no other participant.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingRecordServiceMyParticipationTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock ElectronicSignatureService signatures;

    private final UUID personId = UUID.randomUUID();
    private final UUID participantId = UUID.randomUUID();
    private final UUID activityId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingRecordService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(personId);
        service = new TrainingRecordService(jdbc, access, store, signatures);
    }

    private Map<String, Object> line(String status, String state, String method) {
        Map<String, Object> row = new HashMap<>();
        row.put("participant_id", participantId);
        row.put("activity_id", activityId);
        row.put("training_number", "TRN/QA/26-900");
        row.put("status", status);
        row.put("state", state);
        row.put("method", method);
        row.put("session_status", "PLANNED");
        return row;
    }

    @Test
    void theInvitationOfAnotherPersonGivesNothing() {
        when(jdbc.queryForList(contains("from training_participants p join training_activities a"), any(Object[].class))).thenReturn(List.of());

        assertThatThrownBy(() -> service.myParticipation(actor, participantId)).isInstanceOf(SecurityException.class);
        // the person who is logged in is part of the query: the row is never read for somebody else
        verify(jdbc).queryForList(contains("p.id = ? and p.person_user_id = ?"), eq(new Object[] {participantId, personId}));
    }

    @Test
    void withoutThePermissionToSeeOwnTrainingNothingIsRead() {
        doThrow(new SecurityException(TrainingAccess.DENIED)).when(access).require(actor, "training.self.view");

        assertThatThrownBy(() -> service.myParticipation(actor, participantId)).isInstanceOf(SecurityException.class);
        verify(jdbc, never()).queryForList(contains("from training_participants"), any(Object[].class));
    }

    @Test
    void anInvitedPersonOfAnOpenSelfReadingMayConfirmTheReading() {
        when(jdbc.queryForList(contains("from training_participants p join training_activities a"), any(Object[].class))).thenReturn(List.of(line("IN_PROGRESS", "INVITED", "SELF_READING")));
        when(jdbc.queryForList(contains("from training_materials m"), any(Object[].class))).thenReturn(List.of(Map.of("id", UUID.randomUUID(), "title", "SOP link", "link_url", "https://example.com/sop")));

        Map<String, Object> out = service.myParticipation(actor, participantId);

        assertThat(out.get("canConfirmRead")).isEqualTo(true);
        assertThat((List<?>) out.get("materials")).hasSize(1);
        assertThat(out).doesNotContainKeys("participants", "selfReadingDepartments");
    }

    @Test
    void theReadingCannotBeConfirmedAgainOrOutsideAnOpenSelfReading() {
        when(jdbc.queryForList(contains("from training_materials m"), any(Object[].class))).thenReturn(List.of());

        when(jdbc.queryForList(contains("from training_participants p join training_activities a"), any(Object[].class))).thenReturn(List.of(line("IN_PROGRESS", "READ_CONFIRMED", "SELF_READING")));
        assertThat(service.myParticipation(actor, participantId).get("canConfirmRead")).isEqualTo(false);

        when(jdbc.queryForList(contains("from training_participants p join training_activities a"), any(Object[].class))).thenReturn(List.of(line("COMPLETED", "INVITED", "SELF_READING")));
        assertThat(service.myParticipation(actor, participantId).get("canConfirmRead")).isEqualTo(false);

        when(jdbc.queryForList(contains("from training_participants p join training_activities a"), any(Object[].class))).thenReturn(List.of(line("IN_PROGRESS", "INVITED", "CLASSROOM")));
        assertThat(service.myParticipation(actor, participantId).get("canConfirmRead")).isEqualTo(false);
    }
}
