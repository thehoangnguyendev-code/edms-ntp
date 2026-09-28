package com.eqms.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UserAccountRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorkflowReminderSchedulerTest {

    @Mock private RevisionWorkflowParticipantRepository participantRepository;
    @Mock private UserAccountRepository userRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private SystemConfigurationService systemConfigurationService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private DistributedSchedulerLockService schedulerLockService;

    private WorkflowReminderScheduler scheduler;
    private final Instant now = Instant.parse("2026-09-21T00:00:00Z");
    private RevisionWorkflowParticipant participant;
    private UserAccount assignee;
    private UserAccount coordinator;

    @BeforeEach
    void setUp() {
        scheduler = new WorkflowReminderScheduler(participantRepository, userRepository, permissionEvaluationService,
                systemConfigurationService, notificationDispatcher, schedulerLockService);
        lenient().when(systemConfigurationService.getWorkflowReminderAfterDays()).thenReturn(3);
        lenient().when(systemConfigurationService.getWorkflowEscalationAfterDays()).thenReturn(7);

        assignee = user("reviewer");
        coordinator = user("dco");
        lenient().when(userRepository.findAllByStatus(UserStatus.Active)).thenReturn(List.of(assignee, coordinator));
        lenient().when(permissionEvaluationService.hasPermission(coordinator, "documents.workspace.manage")).thenReturn(true);

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode("PENDING_REVIEW");
        revision.setStatus(status);
        revision.setDocument(new DocumentRecord());
        revision.setReviewFlowMode(ReviewFlowMode.PARALLEL);

        participant = new RevisionWorkflowParticipant();
        participant.setId(UUID.randomUUID());
        participant.setRevision(revision);
        participant.setUser(assignee);
        participant.setParticipantType("REVIEWER");
        participant.setActionStatus("PENDING");
        lenient().when(participantRepository.findAllByActionStatusAndRevision_Status_CodeIn(eq("PENDING"), anyList()))
                .thenReturn(List.of(participant));
        lenient().when(participantRepository.findAllByRevision_IdOrderByParticipantTypeAscSequenceOrderAsc(revision.getId()))
                .thenReturn(List.of(participant));
    }

    private UserAccount user(String name) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setUsername(name);
        u.setStatus(UserStatus.Active);
        return u;
    }

    private void waitingFor(Duration duration) {
        participant.getRevision().setSubmittedOn(now.minus(duration));
    }

    @Test
    void doesNothingBeforeTheReminderPeriod() {
        waitingFor(Duration.ofDays(1));
        scheduler.remindAndEscalate(now);
        verify(notificationDispatcher, never()).dispatch(any(), anyList(), anyMap());
    }

    @Test
    void remindsTheAssigneeOnceAfterTheReminderPeriod() {
        waitingFor(Duration.ofDays(4));
        scheduler.remindAndEscalate(now);
        verify(notificationDispatcher).dispatch(eq("document.action_reminder"), eq(List.of(assignee)), anyMap());
        verify(notificationDispatcher, never()).dispatch(eq("document.action_escalated"), anyList(), anyMap());
        assertNotNull(participant.getLastRemindedAt());

        scheduler.remindAndEscalate(now.plus(Duration.ofDays(1)));
        verify(notificationDispatcher).dispatch(eq("document.action_reminder"), anyList(), anyMap());
    }

    @Test
    void escalatesToDocumentControlAfterTheEscalationPeriod() {
        waitingFor(Duration.ofDays(8));
        scheduler.remindAndEscalate(now);
        verify(notificationDispatcher).dispatch(eq("document.action_escalated"), eq(List.of(coordinator)), anyMap());
        assertNotNull(participant.getEscalatedAt());
    }

    @Test
    void doesNotRemindAnAssigneeWhoCannotActAnymore() {
        assignee.setStatus(UserStatus.Suspended);
        waitingFor(Duration.ofDays(4));
        scheduler.remindAndEscalate(now);
        verify(notificationDispatcher, never()).dispatch(eq("document.action_reminder"), anyList(), anyMap());
        assertNull(participant.getLastRemindedAt());
    }

    @Test
    void zeroDaysSwitchesRemindersOff() {
        when(systemConfigurationService.getWorkflowReminderAfterDays()).thenReturn(0);
        when(systemConfigurationService.getWorkflowEscalationAfterDays()).thenReturn(0);
        waitingFor(Duration.ofDays(30));
        scheduler.remindAndEscalate(now);
        verify(notificationDispatcher, never()).dispatch(any(), anyList(), anyMap());
    }

    @Test
    void sequentialModeOnlyRemindsTheNextPendingReviewer() {
        participant.getRevision().setReviewFlowMode(ReviewFlowMode.SEQUENTIAL);
        RevisionWorkflowParticipant first = new RevisionWorkflowParticipant();
        first.setId(UUID.randomUUID());
        first.setRevision(participant.getRevision());
        first.setUser(user("first"));
        first.setParticipantType("REVIEWER");
        first.setActionStatus("PENDING");
        when(participantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(
                participant.getRevision().getId(), "REVIEWER")).thenReturn(List.of(first, participant));
        waitingFor(Duration.ofDays(4));
        scheduler.remindAndEscalate(now);
        verify(notificationDispatcher, never()).dispatch(any(), anyList(), anyMap());
    }
}
