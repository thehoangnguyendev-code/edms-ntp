package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * Reminds the Reviewer/Approver a revision is waiting on, and escalates to Document Control when
 * it waits longer. Thresholds come from Document Properties (0 = off). Each assignment is
 * reminded/escalated once per waiting period (tracked on the participant row).
 */
@Service
public class WorkflowReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(WorkflowReminderScheduler.class);
    private static final List<String> WAITING_STATUSES = List.of("PENDING_REVIEW", "PENDING_APPROVAL");

    private final RevisionWorkflowParticipantRepository participantRepository;
    private final UserAccountRepository userRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SystemConfigurationService systemConfigurationService;
    private final NotificationDispatcher notificationDispatcher;
    private final DistributedSchedulerLockService schedulerLockService;

    public WorkflowReminderScheduler(
            RevisionWorkflowParticipantRepository participantRepository,
            UserAccountRepository userRepository,
            PermissionEvaluationService permissionEvaluationService,
            SystemConfigurationService systemConfigurationService,
            NotificationDispatcher notificationDispatcher,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.participantRepository = participantRepository;
        this.userRepository = userRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.systemConfigurationService = systemConfigurationService;
        this.notificationDispatcher = notificationDispatcher;
        this.schedulerLockService = schedulerLockService;
    }

    @Scheduled(cron = "0 30 7 * * *")
    @Transactional
    public void run() {
        try (var lease = schedulerLockService.tryAcquire("workflow-action-reminders", Duration.ofMinutes(15))) {
            if (!lease.acquired()) {
                log.warn("Skipping workflow reminder run because another instance owns the lease or Redis is unavailable");
                return;
            }
            remindAndEscalate(Instant.now());
        } catch (Exception ex) {
            log.error("Workflow reminder run failed", ex);
        }
    }

    /** Package-visible so a test can drive it with a fixed clock. */
    void remindAndEscalate(Instant now) {
        int remindAfter = systemConfigurationService.getWorkflowReminderAfterDays();
        int escalateAfter = systemConfigurationService.getWorkflowEscalationAfterDays();
        if (remindAfter <= 0 && escalateAfter <= 0) {
            return;
        }
        List<UserAccount> coordinators = null;
        for (RevisionWorkflowParticipant participant
                : participantRepository.findAllByActionStatusAndRevision_Status_CodeIn("PENDING", WAITING_STATUSES)) {
            DocumentRevisionRecord revision = participant.getRevision();
            if (revision == null || participant.getUser() == null
                    || !isWaitingOn(revision, participant)) {
                continue;
            }
            Instant since = waitingSince(revision);
            if (since == null) {
                continue;
            }
            long days = Duration.between(since, now).toDays();
            UserAccount assignee = participant.getUser();
            if (escalateAfter > 0 && days >= escalateAfter && participant.getEscalatedAt() == null) {
                if (coordinators == null) {
                    coordinators = userRepository.findAllByStatus(UserStatus.Active).stream()
                            .filter(u -> permissionEvaluationService.hasPermission(u, "documents.workspace.manage"))
                            .toList();
                }
                if (!coordinators.isEmpty()) {
                    notificationDispatcher.dispatch("document.action_escalated", coordinators,
                            variables(revision, participant, assignee, days));
                }
                participant.setEscalatedAt(now);
                participantRepository.save(participant);
            }
            if (remindAfter > 0 && days >= remindAfter && participant.getLastRemindedAt() == null
                    && assignee.getStatus() == UserStatus.Active) {
                notificationDispatcher.dispatch("document.action_reminder", List.of(assignee),
                        variables(revision, participant, assignee, days));
                participant.setLastRemindedAt(now);
                participantRepository.save(participant);
            }
        }
    }

    /** In sequential mode only the next assignee is blocking the revision; in parallel every pending one is. */
    private boolean isWaitingOn(DocumentRevisionRecord revision, RevisionWorkflowParticipant participant) {
        String type = participant.getParticipantType();
        String status = revision.getStatus() == null ? "" : revision.getStatus().getCode();
        boolean stageMatches = ("REVIEWER".equals(type) && "PENDING_REVIEW".equals(status))
                || ("APPROVER".equals(type) && "PENDING_APPROVAL".equals(status));
        if (!stageMatches) {
            return false;
        }
        Boolean sequential = ReviewFlowMode.sequenceEnforcedOrNull(type, revision.getReviewFlowMode());
        boolean enforced = sequential != null ? sequential : !"REVIEWER".equals(type)
                || !systemConfigurationService.isParallelReviewEnabled();
        if (!enforced) {
            return true;
        }
        return participantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), type).stream()
                .filter(p -> "PENDING".equalsIgnoreCase(p.getActionStatus()))
                .findFirst()
                .map(p -> Objects.equals(p.getId(), participant.getId()))
                .orElse(false);
    }

    private Instant waitingSince(DocumentRevisionRecord revision) {
        Instant since = revision.getSubmittedOn();
        List<RevisionWorkflowParticipant> all = participantRepository
                .findAllByRevision_IdOrderByParticipantTypeAscSequenceOrderAsc(revision.getId());
        Instant lastAction = all.stream().map(RevisionWorkflowParticipant::getActedAt).filter(Objects::nonNull)
                .max(Instant::compareTo).orElse(null);
        return Stream.of(since, lastAction).filter(Objects::nonNull).max(Instant::compareTo).orElse(null);
    }

    private Map<String, String> variables(DocumentRevisionRecord revision, RevisionWorkflowParticipant participant,
                                          UserAccount assignee, long days) {
        DocumentRecord document = revision.getDocument();
        Map<String, String> variables = new HashMap<>();
        variables.put("documentNumber", document == null || document.getDocumentNumber() == null ? "" : document.getDocumentNumber());
        variables.put("documentTitle", document == null || document.getDocumentName() == null ? "" : document.getDocumentName());
        variables.put("revisionNumber", revision.getRevisionNumber() == null ? "" : revision.getRevisionNumber());
        variables.put("participantType", participant.getParticipantType().toLowerCase(Locale.ROOT));
        variables.put("userName", assignee.getFullName() == null ? assignee.getUsername() : assignee.getFullName());
        variables.put("daysPending", String.valueOf(days));
        String area = "REVIEWER".equals(participant.getParticipantType()) ? "review" : "approval";
        variables.put("actionUrl", "/documents/revisions/" + area + "/" + revision.getId());
        variables.put("relatedEntityType", "revision");
        variables.put("relatedEntityId", String.valueOf(revision.getId()));
        return variables;
    }
}
