package com.eqms;

import com.eqms.auth.TokenService;
import com.eqms.controller.NotificationController;
import com.eqms.dto.document.DocumentObsoleteRequest;
import com.eqms.dto.notification.NotificationDeliveryFailureResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Document Lifecycle Closure Batch B: TC-DOC-061 through 067 and TC-DOC-072 (notification only --
 * no frontend, no cascade/concurrency redesign, per instructions). Exercises the REAL
 * DocumentService.obsoleteDocument production path end-to-end, including the real @Async +
 * @TransactionalEventListener(AFTER_COMMIT) DocumentObsoleteNotificationService -> real
 * NotificationDispatcher -> real EmailNotificationService pipeline against the real dev
 * PostgreSQL instance. Only genuinely external/orthogonal boundaries are test-doubled: document
 * lifecycle authorization (already covered by Batch A), permission-grant resolution for the DCO
 * scenario (Access Profile assignment machinery is out of scope here), the outbound SMTP send
 * (EmailService), and the Notification-settings-screen authorization check.
 */
@SpringBootTest
class DocumentObsoleteNotificationTest {

    @Autowired private DocumentService documentService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private ControlledCopyRepository controlledCopyRepository;
    @Autowired private DocumentStatusDefinitionRepository documentStatusRepository;
    @Autowired private RevisionStatusDefinitionRepository revisionStatusRepository;
    @Autowired private DocumentTypeRepository documentTypeRepository;
    @Autowired private BusinessUnitRepository businessUnitRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private TokenService tokenService;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private ElectronicSignatureRepository electronicSignatureRepository;
    @Autowired private UserNotificationRepository userNotificationRepository;
    @Autowired private NotificationDeliveryFailureRepository deliveryFailureRepository;
    @Autowired private NotificationPolicyRepository notificationPolicyRepository;
    @Autowired private NotificationTemplateVersionRepository notificationTemplateVersionRepository;
    @Autowired private EmailTemplateRepository emailTemplateRepository;
    @Autowired private NotificationController notificationController;

    @MockBean private DocumentAuthorizationService documentAuthorizationService;
    @MockBean private AuthorizationService authorizationService;
    @SpyBean private AuditTrailService auditTrailService;
    @SpyBean private PermissionEvaluationService permissionEvaluationService;
    @SpyBean private EmailService emailService;
    @SpyBean private NotificationDispatcher notificationDispatcher;

    private DocumentType type;
    private BusinessUnit businessUnit;
    private Department department;
    private RevisionStatusDefinition effective;
    private List<UserAccount> pool;

    private final List<UUID> createdDocumentIds = new java.util.ArrayList<>();
    private String originalEnabledChannels;
    private UUID addedTemplateVersionId;
    private UUID addedEmailTemplateId;

    @BeforeEach
    void setUp() {
        doNothing().when(documentAuthorizationService)
                .requireDocumentMasterLifecycleAction(any(), any(), any());
        doNothing().when(authorizationService).require(any(), any());

        type = documentTypeRepository.findAll().stream().findFirst().orElseThrow();
        businessUnit = businessUnitRepository.findAll().stream().findFirst().orElseThrow();
        department = departmentRepository.findAll().stream().findFirst().orElseThrow();
        effective = revisionStatusRepository.findById("EFFECTIVE").orElseThrow();
        TransactionTemplate readOnlyTx = new TransactionTemplate(transactionManager);
        readOnlyTx.setReadOnly(true);
        pool = readOnlyTx.execute(status -> userAccountRepository.findAllByStatus(UserStatus.Active));
        assertTrue(pool.size() >= 6, "Need at least 6 active users to exercise author/DCO/recipient distinctness");
        clearInvocations(notificationDispatcher);
        reset(emailService);
    }

