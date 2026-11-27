package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DistributedSchedulerLockService;
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
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The alerts of DEC-TRAINING-2026-11-27-01 H: who may dismiss one, what it takes, and that nobody outside the scope sees or ends another department's alert. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingPersonnelEventServiceTest {
    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock UserAccountRepository users;
    @Mock TrainingRecipients recipients;
    @Mock TrainingNotifier notifier;
    @Mock AuditTrailService audit;
    @Mock ElectronicSignatureService signatures;
    @Mock DistributedSchedulerLockService locks;

    private final UserAccount actor = mock(UserAccount.class);
    private final UUID eventId = UUID.randomUUID();
    private final UUID personId = UUID.randomUUID();
    private final UUID department = UUID.randomUUID();
    private TrainingPersonnelEventService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        Map<String, Object> open = new HashMap<>();
        open.put("id", eventId); open.put("person_user_id", personId); open.put("status", "OPEN"); open.put("kind", "ABSENCE_RETURN");
        when(jdbc.queryForList(contains("from training_personnel_events where id = ? for update"), eq(eventId))).thenReturn(List.of(open));
        UserAccount person = mock(UserAccount.class);
        when(users.findById(personId)).thenReturn(Optional.of(person));
        when(access.departmentOf(person)).thenReturn(department);
        when(access.inScope(actor, department)).thenReturn(true);
        service = new TrainingPersonnelEventService(jdbc, access, users, recipients, notifier, audit, signatures, locks);
    }

    @Test
    void anAlertIsDismissedOnlyWithAReasonAndASignature() {
        assertThatThrownBy(() -> service.dismiss(actor, eventId, new TrainingPersonnelEventService.DismissRequest(" ", "token"))).hasMessage("TRAINING_REASON_REQUIRED");
        assertThatThrownBy(() -> service.dismiss(actor, eventId, new TrainingPersonnelEventService.DismissRequest("Rotation, nothing to repeat", null))).hasMessage("TRAINING_SIGNATURE_REQUIRED");
        assertThatThrownBy(() -> service.dismiss(actor, eventId, new TrainingPersonnelEventService.DismissRequest("x".repeat(301), "token"))).hasMessage("TRAINING_NOTE_TOO_LONG");
        verify(jdbc, never()).update(contains("set status = 'DISMISSED'"), any(Object[].class));
        verify(signatures, never()).createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aPersonOfAnotherDepartmentCannotEndTheAlert() {
        when(access.inScope(actor, department)).thenReturn(false);
        when(access.allDepartments(actor)).thenReturn(false);

        assertThatThrownBy(() -> service.dismiss(actor, eventId, new TrainingPersonnelEventService.DismissRequest("reason", "token"))).isInstanceOf(SecurityException.class);
        verify(signatures, never()).createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aClosedAlertCannotBeDismissedAgain() {
        Map<String, Object> closed = new HashMap<>();
        closed.put("id", eventId); closed.put("person_user_id", personId); closed.put("status", "HANDLED");
        when(jdbc.queryForList(contains("from training_personnel_events where id = ? for update"), eq(eventId))).thenReturn(List.of(closed));

        assertThatThrownBy(() -> service.dismiss(actor, eventId, new TrainingPersonnelEventService.DismissRequest("reason", "token")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_PERSONNEL_EVENT_CLOSED");
    }

    @Test
    void onlyAPersonWhoManagesJobAssignmentsDismissesAndOnlyAnAdministratorScansByHand() {
        doThrow(new SecurityException("denied")).when(access).require(actor, "training.job_assignment.manage");
        doThrow(new SecurityException("denied")).when(access).require(actor, "training.admin.manage");

        assertThatThrownBy(() -> service.dismiss(actor, eventId, new TrainingPersonnelEventService.DismissRequest("reason", "token"))).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.scanNow(actor)).isInstanceOf(SecurityException.class);
        assertThat(service.openCount(actor)).isZero();
    }
}
