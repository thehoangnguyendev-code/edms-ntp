package com.eqms;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.PublishingTemplate;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ControlledCopyAuthorizationService;
import com.eqms.service.ControlledCopyBatchStatusService;
import com.eqms.service.ControlledCopyExpiryLimitService;
import com.eqms.service.ControlledCopyFinalizationOutcome;
import com.eqms.service.ControlledCopyPolicyService;
import com.eqms.service.ControlledCopyPreviewGrantService;
import com.eqms.service.ControlledCopyService;
import com.eqms.auth.CurrentUserService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.EmailNotificationService;
import com.eqms.service.FileStorageService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.PublishingPdfComposerService;
import com.eqms.service.SecureFileAccessService;
import com.eqms.auth.TokenService;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyEvidenceFileRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.RevisionPublishingMetadataRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ControlledCopyActionNotificationEvent;
import com.eqms.service.ControlledCopyDistributionJobService;
import com.eqms.service.NotificationDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for the Controlled Copy async race fix: finalizeDistributedCopy() and
 * markDistributedCopyProcessingFailed() must never overwrite a copy that a concurrent lifecycle
 * action (Obsolete/Cancel) already moved to a terminal state (OBSOLETED/CLOSED_CANCELLED).
 */
@ExtendWith(MockitoExtension.class)
public class ControlledCopyObsoleteRaceTest {

    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private ControlledCopyEvidenceFileRepository controlledCopyEvidenceFileRepository;
    @Mock private ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    @Mock private ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository;
    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private TokenService tokenService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private FileStorageService fileStorageService;
    @Mock private SecureFileAccessService secureFileAccessService;
    @Mock private ControlledCopyPolicyService controlledCopyPolicyService;
    @Mock private ControlledCopyExpiryLimitService controlledCopyExpiryLimitService;
    @Mock private ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    @Mock private RevisionPublishingMetadataRepository revisionPublishingMetadataRepository;
    @Mock private PublishingPdfComposerService publishingPdfComposerService;
    @Mock private ControlledCopyDistributionJobService controlledCopyDistributionJobService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private BCryptPasswordEncoder passwordEncoder;
    @Mock private ControlledCopyPreviewGrantService controlledCopyPreviewGrantService;
    @Mock private ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    @Mock private com.eqms.repository.ControlledCopyPlaceholderFieldRepository controlledCopyPlaceholderFieldRepository;
    @Mock private com.eqms.service.ControlledCopyPdfMarkingService pdfMarkingService;
    @Mock private com.eqms.service.ControlledCopyWithdrawalNoticeService withdrawalNoticeService;
    @org.mockito.Spy private com.eqms.service.ControlledCopyPlaceholderValueBuilder placeholderValueBuilder = new com.eqms.service.ControlledCopyPlaceholderValueBuilder(new com.fasterxml.jackson.databind.ObjectMapper());
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;
    @Mock private com.eqms.service.SignatureTokenConsumptionService signatureTokenConsumptionService;
    @Mock private com.eqms.service.ElectronicSignatureService electronicSignatureService;
    @Mock private com.eqms.service.SystemActorProvider systemActorProvider;

    @InjectMocks
    private ControlledCopyService controlledCopyService;

    private UUID copyId;
    private ControlledCopyRecord copy;

    @BeforeEach
    void setUp() {
        copyId = UUID.randomUUID();
        copy = new ControlledCopyRecord();
        copy.setId(copyId);
        copy.setControlledCopyNumber("CC-0001");
        org.springframework.test.util.ReflectionTestUtils.setField(controlledCopyService, "eventPublisher", eventPublisher);
        org.springframework.test.util.ReflectionTestUtils.setField(controlledCopyService, "electronicSignatureService", electronicSignatureService);
        org.springframework.test.util.ReflectionTestUtils.setField(controlledCopyService, "systemActorProvider", systemActorProvider);
        com.eqms.entity.UserAccount systemActor = new com.eqms.entity.UserAccount();
        systemActor.setId(com.eqms.service.SystemActorProvider.SYSTEM_ACTOR_ID);
        systemActor.setUsername("system");
        systemActor.setFullName("System (Automated)");
        org.mockito.Mockito.lenient().when(systemActorProvider.get()).thenReturn(systemActor);
    }

