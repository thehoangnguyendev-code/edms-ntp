package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.event.DocumentObsoletedEvent;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * TBR-DOC-016: Document Obsolete notification, dispatched only after the lifecycle transaction
 * commits. Reuses the project-standard after-commit pattern already used by
 * PublishingWorkspaceJobProcessorService (@Async + @TransactionalEventListener(AFTER_COMMIT)) and
 * the existing NotificationDispatcher/EmailNotificationService -- including its live
 * NotificationDeliveryFailure durable-failure/manual-retry tracking. No new notification
 * subsystem is introduced.
 */
@Service
public class DocumentObsoleteNotificationService {

    public static final String EVENT_CODE = "document.obsoleted";
    private static final String DCO_PERMISSION_CODE = "documents.workspace.manage";

    private final DocumentRecordRepository documentRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final UserAccountRepository userAccountRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final NotificationDispatcher notificationDispatcher;
    private final TransactionTemplate readOnlyTransactionTemplate;

    public DocumentObsoleteNotificationService(
            DocumentRecordRepository documentRepository,
            ControlledCopyRepository controlledCopyRepository,
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService,
            NotificationDispatcher notificationDispatcher,
            PlatformTransactionManager transactionManager
    ) {
        this.documentRepository = documentRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.userAccountRepository = userAccountRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.notificationDispatcher = notificationDispatcher;
        this.readOnlyTransactionTemplate = new TransactionTemplate(transactionManager);
        this.readOnlyTransactionTemplate.setReadOnly(true);
    }

    // Executor choice (verified this pass, targeted read of config/AsyncConfig.java): mfaEmailExecutor
    // is explicitly documented as reserved for "latency-sensitive OTP emails, must never wait behind
    // anything" -- MFA-specific, not general-purpose, despite the generic-sounding name. It is NOT
    // reused here. PublishingWorkspaceJobProcessorService (the source of the @Async +
    // @TransactionalEventListener(AFTER_COMMIT) pattern this class borrows) actually uses
    // "fileProcessingExecutor", not mfaEmailExecutor -- that earlier claim was incorrect and is
    // corrected here. fileProcessingExecutor is sized/named for CPU-bound PDF/DOCX composition, not
    // email dispatch, so it is also not a semantic fit. Of the four existing pools, "integrationExecutor"
    // (outbound calls that "mostly block on network I/O rather than local CPU", per AsyncConfig's own
    // doc comment) is the closest existing fit for an outbound SMTP send -- reused here as a judgment
    // call rather than adding a fifth pool. FLAG FOR HUMAN CONFIRMATION: no existing executor is a
    // perfect "general notification/after-commit" pool; introducing a dedicated one is a design
    // decision intentionally left to a human rather than added unrequested by this change.
    /**
     * Recipient resolution -- specifically {@code UserAccount.avatar}, a {@code @Lob}/CLOB column
     * -- requires an active (non-autocommit) JDBC transaction: PgJDBC streams a materialized CLOB
     * through its Large Object API, which throws "Large Objects may not be used in auto-commit
     * mode" outside a transaction. This {@code @TransactionalEventListener(AFTER_COMMIT)} method
     * runs on a fresh {@code @Async} thread with no surrounding transaction, so the connection is
     * in autocommit mode by default -- reproduced directly against the real dev Postgres instance
     * (a bare, non-transactional call to UserAccountRepository.findAllByStatus fails the same way;
     * wrapping the same call in a readOnly transaction fixes it). Scoped to only the DB-reading
     * portion (not the call to notificationDispatcher.dispatch(), which has its own
     * write-transaction semantics) via an explicit TransactionTemplate rather than a class-level/
     * method-level @Transactional, both because self-invocation between methods on this same bean
     * would bypass Spring's transactional proxy, and to avoid a readOnly transaction leaking into
     * dispatch()'s own persistence (in-app notification / delivery-failure / dispatch-queue writes).
     */
    @Async("integrationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDocumentObsoleted(DocumentObsoletedEvent event) {
        RecipientResolution resolution = readOnlyTransactionTemplate.execute(status -> {
            DocumentRecord document = documentRepository.findById(event.documentId()).orElse(null);
            if (document == null) {
                return null;
            }

            List<UserAccount> recipients = new ArrayList<>();
            if (document.getAuthor() != null) {
                recipients.add(document.getAuthor());
            }
            recipients.addAll(resolveDcoUsers());
            recipients.addAll(resolveDistributedCopyRecipients(event.documentId()));

            List<UserAccount> distinctRecipients = recipients.stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();

            return new RecipientResolution(document.getDocumentNumber(), document.getDocumentName(), distinctRecipients);
        });

        if (resolution == null || resolution.recipients().isEmpty()) {
            return;
        }

        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("documentNumber", resolution.documentNumber());
        variables.put("documentTitle", resolution.documentTitle());
        notificationDispatcher.dispatch(EVENT_CODE, resolution.recipients(), variables);
    }

    private record RecipientResolution(String documentNumber, String documentTitle, List<UserAccount> recipients) {
    }

    /** Notification Recipient eligibility is entitlement-based -- never a tenant-editable role
     *  label -- matching the same pattern already used by ControlledCopyExpiryScheduler. */
    private List<UserAccount> resolveDcoUsers() {
        return userAccountRepository.findAllByStatus(UserStatus.Active).stream()
                .filter(Objects::nonNull)
                .filter(user -> permissionEvaluationService.hasPermission(user, DCO_PERMISSION_CODE))
                .toList();
    }

    /**
     * Only a Controlled Copy that was actually DISTRIBUTED (distributedAt != null) before this
     * Document Obsolete action is notified -- a copy that was still only Ready-for-Distribution
     * never reached a recipient, so there is nothing to inform them about (per the approved
     * TO-BE requirement's explicit exclusion). obsoleteReason=DOCUMENT_OBSOLETED scopes this to
     * copies obsoleted specifically by this action (a Document can only be obsoleted once, so this
     * reason code cannot originate from an earlier, unrelated Obsolete of the same Document).
     */
    private List<UserAccount> resolveDistributedCopyRecipients(java.util.UUID documentId) {
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByRevision_Document_IdOrderByCreatedAtDesc(documentId);
        List<UserAccount> result = new ArrayList<>();
        for (ControlledCopyRecord copy : copies) {
            if (copy == null || copy.getRecipientUser() == null || copy.getDistributedAt() == null) {
                continue;
            }
            if (!"OBSOLETED".equalsIgnoreCase(copy.getStatusCode())
                    || !"DOCUMENT_OBSOLETED".equalsIgnoreCase(copy.getObsoleteReason())) {
                continue;
            }
            result.add(copy.getRecipientUser());
        }
        return result;
    }
}