    @AfterEach
    void cleanup() {
        DocumentStatusDefinition closedCancelledDoc = documentStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
        RevisionStatusDefinition closedCancelledRev = revisionStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            for (UUID documentId : createdDocumentIds) {
                if (closedCancelledRev != null) {
                    revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).forEach(r -> {
                        r.setStatus(closedCancelledRev);
                        revisionRepository.save(r);
                    });
                }
                if (closedCancelledDoc != null) {
                    documentRepository.findById(documentId).ifPresent(d -> {
                        d.setStatus(closedCancelledDoc);
                        documentRepository.save(d);
                    });
                }
            }
            if (addedTemplateVersionId != null) {
                notificationTemplateVersionRepository.deleteById(addedTemplateVersionId);
            }
            if (originalEnabledChannels != null) {
                notificationPolicyRepository.findByEventCode(DocumentObsoleteNotificationService.EVENT_CODE)
                        .ifPresent(policy -> {
                            policy.setEnabledChannels(originalEnabledChannels);
                            notificationPolicyRepository.save(policy);
                        });
            }
            if (addedEmailTemplateId != null) {
                emailTemplateRepository.deleteById(addedEmailTemplateId);
            }
        });
    }

    private DocumentRecord newActiveDocument(String prefix, UserAccount author) {
        DocumentStatusDefinition active = documentStatusRepository.findById("ACTIVE").orElseThrow();
        DocumentRecord document = new DocumentRecord();
        document.setDocumentNumber(prefix + "." + UUID.randomUUID());
        document.setDocumentName(prefix + " Notification Test Document");
        document.setVersion("1.0.0");
        document.setStatus(active);
        document.setDocumentType(type);
        document.setBusinessUnit(businessUnit);
        document.setDepartment(department);
        document.setAuthor(author);
        document.setOwner(author);
        document.setTemplate(false);
        document.setHasRelatedDocuments(false);
        document.setHasCorrelatedDocuments(false);
        document.setRequiresTraining(false);
        documentRepository.save(document);
        createdDocumentIds.add(document.getId());
        return document;
    }

    private DocumentRevisionRecord newEffectiveRevision(DocumentRecord document, UserAccount author) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);
        revision.setDocumentNumber(document.getDocumentNumber());
        revision.setDocumentName(document.getDocumentName());
        revision.setRevisionName(document.getDocumentName() + "_1.0.0");
        revision.setRevisionNumber("1.0.0");
        revision.setStatus(effective);
        revision.setDocumentType(type);
        revision.setBusinessUnit(businessUnit);
        revision.setDepartment(department);
        revision.setAuthor(author);
        revision.setOwner(author);
        revision.setTemplate(false);
        revision.setHasRelatedDocuments(false);
        revision.setHasCorrelatedDocuments(false);
        revision.setReviewRequirement(ReviewRequirement.NONE);
        revision.setRequiresTraining(false);
        revision.setEditingStatus("COMPLETED");
        revision.setSourceLocked(true);
        revisionRepository.save(revision);
        return revision;
    }

    private ControlledCopyRecord newControlledCopy(DocumentRecord document, DocumentRevisionRecord revision, String statusCode,
                                                     int copyNumber, UserAccount recipientUser, boolean distributed) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(document);
        copy.setRevision(revision);
        copy.setControlledCopyNumber(document.getDocumentNumber() + "-CC-" + copyNumber + "-" + UUID.randomUUID().toString().substring(0, 8));
        copy.setCopyNumber(copyNumber);
        copy.setTotalCopies(1);
        copy.setDocumentNumber(document.getDocumentNumber());
        copy.setStatus(statusCode);
        copy.setStatusCode(statusCode);
        copy.setCurrentStage(statusCode);
        copy.setDownloadCount(0);
        copy.setPrintCount(0);
        copy.setHasExpiryDate(false);
        copy.setRecipientUser(recipientUser);
        if (distributed) {
            copy.setDistributedBy(recipientUser);
            copy.setDistributedAt(Instant.now());
        }
        controlledCopyRepository.save(copy);
        return copy;
    }

    private DocumentObsoleteRequest obsoleteRequest(UserAccount actor) {
        return new DocumentObsoleteRequest("Notification test reason", null, tokenService.createSignatureToken(actor));
    }

    private void runAsActor(UserAccount actor, Runnable body) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                actor.getId(), UUID.randomUUID(), actor.getUsername(),
                actor.getRoleName() != null ? actor.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, List.of());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            body.run();
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    private <T> T awaitValue(Supplier<T> probe, Duration timeout) {
        Instant deadline = Instant.now().plus(timeout);
        while (Instant.now().isBefore(deadline)) {
            T value = probe.get();
            if (value != null) {
                return value;
            }
            try {
                Thread.sleep(150);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
        return null;
    }

    private void awaitStableAbsence(Supplier<Boolean> stillAbsent, Duration observeWindow) {
        Instant deadline = Instant.now().plus(observeWindow);
        while (Instant.now().isBefore(deadline)) {
            assertTrue(stillAbsent.get(), "Expected condition to remain absent throughout the observation window");
            try {
                Thread.sleep(150);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
    }

    /**
     * The same pool user is deliberately reused as Author across several tests in this class
     * (all sharing one Spring context / one Postgres instance), so each test's own
     * document.obsoleted UserNotification rows must be isolated from other tests' by timestamp --
     * otherwise an earlier test's notification to the same person is mistaken for this test's.
     */
    private List<UserNotification> notificationsFor(UUID userId, Instant since) {
        return userNotificationRepository.findAllByRecipientUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId).stream()
                .filter(n -> DocumentObsoleteNotificationService.EVENT_CODE.equals(n.getType()))
                .filter(n -> n.getCreatedAt() != null && !n.getCreatedAt().isBefore(since))
                .toList();
    }

    private void enableEmailChannelFixture() {
        NotificationPolicy policy = notificationPolicyRepository.findByEventCode(DocumentObsoleteNotificationService.EVENT_CODE).orElseThrow();
        originalEnabledChannels = policy.getEnabledChannels();
        policy.setEnabledChannels("IN_APP,EMAIL");
        notificationPolicyRepository.save(policy);

        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setPolicy(policy);
        version.setChannel(NotificationTemplateVersion.CHANNEL_EMAIL);
        version.setVersionNumber(9999);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        version.setSubject("Document Obsoleted: {{documentNumber}}");
        version.setBody("{{documentNumber}} - {{documentTitle}} has been obsoleted.");
        notificationTemplateVersionRepository.save(version);
        addedTemplateVersionId = version.getId();
    }

    // ------------------------------------------------------------------
    // TC-DOC-061: Author notification
    // ------------------------------------------------------------------

    @Test
    void tcDoc061_authorIsNotifiedAfterCommitViaNotificationDispatcher() {
        UserAccount author = pool.get(0);
        DocumentRecord document = newActiveDocument("TCDOC061", author);
        newEffectiveRevision(document, author);
        Instant testStart = Instant.now();

        runAsActor(author, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(author)));

        List<UserNotification> authorNotifications = awaitValue(
                () -> { List<UserNotification> n = notificationsFor(author.getId(), testStart); return n.isEmpty() ? null : n; },
                Duration.ofSeconds(10));
        assertNotNull(authorNotifications, "Author must receive a document.obsoleted notification after commit");
        assertEquals(DocumentObsoleteNotificationService.EVENT_CODE, authorNotifications.get(0).getType());

        verify(notificationDispatcher, timeout(10_000)).dispatch(eq(DocumentObsoleteNotificationService.EVENT_CODE), any(), any());

        boolean hasBespokeEmailPath = java.util.Arrays.stream(DocumentObsoleteNotificationService.class.getDeclaredFields())
                .anyMatch(f -> EmailNotificationService.class.isAssignableFrom(f.getType()) || EmailService.class.isAssignableFrom(f.getType()));
        assertFalse(hasBespokeEmailPath, "DocumentObsoleteNotificationService must route only through NotificationDispatcher, not a direct EmailService/EmailNotificationService path");
    }

    // ------------------------------------------------------------------
    // TC-DOC-062: DCO / Coordinator notification via permission model
    // ------------------------------------------------------------------

    @Test
    void tcDoc062_dcoNotifiedViaPermission_nonEligibleUserNotIncluded() {
        UserAccount author = pool.get(0);
        UserAccount dco = pool.get(1);
        UserAccount nonEligible = pool.get(2);
        DocumentRecord document = newActiveDocument("TCDOC062", author);
        newEffectiveRevision(document, author);

        doReturn(true).when(permissionEvaluationService).hasPermission(argThat(u -> u != null && dco.getId().equals(u.getId())), eq("documents.workspace.manage"));
        Instant testStart = Instant.now();

        runAsActor(author, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(author)));

        List<UserNotification> dcoNotifications = awaitValue(
                () -> { List<UserNotification> n = notificationsFor(dco.getId(), testStart); return n.isEmpty() ? null : n; },
                Duration.ofSeconds(10));
        assertNotNull(dcoNotifications, "Permission-eligible DCO must be notified");

        // Give the (already-completed, per the await above) async listener a moment to have also
        // considered nonEligible, then assert they were never included.
        awaitStableAbsence(() -> notificationsFor(nonEligible.getId(), testStart).isEmpty(), Duration.ofMillis(500));
    }

    // ------------------------------------------------------------------
    // TC-DOC-063: Distributed Controlled Copy recipient (+ de-dup with Author)
    // ------------------------------------------------------------------

    @Test
    void tcDoc063_distributedCopyRecipientNotified_deduplicatedWhenAlsoAuthor() {
        UserAccount authorAndRecipient = pool.get(0);
        DocumentRecord document = newActiveDocument("TCDOC063", authorAndRecipient);
        DocumentRevisionRecord revision = newEffectiveRevision(document, authorAndRecipient);
        newControlledCopy(document, revision, "DISTRIBUTED", 1, authorAndRecipient, true);
        Instant testStart = Instant.now();

        runAsActor(authorAndRecipient, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(authorAndRecipient)));

        List<UserNotification> notifications = awaitValue(
                () -> { List<UserNotification> n = notificationsFor(authorAndRecipient.getId(), testStart); return n.isEmpty() ? null : n; },
                Duration.ofSeconds(10));
        assertNotNull(notifications);
        assertEquals(1, notifications.size(),
                "A recipient who is also the Author must receive exactly one notification for this event, not a duplicate "
                        + "(NotificationDispatcher/DocumentObsoleteNotificationService de-duplicate by UserAccount identity within the "
                        + "single recipient-resolution transaction)");
    }

    @Test
    void tcDoc063_distributedCopyRecipient_distinctFromAuthor_isNotified() {
        UserAccount author = pool.get(0);
        UserAccount distributedRecipient = pool.get(3);
        DocumentRecord document = newActiveDocument("TCDOC063B", author);
        DocumentRevisionRecord revision = newEffectiveRevision(document, author);
        newControlledCopy(document, revision, "DISTRIBUTED", 1, distributedRecipient, true);
        Instant testStart = Instant.now();

        runAsActor(author, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(author)));

        List<UserNotification> notifications = awaitValue(
                () -> { List<UserNotification> n = notificationsFor(distributedRecipient.getId(), testStart); return n.isEmpty() ? null : n; },
                Duration.ofSeconds(10));
        assertNotNull(notifications, "The Distributed copy's recipient must be notified because their copy became OBSOLETED");
    }

    // ------------------------------------------------------------------
    // TC-DOC-064: Ready-for-Distribution exclusion
    // ------------------------------------------------------------------

    @Test
    void tcDoc064_readyForDistributionOnlyRecipient_isNotNotified() {
        UserAccount author = pool.get(0);
        UserAccount readyOnlyRecipient = pool.get(4);
        DocumentRecord document = newActiveDocument("TCDOC064", author);
        DocumentRevisionRecord revision = newEffectiveRevision(document, author);
        newControlledCopy(document, revision, "READY_FOR_DISTRIBUTION", 1, readyOnlyRecipient, false);
        Instant testStart = Instant.now();

        runAsActor(author, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(author)));

        // Wait for the (real) author notification to land first as proof the listener has run,
        // then assert the never-distributed copy's intended recipient was never notified.
        assertNotNull(awaitValue(() -> { List<UserNotification> n = notificationsFor(author.getId(), testStart); return n.isEmpty() ? null : n; },
                Duration.ofSeconds(10)));
        assertTrue(notificationsFor(readyOnlyRecipient.getId(), testStart).isEmpty(),
                "A copy that was only Ready-for-Distribution (never actually distributed) must not generate a notification for its intended recipient");
    }

    // ------------------------------------------------------------------
    // TC-DOC-065: Architectural routing
    // ------------------------------------------------------------------

    @Test
    void tcDoc065_routesThroughNotificationDispatcherOnly_usesIntegrationExecutor() throws NoSuchMethodException {
        var method = DocumentObsoleteNotificationService.class.getDeclaredMethod("onDocumentObsoleted", com.eqms.event.DocumentObsoletedEvent.class);
        var asyncAnnotation = method.getAnnotation(org.springframework.scheduling.annotation.Async.class);
        assertNotNull(asyncAnnotation);
        assertEquals("integrationExecutor", asyncAnnotation.value(), "Must reuse the already-accepted integrationExecutor, not a new/fifth pool");

        boolean hasDispatcherField = java.util.Arrays.stream(DocumentObsoleteNotificationService.class.getDeclaredFields())
                .anyMatch(f -> NotificationDispatcher.class.isAssignableFrom(f.getType()));
        assertTrue(hasDispatcherField, "Must route through NotificationDispatcher");

        boolean hasAnyDirectSendDependency = java.util.Arrays.stream(DocumentObsoleteNotificationService.class.getDeclaredFields())
                .anyMatch(f -> EmailService.class.isAssignableFrom(f.getType()) || EmailNotificationService.class.isAssignableFrom(f.getType()));
        assertFalse(hasAnyDirectSendDependency, "Must not bypass NotificationPolicy/NotificationDeliveryFailure tracking via a direct-send dependency");
    }

    // ------------------------------------------------------------------
    // TC-DOC-066: Delivery failure must not roll back the lifecycle transaction
    // ------------------------------------------------------------------

    @Test
    void tcDoc066_notificationDeliveryFailureDoesNotRollBackLifecycle() throws Exception {
        enableEmailChannelFixture();
        UserAccount author = pool.get(0);
        DocumentRecord document = newActiveDocument("TCDOC066", author);
        DocumentRevisionRecord revision = newEffectiveRevision(document, author);

        doThrow(new RuntimeException("TC-DOC-066 simulated SMTP failure"))
                .when(emailService).sendRenderedEmail(any(), any(), any());

        long auditRowsBeforeNotification = auditLogRepository.count();
        Instant testStart = Instant.now();

        runAsActor(author, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(author)));

        // Lifecycle transaction already committed synchronously by the time obsoleteDocument()
        // returned above -- assert its outcome BEFORE the async notification even attempts to run.
        DocumentRecord documentAfter = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("OBSOLETED", documentAfter.getStatus().getCode());
        DocumentRevisionRecord revisionAfter = revisionRepository.findById(revision.getId()).orElseThrow();
        assertEquals("OBSOLETED", revisionAfter.getStatus().getCode());
        assertFalse(electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", document.getId()).isEmpty());
        assertTrue(auditLogRepository.count() > auditRowsBeforeNotification);

        // Scoped to THIS attempt's own failure row -- the same author (pool.get(0)) is reused by
        // other tests in this class, which independently create and (for TC-DOC-067) resolve their
        // own document.obsoleted delivery-failure rows for that same recipient/event code.
        NotificationDeliveryFailure failure = awaitValue(
                () -> deliveryFailureRepository.findAll().stream()
                        .filter(f -> author.getEmail().equalsIgnoreCase(f.getRecipient())
                                && DocumentObsoleteNotificationService.EVENT_CODE.equals(f.getNotificationType())
                                && f.getCreatedAt() != null && !f.getCreatedAt().isBefore(testStart))
                        .findFirst().orElse(null),
                Duration.ofSeconds(10));
        assertNotNull(failure, "The forced SMTP failure must be durably recorded");
        assertEquals("FAILED", failure.getStatus());

        // Re-assert after the failure: the already-committed lifecycle transaction must remain
        // exactly as it was -- a notification failure cannot roll back or compensate it.
        DocumentRecord documentAfterFailure = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("OBSOLETED", documentAfterFailure.getStatus().getCode());
        DocumentRevisionRecord revisionAfterFailure = revisionRepository.findById(revision.getId()).orElseThrow();
        assertEquals("OBSOLETED", revisionAfterFailure.getStatus().getCode());
        assertFalse(electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", document.getId()).isEmpty());
    }

    // ------------------------------------------------------------------
    // TC-DOC-067: Durable failure + manual retry through the real controller path
    // ------------------------------------------------------------------

    @Test
    void tcDoc067_durableFailureThenManualRetryThroughControllerPath() throws Exception {
        // Production-equivalent path (Batch B.1): NO legacy EmailTemplate is seeded. Normal
        // application bootstrap only provisions a NotificationPolicy + ACTIVE EMAIL
        // NotificationTemplateVersion for "document.obsoleted" (added below purely to enable the
        // EMAIL channel, exactly as an admin would via the Notification Policy screen -- not a
        // legacy EmailTemplate row). EmailNotificationService.retryDeliveryFailure now resolves a
        // policy-driven failure (one whose notificationType matches a NotificationPolicy eventCode)
        // by re-rendering that same ACTIVE EMAIL template version from the failure's own
        // persisted payload variables, so no legacy EmailTemplate is required at all.
        enableEmailChannelFixture();

        UserAccount author = pool.get(0);
        UserAccount operator = pool.get(5);
        DocumentRecord document = newActiveDocument("TCDOC067", author);
        DocumentRevisionRecord revision = newEffectiveRevision(document, author);

        doThrow(new RuntimeException("TC-DOC-067 simulated SMTP failure"))
                .when(emailService).sendRenderedEmail(any(), any(), any());
        Instant testStart = Instant.now();

        runAsActor(author, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(author)));

        NotificationDeliveryFailure failure = awaitValue(
                () -> deliveryFailureRepository.findAll().stream()
                        .filter(f -> author.getEmail().equalsIgnoreCase(f.getRecipient())
                                && DocumentObsoleteNotificationService.EVENT_CODE.equals(f.getNotificationType())
                                && f.getCreatedAt() != null && !f.getCreatedAt().isBefore(testStart))
                        .findFirst().orElse(null),
                Duration.ofSeconds(10));
        assertNotNull(failure);
        assertEquals("FAILED", failure.getStatus());
        int attemptsBeforeRetry = failure.getAttempts();

        long auditRowsBeforeRetry = auditLogRepository.count();
        long signatureRowsBeforeRetry = electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", document.getId()).size();

        // GET /notifications/delivery-failures via the real controller/service path.
        UUID failureId = failure.getId();
        var listResult = runAsActorReturning(operator, () -> notificationController.deliveryFailures(1, 50));
        PageResponse<NotificationDeliveryFailureResponse> page = listResult.getBody();
        assertNotNull(page);
        assertTrue(page.data().stream().anyMatch(r -> r.id().equals(failureId)),
                "An authorized operator must be able to identify the failure via GET /notifications/delivery-failures");

        // Now make the retry succeed. The manual-retry path for a policy-driven failure re-renders
        // the ACTIVE EMAIL NotificationTemplateVersion and resends via sendRenderedEmail -- the
        // same method used for the original send, no legacy sendTemplateEmail path involved.
        doReturn(true).when(emailService).sendRenderedEmail(any(), any(), any());
        var retryResult = runAsActorReturning(operator, () -> notificationController.retryDeliveryFailure(failureId));
        NotificationDeliveryFailureResponse retried = retryResult.getBody();
        assertNotNull(retried);
        assertEquals("RESOLVED", retried.status());
        assertEquals(attemptsBeforeRetry + 1, retried.attempts());

        NotificationDeliveryFailure persisted = deliveryFailureRepository.findById(failureId).orElseThrow();
        assertEquals("RESOLVED", persisted.getStatus());

        // Document Obsolete must not have been replayed.
        assertEquals(auditRowsBeforeRetry, auditLogRepository.count(), "No second Document lifecycle audit entry from the retry");
        assertEquals(signatureRowsBeforeRetry, electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", document.getId()).size(),
                "No second lifecycle ElectronicSignature from the retry");
        DocumentRecord documentAfter = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("OBSOLETED", documentAfter.getStatus().getCode());
    }

    private <T> org.springframework.http.ResponseEntity<T> runAsActorReturning(UserAccount actor, Supplier<org.springframework.http.ResponseEntity<T>> body) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                actor.getId(), UUID.randomUUID(), actor.getUsername(),
                actor.getRoleName() != null ? actor.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, List.of());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            return body.get();
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    // ------------------------------------------------------------------
    // TC-DOC-072: Rollback produces zero notification work
    // ------------------------------------------------------------------

    @Test
    void tcDoc072_rolledBackObsoleteAttempt_producesNoNotificationWork() {
        UserAccount author = pool.get(0);
        DocumentRecord document = newActiveDocument("TCDOC072", author);
        DocumentRevisionRecord revision = newEffectiveRevision(document, author);
        ControlledCopyRecord copy = newControlledCopy(document, revision, "DISTRIBUTED", 1, author, true);

        doThrow(new RuntimeException("TC-DOC-072 injected failure: forces rollback"))
                .when(auditTrailService)
                .logAs(any(), eq("Controlled Copy"), any(), eq(copy.getId()), eq("OBSOLETE"), any(), any(), any(), any(), any());

        // Scoped strictly to this attempt: the same author (pool.get(0)) is reused across other
        // tests in this class within the same Spring context, which legitimately create their own
        // document.obsoleted UserNotification/NotificationDeliveryFailure rows for that user --
        // those must not be mistaken for output of THIS (rolled-back) attempt.
        Instant attemptStartedAt = Instant.now();

        assertThrows(RuntimeException.class, () -> runAsActor(author,
                () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest(author))));

        DocumentRecord documentAfter = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("ACTIVE", documentAfter.getStatus().getCode(), "The Obsolete attempt must have rolled back");

        // Observe for a bounded window: the AFTER_COMMIT listener must never fire for a
        // transaction that never committed, so no notification work of any kind may appear.
        awaitStableAbsence(() -> notificationsFor(author.getId(), attemptStartedAt).isEmpty(), Duration.ofSeconds(3));
        awaitStableAbsence(
                () -> deliveryFailureRepository.findAll().stream()
                        .noneMatch(f -> author.getEmail().equalsIgnoreCase(f.getRecipient())
                                && DocumentObsoleteNotificationService.EVENT_CODE.equals(f.getNotificationType())
                                && f.getCreatedAt() != null && f.getCreatedAt().isAfter(attemptStartedAt)),
                Duration.ofSeconds(3));
        verify(notificationDispatcher, never()).dispatch(eq(DocumentObsoleteNotificationService.EVENT_CODE), any(), any());
    }
}
