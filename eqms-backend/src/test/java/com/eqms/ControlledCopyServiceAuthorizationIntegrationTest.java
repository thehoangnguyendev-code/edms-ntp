package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.*;
import com.eqms.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ControlledCopyServiceAuthorizationIntegrationTest {

    @Mock ControlledCopyRepository controlledCopyRepository;
    @Mock ControlledCopyEvidenceFileRepository controlledCopyEvidenceFileRepository;
    @Mock ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    @Mock ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository;
    @Mock BusinessUnitRepository businessUnitRepository;
    @Mock DepartmentRepository departmentRepository;
    @Mock DocumentRecordRepository documentRecordRepository;
    @Mock DocumentRevisionRepository documentRevisionRepository;
    @Mock UserAccountRepository userAccountRepository;
    @Mock CurrentUserService currentUserService;
    @Mock TokenService tokenService;
    @Mock DocumentAuthorizationService documentAuthorizationService;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock AuditTrailService auditTrailService;
    @Mock EmailNotificationService emailNotificationService;
    @Mock FileStorageService fileStorageService;
    @Mock SecureFileAccessService secureFileAccessService;
    @Mock ControlledCopyPolicyService controlledCopyPolicyService;
    @Mock ControlledCopyExpiryLimitService controlledCopyExpiryLimitService;
    @Mock ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    @Mock RevisionPublishingMetadataRepository revisionPublishingMetadataRepository;
    @Mock PublishingPdfComposerService publishingPdfComposerService;
    @Mock ControlledCopyDistributionJobService controlledCopyDistributionJobService;
    @Mock com.eqms.service.NotificationDispatcher notificationDispatcher;
    @Mock ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    @Mock ControlledCopyPlaceholderFieldRepository controlledCopyPlaceholderFieldRepository;
    @Mock SignatureTokenConsumptionService signatureTokenConsumptionService;

    ControlledCopyService service;
    UserAccount user;
    ControlledCopyRecord copy;
    ControlledCopyDistributionBatch batch;

    @BeforeEach
    void setUp() {
        service = new ControlledCopyService(
                controlledCopyRepository,
                controlledCopyEvidenceFileRepository,
                controlledCopyDistributionBatchRepository,
                controlledCopyStatusDefinitionRepository,
                businessUnitRepository,
                departmentRepository,
                documentRecordRepository,
                documentRevisionRepository,
                userAccountRepository,
                currentUserService,
                tokenService,
                documentAuthorizationService,
                permissionEvaluationService,
                auditTrailService,
                emailNotificationService,
                fileStorageService,
                secureFileAccessService,
                controlledCopyPolicyService,
                controlledCopyExpiryLimitService,
                controlledCopyAuthorizationService,
                revisionPublishingMetadataRepository,
                publishingPdfComposerService,
                controlledCopyDistributionJobService,
                notificationDispatcher,
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(),
                new ControlledCopyPreviewGrantService("test-secret-with-at-least-32-characters"),
                controlledCopyBatchStatusService,
                controlledCopyPlaceholderFieldRepository,
                new com.eqms.service.ControlledCopyPlaceholderValueBuilder(new com.fasterxml.jackson.databind.ObjectMapper()),
                new com.eqms.service.ControlledCopyPdfMarkingService(),
                new com.eqms.service.ControlledCopyWithdrawalNoticeService(),
                signatureTokenConsumptionService
        );

        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        user.setUsername("nguyenvana");

        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);

        batch = new ControlledCopyDistributionBatch();
        batch.setId(UUID.randomUUID());
        batch.setDocument(document);
        batch.setRevision(revision);
        batch.setStatusCode("READY_FOR_DISTRIBUTION");
        batch.setStatus("Ready for Distribution");

        copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(document);
        copy.setRevision(revision);
        copy.setDistributionBatch(batch);
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        copy.setCurrentStage("Ready for Distribution");
        copy.setRequestedBy(user);
        copy.setRecipientUser(user);

        lenient().when(currentUserService.requireCurrentUser()).thenReturn(user);
        lenient().when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        lenient().when(controlledCopyRepository.findById(any())).thenReturn(Optional.of(copy));
        lenient().when(controlledCopyDistributionBatchRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireDistributeControlledCopy(eq(user), eq(copy));
    }

    @Test
    void watermarkEvidence_rejectsBytesThatOnlyClaimToBeAnImage() {
        MultipartFile spoofedImage = new MockMultipartFile(
                "evidence", "evidence.jpg", "image/jpeg", "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "watermarkEvidence", spoofedImage))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("valid JPEG or PNG");
    }

    @Test
    void watermarkEvidence_usesTheDecodedFormatInsteadOfTheBrowserClaim() throws Exception {
        java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(1, 1, java.awt.image.BufferedImage.TYPE_INT_ARGB);
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", bytes);
        MultipartFile mismatchedClaim = new MockMultipartFile(
                "evidence", "evidence.jpg", "image/jpeg", bytes.toByteArray()
        );

        Object result = ReflectionTestUtils.invokeMethod(service, "watermarkEvidence", mismatchedClaim);
        Object originalContentType = ReflectionTestUtils.invokeMethod(result, "originalContentType");

        assertThat(originalContentType).isEqualTo("image/png");
    }

    @Test
    void issuePreviewPassword_persistsOnlyBcryptHashAndRotatesCredential() {
        String firstPassword = (String) ReflectionTestUtils.invokeMethod(service, "issuePreviewPassword", copy);
        String firstHash = copy.getPreviewPasswordHash();

        assertThat(firstPassword).isNotBlank();
        assertThat(firstHash).isNotBlank().isNotEqualTo(firstPassword);
        assertThat(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().matches(firstPassword, firstHash)).isTrue();

        String secondPassword = (String) ReflectionTestUtils.invokeMethod(service, "issuePreviewPassword", copy);
        assertThat(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().matches(secondPassword, copy.getPreviewPasswordHash())).isTrue();
        assertThat(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().matches(firstPassword, copy.getPreviewPasswordHash())).isFalse();
    }

    @Test
    void distributionNotification_exposesPreviewPasswordOnlyInOutboundTemplateVariables() {
        user.setEmail("recipient@example.test");
        String password = (String) ReflectionTestUtils.invokeMethod(service, "issuePreviewPassword", copy);
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        when(controlledCopyPolicyService.loadOrDefault()).thenReturn(policy);
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), anyMap()))
                .thenAnswer(invocation -> new HashMap<>((Map<String, String>) invocation.getArgument(5)));

        ReflectionTestUtils.invokeMethod(
                service,
                "sendControlledCopyDistributionNotification",
                copy,
                user,
                "Distribution completed",
                false,
                password
        );

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<Map<String, String>> variables = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(emailNotificationService).sendControlledCopyNotification(
                eq(com.eqms.util.EmailTemplateTypeUtils.CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION),
                eq(List.of(user)),
                variables.capture()
        );
        assertThat(variables.getValue()).containsEntry("previewPassword", password);
        assertThat(copy.getPreviewPasswordHash()).doesNotContain(password);
    }

    @Test
    void distribute_deniedBeforeMutation_hasNoSideEffects() {
        assertThatThrownBy(() -> service.distribute(copy.getId(), null))
                .isInstanceOf(AccessDeniedException.class);

        verify(controlledCopyRepository, never()).save(any());
        verifyNoInteractions(auditTrailService, emailNotificationService, fileStorageService);
    }

    @Test
    void distributeCopy_denied_doesNotMarkDistributed() {
        String before = copy.getCurrentStage();

        assertThatThrownBy(() -> service.distribute(copy.getId(), null))
                .isInstanceOf(AccessDeniedException.class);

        verify(controlledCopyRepository, never()).save(any());
        verifyNoInteractions(auditTrailService, emailNotificationService, fileStorageService);
        org.assertj.core.api.Assertions.assertThat(copy.getCurrentStage()).isEqualTo(before);
    }

    @Test
    void distributeBatch_denied_doesNotCreateTokens() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireDistributeControlledCopy(eq(user), eq(batch));

        assertThatThrownBy(() -> service.distributeBatch(batch.getId(), null))
                .isInstanceOf(AccessDeniedException.class);

        verify(controlledCopyRepository, never()).save(any());
        verifyNoInteractions(auditTrailService, emailNotificationService, fileStorageService);
        org.assertj.core.api.Assertions.assertThat(copy.getAccessToken()).isNull();
    }

    @Test
    void distributeBatch_denied_doesNotSendEmail() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireDistributeControlledCopy(eq(user), eq(batch));

        assertThatThrownBy(() -> service.distributeBatch(batch.getId(), null))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(emailNotificationService);
    }

    @Test
    void cancel_denied_doesNotChangeStatus() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireCancelControlledCopy(eq(user), eq(copy));

        String before = copy.getCurrentStage();
        assertThatThrownBy(() -> service.cancel(copy.getId(), null))
                .isInstanceOf(AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThat(copy.getCurrentStage()).isEqualTo(before);
        verify(controlledCopyRepository, never()).save(any());
    }

    @Test
    void recall_denied_doesNotRevokeAccessOrChangeStatus() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireRecallControlledCopy(eq(user), eq(copy));

        String before = copy.getCurrentStage();
        assertThatThrownBy(() -> service.recall(copy.getId(), null))
                .isInstanceOf(AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThat(copy.getCurrentStage()).isEqualTo(before);
        verify(controlledCopyRepository, never()).save(any());
        verifyNoInteractions(fileStorageService);
    }

    @Test
    void reportLostDamaged_denied_doesNotChangeStatus() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireReportLostDamaged(eq(user), eq(copy));

        String before = copy.getCurrentStage();
        assertThatThrownBy(() -> service.reportLostDamaged(copy.getId(), null, List.of()))
                .isInstanceOf(AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThat(copy.getCurrentStage()).isEqualTo(before);
        verify(controlledCopyRepository, never()).save(any());
        verifyNoInteractions(fileStorageService);
    }

    @Test
    void reportLostDamaged_denied_doesNotMarkCopyLostDamaged() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireReportLostDamaged(eq(user), eq(copy));

        String before = copy.getCurrentStage();
        assertThatThrownBy(() -> service.reportLostDamaged(copy.getId(), null, List.of()))
                .isInstanceOf(AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThat(copy.getCurrentStage()).isEqualTo(before);
    }

    @Test
    void uploadEvidence_denied_doesNotStoreEvidenceFile() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireReportLostDamaged(eq(user), eq(copy));

        assertThatThrownBy(() -> service.reportLostDamaged(copy.getId(), null, List.of(mock(MultipartFile.class))))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(fileStorageService, controlledCopyEvidenceFileRepository);
    }

    @Test
    void download_deniedDoesNotOpenFileStream() {
        // Anonymous, token-only access model: the preview/download link is meant to work without
        // an EQMS login (see ControlledCopyAuthorizationService.requireTokenDownloadAccess), so the
        // service no longer calls the user-based requireDownloadAccess check.
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireTokenDownloadAccess(eq(copy), eq("preview-token-1"), any());

        assertThatThrownBy(() -> service.downloadControlledCopy(copy.getId(), "preview-token-1", null))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(fileStorageService, emailNotificationService, auditTrailService);
    }

    @Test
    void preview_deniedDoesNotOpenFileStream() {
        lenient().doThrow(new AccessDeniedException("denied"))
                .when(controlledCopyAuthorizationService)
                .requireTokenPreviewAccess(eq(copy), eq("preview-token-1"), any());

        assertThatThrownBy(() -> service.openPreview(copy.getId(), "preview-token-1", null))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(fileStorageService, emailNotificationService, auditTrailService);
    }

}