    @Test
    void finalizeDistributedCopy_alreadyObsoleted_returnsSkippedTerminal_andDoesNotOverwrite() {
        copy.setStatusCode("OBSOLETED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        ControlledCopyFinalizationOutcome outcome = controlledCopyService.finalizeDistributedCopy(copyId, UUID.randomUUID());

        assertEquals(ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL, outcome);
        verify(controlledCopyRepository, never()).save(any());
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void finalizeDistributedCopy_alreadyClosedCancelled_returnsSkippedTerminal() {
        copy.setStatusCode("CLOSED_CANCELLED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        ControlledCopyFinalizationOutcome outcome = controlledCopyService.finalizeDistributedCopy(copyId, UUID.randomUUID());

        assertEquals(ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL, outcome);
        verify(controlledCopyRepository, never()).save(any());
    }

    @Test
    void markDistributedCopyProcessingFailed_alreadyObsoleted_doesNotRestoreToReadyForDistribution() {
        copy.setStatusCode("OBSOLETED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        controlledCopyService.markDistributedCopyProcessingFailed(copyId, UUID.randomUUID(), "retry exhausted");

        assertEquals("OBSOLETED", copy.getStatusCode());
        verify(controlledCopyRepository, never()).save(any());
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void isControlledCopyInTerminalState_reflectsCurrentDbStatus() {
        copy.setStatusCode("OBSOLETED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        assertEquals(true, controlledCopyService.isControlledCopyInTerminalState(copyId));
    }

    @Test
    void isControlledCopyInTerminalState_falseForNonTerminalStatus() {
        copy.setStatusCode("DISTRIBUTED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        assertEquals(false, controlledCopyService.isControlledCopyInTerminalState(copyId));
    }

    /**
     * Regression for TBR-CC-011: a failure composing the copy-specific PDF (copy number/
     * distribution-list placeholders, unique per copy) must propagate out of
     * finalizeDistributedCopy(), not be silently swallowed and leave the copy marked Distributed
     * with a non-personalized PDF. Propagation is what lets the batch async worker's existing
     * retry/FAILED-item mechanism (ControlledCopyBatchDistributionAsyncService.finalizeWithRetry)
     * actually catch this failure mode instead of reporting a false "success".
     */
    @Test
    void finalizeDistributedCopy_placeholderCompositionFails_propagatesInsteadOfSwallowing() throws Exception {
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        copy.setRevision(revision);

        RevisionPublishingMetadata metadata = new RevisionPublishingMetadata();
        metadata.setPublishingTemplate(new PublishingTemplate());
        metadata.setSelectedPublishingLayout("PORTRAIT");
        when(revisionPublishingMetadataRepository.findByRevision_Id(revision.getId()))
                .thenReturn(Optional.of(metadata));
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(publishingPdfComposerService.composePreview(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("Graph conversion unavailable"));

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class,
                () -> controlledCopyService.finalizeDistributedCopy(copyId, UUID.randomUUID()));

        // Must not have been saved as Distributed with the un-personalized PDF.
        verify(controlledCopyRepository, never()).save(any());
    }

    /**
     * Regression: a copy Obsoleted/Recalled/Cancelled while a recipient's email-preview session is
     * already open (has a valid, unexpired 15-minute grant) must stop being viewable on the very
     * next page/file/download request within that session, not just be blocked at the initial
     * openPreview() password step. See requirePreviewAccess()'s own comment for why this second
     * check site is necessary.
     */
    @Test
    void renderPreviewPage_copyObsoletedMidSession_isBlockedOnNextPageFetch() {
        copy.setStatusCode("OBSOLETED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        org.mockito.Mockito.doThrow(new com.eqms.exception.ControlledCopyNotAvailableException(copyId, "OBSOLETED", "RECALLED"))
                .when(controlledCopyAuthorizationService).requireStatusAllowedForPreview(copy);

        org.junit.jupiter.api.Assertions.assertThrows(
                com.eqms.exception.ControlledCopyNotAvailableException.class,
                () -> controlledCopyService.renderPreviewPage(copyId, "some-grant-token", 1));

        verify(controlledCopyAuthorizationService).requireStatusAllowedForPreview(copy);
    }

    /**
     * Regression: the distribution e-mail (preview link + password) for a batch member must only
     * go out AFTER the copy-specific composed PDF actually exists -- i.e. from finalizeDistributedCopy,
     * never earlier from the synchronous per-copy loop in distributeControlledCopyBatch(). Sending it
     * any earlier would hand the recipient a link that still points at the generic, uncomposed PDF.
     */
    @Test
    void finalizeDistributedCopy_compositionSucceeds_onlyThenSendsDistributionEmail() throws Exception {
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        com.eqms.entity.UserAccount recipient = new com.eqms.entity.UserAccount();
        recipient.setEmail("recipient@example.com");
        recipient.setFullName("Test Recipient");
        copy.setRecipientUser(recipient);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        copy.setRevision(revision);
        RevisionPublishingMetadata metadata = new RevisionPublishingMetadata();
        metadata.setPublishingTemplate(new PublishingTemplate());
        metadata.setSelectedPublishingLayout("PORTRAIT");
        when(revisionPublishingMetadataRepository.findByRevision_Id(revision.getId())).thenReturn(Optional.of(metadata));

        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(publishingPdfComposerService.composePreview(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PublishingPdfComposerService.PublishingCompositionResult(new byte[] {1, 2, 3}, 1));
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());
        when(fileStorageService.storeControlledCopyPdf(any(ControlledCopyRecord.class), any()))
                .thenReturn(new FileStorageService.StorageWriteResult(null, "controlled-copies/test.pdf", "MINIO", "bucket", "object-key", "v1", "checksum"));
        when(controlledCopyPolicyService.loadOrDefault()).thenReturn(new com.eqms.entity.ControlledCopyPolicySetting());

        ControlledCopyFinalizationOutcome outcome = controlledCopyService.finalizeDistributedCopy(copyId, UUID.randomUUID());

        assertEquals(ControlledCopyFinalizationOutcome.SUCCESS, outcome);
        verify(emailNotificationService).sendControlledCopyNotification(any(), org.mockito.ArgumentMatchers.eq(java.util.List.of(recipient)), any());
    }

    /**
     * Regression: requesting a controlled copy for yourself (recipientUser == requestedBy, a very
     * common case) used to result in TWO different-looking e-mails on Distribute -- the dedicated
     * distribution e-mail (preview link + password) from sendControlledCopyDistributionNotification,
     * PLUS a second, generic "workflow action performed" e-mail from notifyControlledCopyStakeholders's
     * internal-actors loop, because that loop never excluded someone who was ALSO the recipient
     * already notified above it. Only the dedicated one should ever go out to that person.
     */
    @Test
    void finalizeDistributedCopy_recipientIsAlsoRequester_sendsOnlyOneNotification() throws Exception {
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        com.eqms.entity.UserAccount recipient = new com.eqms.entity.UserAccount();
        recipient.setId(UUID.randomUUID());
        recipient.setEmail("self.requester@example.com");
        recipient.setFullName("Self Requester");
        copy.setRecipientUser(recipient);
        copy.setRequestedBy(recipient);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        copy.setRevision(revision);
        RevisionPublishingMetadata metadata = new RevisionPublishingMetadata();
        metadata.setPublishingTemplate(new PublishingTemplate());
        metadata.setSelectedPublishingLayout("PORTRAIT");
        when(revisionPublishingMetadataRepository.findByRevision_Id(revision.getId())).thenReturn(Optional.of(metadata));

        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(publishingPdfComposerService.composePreview(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PublishingPdfComposerService.PublishingCompositionResult(new byte[] {1, 2, 3}, 1));
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());
        when(fileStorageService.storeControlledCopyPdf(any(ControlledCopyRecord.class), any()))
                .thenReturn(new FileStorageService.StorageWriteResult(null, "controlled-copies/test.pdf", "MINIO", "bucket", "object-key", "v1", "checksum"));
        when(controlledCopyPolicyService.loadOrDefault()).thenReturn(new com.eqms.entity.ControlledCopyPolicySetting());

        ControlledCopyFinalizationOutcome outcome = controlledCopyService.finalizeDistributedCopy(copyId, UUID.randomUUID());

        assertEquals(ControlledCopyFinalizationOutcome.SUCCESS, outcome);
        verify(emailNotificationService, org.mockito.Mockito.times(1))
                .sendControlledCopyNotification(any(), org.mockito.ArgumentMatchers.eq(java.util.List.of(recipient)), any());
    }

    /**
     * Mirrors the test above for the failure path: composition failing must not leave a
     * half-finalized copy with an e-mail already sent for a still-generic PDF.
     */
    @Test
    void finalizeDistributedCopy_compositionFails_neverSendsDistributionEmail() throws Exception {
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        com.eqms.entity.UserAccount recipient = new com.eqms.entity.UserAccount();
        recipient.setEmail("recipient@example.com");
        copy.setRecipientUser(recipient);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        copy.setRevision(revision);
        RevisionPublishingMetadata metadata = new RevisionPublishingMetadata();
        metadata.setPublishingTemplate(new PublishingTemplate());
        metadata.setSelectedPublishingLayout("PORTRAIT");
        when(revisionPublishingMetadataRepository.findByRevision_Id(revision.getId())).thenReturn(Optional.of(metadata));
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(publishingPdfComposerService.composePreview(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("Graph conversion unavailable"));

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class,
                () -> controlledCopyService.finalizeDistributedCopy(copyId, UUID.randomUUID()));

        verify(emailNotificationService, never()).sendControlledCopyNotification(any(), any(), any());
    }

    /**
     * Regression: Recall Batch used to only notify internal actors (a single notification for the
     * whole -- unfiltered -- batch, sent eagerly before knowing which copies actually finalize).
     * The copy's own recipient must now be notified individually, only once THIS copy is actually
     * recalled, exactly like the single-copy recall() flow already did.
     */
    @Test
    void finalizeRecalledCopy_internalRecipient_dispatchesPolicyEventNotification() {
        copy.setStatusCode("DISTRIBUTED");
        com.eqms.entity.UserAccount recipient = new com.eqms.entity.UserAccount();
        recipient.setEmail("internal.recipient@eqms.com");
        copy.setRecipientUser(recipient);
        UUID issuerId = UUID.randomUUID();
        com.eqms.entity.UserAccount issuer = new com.eqms.entity.UserAccount();
        issuer.setEmail("issuer@eqms.com");
        when(userAccountRepository.findById(issuerId)).thenReturn(Optional.of(issuer));
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());

        ControlledCopyFinalizationOutcome result = controlledCopyService.finalizeRecalledCopy(copyId, issuerId, "No longer needed", java.time.Instant.now());

        assertEquals(ControlledCopyFinalizationOutcome.SUCCESS, result);
        verify(notificationDispatcher).dispatch(org.mockito.ArgumentMatchers.eq("controlled_copy.recalled"), org.mockito.ArgumentMatchers.eq(java.util.List.of(recipient)), any());
    }

    /**
     * Same regression as above, for a copy distributed to an EXTERNAL recipient (no internal login
     * account -- only an e-mail address). Before this fix, external recipients were never notified
     * of a Recall at all (recipientUser is always null for them by design; the batch-level
     * notification only reached internal actors) -- they'd only discover it by hitting an
     * Access Denied page the next time they opened their preview link.
     */
    @Test
    void finalizeRecalledCopy_externalRecipient_sendsEmailToExternalAddress() {
        copy.setStatusCode("DISTRIBUTED");
        copy.setDistributionScope("external");
        copy.setExternalRecipients("external.recipient@example.com");
        copy.setRecipientName("external.recipient@example.com");
        UUID issuerId = UUID.randomUUID();
        com.eqms.entity.UserAccount issuer = new com.eqms.entity.UserAccount();
        issuer.setEmail("issuer@eqms.com");
        when(userAccountRepository.findById(issuerId)).thenReturn(Optional.of(issuer));
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());

        ControlledCopyFinalizationOutcome result = controlledCopyService.finalizeRecalledCopy(copyId, issuerId, "No longer needed", java.time.Instant.now());

        assertEquals(ControlledCopyFinalizationOutcome.SUCCESS, result);
        verify(emailNotificationService).sendControlledCopyNotificationToEmails(
                any(), org.mockito.ArgumentMatchers.eq(java.util.List.of("external.recipient@example.com")), any());
    }

    /**
     * Regression: finalizeCancelledCopy() runs once per member copy in a Cancel Batch -- it must
     * NOT notify anyone itself any more. Per-copy notifying used to fire the same "your batch was
     * cancelled" e-mail/in-app message once for EACH copy (a batch of 5 sent 5 duplicate
     * notifications) and also wrongly targeted each copy's own never-actually-delivered recipient.
     * ControlledCopyBatchCancelAsyncService now sends exactly ONE consolidated notification (via
     * ControlledCopyService#notifyBatchCancelled) after every copy in the batch has been processed.
     */
    @Test
    void finalizeCancelledCopy_doesNotNotifyPerCopy() {
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        com.eqms.entity.UserAccount requester = new com.eqms.entity.UserAccount();
        requester.setEmail("requester@eqms.com");
        copy.setRequestedBy(requester);
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        ControlledCopyFinalizationOutcome result = controlledCopyService.finalizeCancelledCopy(copyId, UUID.randomUUID(), "No longer needed");

        assertEquals(ControlledCopyFinalizationOutcome.SUCCESS, result);
        verifyNoInteractions(emailNotificationService);
    }

    /**
     * notifyBatchCancelled() is the single consolidated notification for a whole Cancel Batch
     * action -- sent once, to the actor who performed it, never to a member copy's own recipient.
     */
    @Test
    void notifyBatchCancelled_sendsOneConsolidatedNotificationToActor() {
        UUID batchId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        com.eqms.entity.ControlledCopyDistributionBatch batch = new com.eqms.entity.ControlledCopyDistributionBatch();
        batch.setId(batchId);
        batch.setBatchNumber("CCB.SOP.0001.B001");
        batch.setStatus("Closed - Cancelled");
        com.eqms.entity.UserAccount actor = new com.eqms.entity.UserAccount();
        actor.setId(actorId);
        actor.setEmail("actor@eqms.com");
        when(controlledCopyDistributionBatchRepository.findById(batchId)).thenReturn(Optional.of(batch));
        when(userAccountRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(emailNotificationService.buildControlledCopyBatchVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());

        controlledCopyService.notifyBatchCancelled(batchId, actorId, 4, 1, 0);

        verify(emailNotificationService, org.mockito.Mockito.times(1))
                .sendControlledCopyNotification(any(), eq(java.util.List.of(actor)), any());
    }

    /**
     * Regression: a concurrent Revision/Document Obsolete (which cascades to every non-terminal
     * copy, including Ready-for-Distribution ones -- see ControlledCopyLifecycleObsolescenceService)
     * may reach a copy before Cancel Batch's own async step does. finalizeCancelledCopy() must
     * recognize that and skip, not overwrite the copy's real reason with "Cancelled".
     */
    @Test
    void finalizeCancelledCopy_alreadyObsoletedByConcurrentAction_skipsWithoutOverwriting() {
        copy.setStatusCode("OBSOLETED");
        copy.setObsoleteReason("Revision superseded");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        ControlledCopyFinalizationOutcome result = controlledCopyService.finalizeCancelledCopy(copyId, UUID.randomUUID(), "No longer needed");

        assertEquals(ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL, result);
        assertEquals("Revision superseded", copy.getObsoleteReason());
        verify(controlledCopyRepository, never()).saveAndFlush(any());
    }

    /**
     * Same regression for Recall Batch: OBSOLETED is itself a normally-eligible starting status
     * for Recall (see recallBatch()'s eligibility filter), so the guard must key off the REASON,
     * not the status alone -- an OBSOLETED copy whose reason is something other than "Recalled"
     * was made invalid by an unrelated concurrent action and must not be silently re-tagged.
     */
    @Test
    void finalizeRecalledCopy_obsoletedByUnrelatedConcurrentAction_skipsWithoutOverwriting() {
        copy.setStatusCode("OBSOLETED");
        copy.setObsoleteReason("Revision superseded");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        ControlledCopyFinalizationOutcome result = controlledCopyService.finalizeRecalledCopy(copyId, UUID.randomUUID(), "No longer needed", java.time.Instant.now());

        assertEquals(ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL, result);
        assertEquals("Revision superseded", copy.getObsoleteReason());
        verify(controlledCopyRepository, never()).saveAndFlush(any());
    }

    /**
     * The flip side: an OBSOLETED copy whose reason IS already "Recalled" is a normal, accepted
     * starting condition for Recall Batch (see recallBatch()'s eligibility filter) -- finalize
     * must still proceed for it, not be mistaken for the concurrent-action case above.
     */
    @Test
    void finalizeRecalledCopy_alreadyObsoletedAsRecalled_stillProceeds() {
        copy.setStatusCode("OBSOLETED");
        copy.setObsoleteReason("RECALLED");
        UUID issuerId = UUID.randomUUID();
        com.eqms.entity.UserAccount issuer = new com.eqms.entity.UserAccount();
        issuer.setEmail("issuer@eqms.com");
        when(userAccountRepository.findById(issuerId)).thenReturn(Optional.of(issuer));
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());

        ControlledCopyFinalizationOutcome result = controlledCopyService.finalizeRecalledCopy(copyId, issuerId, "No longer needed", java.time.Instant.now());

        assertEquals(ControlledCopyFinalizationOutcome.SUCCESS, result);
    }

    /**
     * A copy already Closed/Cancelled can never legitimately reach Recall's async step (Recall's
     * own eligibility filter never includes Closed/Cancelled copies) -- if it happens anyway
     * (e.g. a stale job item), it must be skipped, never overwritten.
     */
    @Test
    void finalizeRecalledCopy_alreadyClosedCancelled_skipsWithoutOverwriting() {
        copy.setStatusCode("CLOSED_CANCELLED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        ControlledCopyFinalizationOutcome result = controlledCopyService.finalizeRecalledCopy(copyId, UUID.randomUUID(), "No longer needed", java.time.Instant.now());

        assertEquals(ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL, result);
        verify(controlledCopyRepository, never()).saveAndFlush(any());
    }

    /**
     * Regression: single-copy actions (Cancel here, representative of Distribute/Recall/Destroy/
     * Replace Lost-Damaged/Print too -- they all follow the exact same pattern) must no longer
     * call the e-mail/notification pipeline synchronously inside their own transaction. Sending
     * mail is a blocking SMTP call (with its own retry+sleep) that has nothing to do with the DB
     * write's correctness -- doing it inline held the HTTP thread and its DB connection hostage for
     * however long that took. It must instead publish an event so
     * ControlledCopyNotificationAsyncService dispatches the notification only after this
     * transaction actually commits, off the request thread.
     */
    @Test
    void cancel_publishesNotificationEventInsteadOfSendingSynchronously() {
        UUID actorId = UUID.randomUUID();
        com.eqms.entity.UserAccount currentUser = new com.eqms.entity.UserAccount();
        currentUser.setId(actorId);
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        copy.setCurrentStage("Ready for Distribution");
        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(signatureTokenConsumptionService.requireAndConsume(eq("sig-token"), eq(currentUser))).thenReturn(UUID.randomUUID());

        com.eqms.dto.document.ControlledCopyCancelRequest request =
                new com.eqms.dto.document.ControlledCopyCancelRequest("No longer needed", "sig-token");

        controlledCopyService.cancel(copyId, request);

        org.mockito.ArgumentCaptor<ControlledCopyActionNotificationEvent> captor =
                org.mockito.ArgumentCaptor.forClass(ControlledCopyActionNotificationEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertEquals(copyId, captor.getValue().copyId());
        assertEquals(actorId, captor.getValue().actorUserId());
        assertEquals("CANCEL", captor.getValue().action());
        verifyNoInteractions(emailNotificationService, notificationDispatcher);
    }

    /**
     * Regression: cascaded Obsolete (source Revision/Document obsoleted) must use its OWN
     * dedicated e-mail template ("Controlled Copy Obsoleted"), not the generic
     * "controlled-copy-notification" fallback -- the generic one only says "a workflow action was
     * performed" with mostly-blank Recall/Destroy fields, giving the recipient no clue their copy
     * is now invalid because of what happened to its SOURCE document/revision.
     */
    @Test
    void notifyControlledCopyStakeholders_obsoleteAction_usesDedicatedObsoletedTemplate() {
        com.eqms.entity.UserAccount requester = new com.eqms.entity.UserAccount();
        requester.setEmail("requester@eqms.com");
        copy.setRequestedBy(requester);
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());

        org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                controlledCopyService, "notifyControlledCopyStakeholders", copy, requester, "OBSOLETE", "Parent revision obsoleted");

        verify(emailNotificationService).sendControlledCopyNotification(
                eq(com.eqms.util.EmailTemplateTypeUtils.CONTROLLED_COPY_OBSOLETED_NOTIFICATION),
                eq(java.util.List.of(requester)),
                any());
    }

    /**
     * Regression: a copy whose recipient is a named INTERNAL user (recipientUser != null) but
     * whose action has no admin-managed notification policy (OBSOLETE has none -- only
     * RECALL/DESTROY do) must still get notified directly. Before this fix, such a recipient was
     * silently skipped entirely unless they also happened to be one of the internal actors
     * (requestedBy/distributedBy/...) already on the copy -- never true for a cascaded Obsolete
     * triggered by someone else's action on the source Revision/Document.
     */
    @Test
    void notifyControlledCopyStakeholders_obsoleteAction_stillNotifiesNamedInternalRecipientWithoutPolicyEvent() {
        com.eqms.entity.UserAccount recipient = new com.eqms.entity.UserAccount();
        recipient.setEmail("recipient@eqms.com");
        copy.setRecipientUser(recipient);
        com.eqms.entity.UserAccount requester = new com.eqms.entity.UserAccount();
        requester.setEmail("requester@eqms.com");
        copy.setRequestedBy(requester);
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());

        org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                controlledCopyService, "notifyControlledCopyStakeholders", copy, requester, "OBSOLETE", "Parent revision obsoleted");

        verify(notificationDispatcher, never()).dispatch(any(), any(), any());
        verify(emailNotificationService).sendControlledCopyNotification(
                eq(com.eqms.util.EmailTemplateTypeUtils.CONTROLLED_COPY_OBSOLETED_NOTIFICATION),
                eq(java.util.List.of(recipient)),
                any());
    }

    /**
     * Regression: the "Document Revision" column on the Controlled Copies list must never show
     * the exact same text as the "Controlled Copy Name" column for a distribution BATCH row.
     * controlledCopyName always ends with "Controlled Copy N" (singleton) or a quantity suffix
     * (batch), while revisionName is just "<document title>_<revision>" -- the FE was previously
     * falling back to reusing controlledCopyName's value here because the batch summary response
     * had no distinct revisionName field of its own.
     */
    @Test
    void getDistributionBatchById_revisionNameDistinctFromControlledCopyName() {
        UUID batchId = UUID.randomUUID();
        com.eqms.entity.UserAccount currentUser = new com.eqms.entity.UserAccount();
        currentUser.setId(UUID.randomUUID());
        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);

        com.eqms.entity.ControlledCopyDistributionBatch batch = new com.eqms.entity.ControlledCopyDistributionBatch();
        batch.setId(batchId);
        batch.setDocumentTitle("Notification Test Document");
        batch.setRevisionNumber("1.0.0");
        batch.setQuantity(1);
        batch.setRevision(new DocumentRevisionRecord());
        when(controlledCopyDistributionBatchRepository.findById(batchId)).thenReturn(Optional.of(batch));
        when(documentAuthorizationService.canAccessControlledCopy(eq(currentUser), org.mockito.ArgumentMatchers.any(DocumentRevisionRecord.class)))
                .thenReturn(true);

        copy.setCopyNumber(1);
        when(controlledCopyRepository.countByDistributionBatch_Id(batchId)).thenReturn(1L);
        when(controlledCopyRepository.countByDistributionBatch_IdAndStatusCode(any(), any())).thenReturn(0L);
        when(controlledCopyRepository.findTopByDistributionBatch_IdOrderByCopyNumberAsc(batchId)).thenReturn(Optional.of(copy));
        when(controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batchId)).thenReturn(List.of(copy));

        var response = controlledCopyService.getDistributionBatchById(batchId);

        assertEquals("Notification Test Document - 1.0.0 - Controlled Copy 1", response.controlledCopyName());
        assertEquals("Notification Test Document_1.0.0", response.revisionName());
        org.junit.jupiter.api.Assertions.assertNotEquals(response.controlledCopyName(), response.revisionName());
    }

    /**
     * Regression: Request Controlled Copy by department/business-unit must only resolve to
     * ACTIVE members. Before this fix, resolveDepartmentRecipients()/resolveBusinessUnitRecipients()
     * queried userAccountRepository with no status filter at all, resolving Suspended/Terminated/
     * Inactive/Pending members too -- MORE recipients than the requester's own recipient-count
     * preview in the UI (which is Active-only, matching /metadata/users). Any department with even
     * one non-Active member made every request to it fail server-side with "Sum(recipients.quantity)
     * must equal Request.quantity." even though the requester did everything right.
     */
    @Test
    void resolveDepartmentRecipients_onlyQueriesActiveUsers() {
        com.eqms.entity.Department department = new com.eqms.entity.Department();
        UUID departmentId = UUID.randomUUID();
        department.setId(departmentId);
        department.setName("Quality Control");
        department.setCode("QC");
        when(departmentRepository.findById(departmentId)).thenReturn(java.util.Optional.of(department));
        when(userAccountRepository.findAllByDepartmentNameOrCodeAndStatus(
                eq("Quality Control"), eq("QC"), eq(com.eqms.entity.UserStatus.Active)))
                .thenReturn(List.of());

        Object result = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                controlledCopyService, "resolveDepartmentRecipients", departmentId.toString(), (String) null);

        assertEquals(List.of(), result);
        verify(userAccountRepository).findAllByDepartmentNameOrCodeAndStatus(
                eq("Quality Control"), eq("QC"), eq(com.eqms.entity.UserStatus.Active));
    }
}
