package com.eqms;

import com.eqms.controller.ControlledCopyController;
import com.eqms.dto.document.ControlledCopyPreviewResponse;
import com.eqms.dto.document.ControlledCopyPreviewSessionRequest;
import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.security.ControlledCopyActionCapabilityDecisionResponse;
import com.eqms.entity.ControlledCopyDistributionJob;
import com.eqms.entity.ControlledCopyDistributionJobItem;
import com.eqms.auth.UnauthorizedException;
import com.eqms.repository.ControlledCopyDistributionJobRepository;
import com.eqms.service.ControlledCopyAuthorizationService;
import com.eqms.service.ControlledCopyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ControlledCopyControllerCapabilityTest {

    @Mock ControlledCopyService controlledCopyService;
    @Mock ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    @Mock ControlledCopyDistributionJobRepository controlledCopyDistributionJobRepository;
    @Mock com.eqms.repository.ControlledCopyDistributionJobItemRepository controlledCopyDistributionJobItemRepository;
    @Mock com.eqms.service.ControlledCopyPreviewRealtimeService controlledCopyPreviewRealtimeService;

    ControlledCopyController controller;

    @BeforeEach
    void setUp() {
        controller = new ControlledCopyController(controlledCopyService, controlledCopyAuthorizationService, controlledCopyDistributionJobRepository, controlledCopyDistributionJobItemRepository, controlledCopyPreviewRealtimeService);
    }

    @Test
    void getCopyActionCapabilities_returnsReadOnlyCapabilityResponse() {
        UUID copyId = UUID.randomUUID();
        ControlledCopyActionCapabilitiesResponse response = new ControlledCopyActionCapabilitiesResponse(
                copyId,
                null,
                null,
                null,
                "DISTRIBUTED",
                null,
                "CONTROLLED_COPY",
                "READY",
                "preview-token-1",
                "2026-07-04T00:00:00Z",
                Map.of("PREVIEW_FILE", ControlledCopyActionCapabilityDecisionResponse.allow("PREVIEW_FILE", "CONTROLLED_COPY", "DISTRIBUTED", "documents.controlled_copy.preview_file"))
        );
        when(controlledCopyAuthorizationService.getCopyCapabilities(eq(copyId))).thenReturn(response);

        var result = controller.getActionCapabilities(copyId);

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).isNotNull();
        assertThat(result.getBody().controlledCopyId()).isEqualTo(copyId);
        verifyNoInteractions(controlledCopyService);
    }

    @Test
    void openPreview_acceptsDistributionCredentialsInRequestBody() {
        UUID copyId = UUID.randomUUID();
        ControlledCopyPreviewSessionRequest request = new ControlledCopyPreviewSessionRequest("email-token", "recipient-password");
        ControlledCopyPreviewResponse response = new ControlledCopyPreviewResponse(
                copyId.toString(), "CC-001", "Document", "DOC-001", "1.0", "Recipient", 1,
                "short-lived-preview-grant", false, false, false, false, null
        );
        when(controlledCopyService.openPreview(copyId, "email-token", "recipient-password")).thenReturn(response);

        var result = controller.openPreview(copyId, request);

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).isSameAs(response);
        verify(controlledCopyService).openPreview(copyId, "email-token", "recipient-password");
    }

    @Test
    void previewFileAndDownload_useOnlyTheShortLivedPreviewGrant() {
        UUID copyId = UUID.randomUUID();
        ControlledCopyService.FileDownload file = new ControlledCopyService.FileDownload(
                new byte[] {1, 2, 3}, "controlled-copy.pdf", "application/pdf"
        );
        when(controlledCopyService.previewControlledCopyFile(copyId, "short-lived-preview-grant")).thenReturn(file);
        when(controlledCopyService.downloadControlledCopy(copyId, "short-lived-preview-grant", null)).thenReturn(file);

        var preview = controller.previewFile(copyId, "short-lived-preview-grant");
        var download = controller.downloadControlledCopy(copyId, "short-lived-preview-grant");

        assertThat(preview.getStatusCode().value()).isEqualTo(200);
        assertThat(download.getStatusCode().value()).isEqualTo(200);
        verify(controlledCopyService).previewControlledCopyFile(copyId, "short-lived-preview-grant");
        verify(controlledCopyService).downloadControlledCopy(copyId, "short-lived-preview-grant", null);
    }

    @Test
    void evidenceDownload_isAttachmentAndCannotBeMimeSniffedOrCached() {
        UUID copyId = UUID.randomUUID();
        UUID evidenceId = UUID.randomUUID();
        when(controlledCopyService.downloadEvidence(copyId, evidenceId)).thenReturn(
                new ControlledCopyService.FileDownload(new byte[] {1}, "evidence.png", "image/png")
        );

        var result = controller.downloadEvidence(copyId, evidenceId);

        assertThat(result.getHeaders().getFirst("Content-Disposition")).startsWith("attachment;");
        assertThat(result.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(result.getHeaders().getFirst("Cache-Control")).contains("no-store");
        verify(controlledCopyService).downloadEvidence(copyId, evidenceId);
    }

    @Test
    void distributionJobStatus_returnsSkippedSeparatelyFromSucceeded() {
        UUID batchId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();
        ControlledCopyDistributionJob job = new ControlledCopyDistributionJob();
        job.setId(jobId);
        job.setStatus("COMPLETED_WITH_ERRORS");
        job.setTotalItems(3);
        // Once a job is finished, the controller now trusts job.succeededItems/failedItems (written
        // atomically with job.status by ControlledCopyBatchDistributionAsyncService) instead of
        // re-counting job_items independently -- that second read was the exact race that could
        // under-report succeeded when polled in the tiny window after status flips to
        // COMPLETED/COMPLETED_WITH_ERRORS but a sibling item row's commit hadn't become visible yet.
        job.setSucceededItems(1);
        job.setFailedItems(1);
        when(controlledCopyDistributionJobRepository.findByBatch_IdAndActionTypeOrderByCreatedAtDesc(batchId, "DISTRIBUTE"))
                .thenReturn(List.of(job));
        // job_items is intentionally NOT stubbed here -- for a finished job the controller must not
        // even touch it (see comment above); a stray call would prove the race is still there.
        var result = controller.getDistributionJobStatus(batchId, "DISTRIBUTE");

        assertThat(result.getBody()).containsEntry("processed", 3);
        assertThat(result.getBody()).containsEntry("succeeded", 1);
        assertThat(result.getBody()).containsEntry("failed", 1);
        assertThat(result.getBody()).containsEntry("skipped", 1);
        assertThat(result.getBody()).containsEntry("status", "completed_with_errors");
    }

    @Test
    void copyCapability_unauthenticatedUser_denied() {
        UUID copyId = UUID.randomUUID();
        when(controlledCopyAuthorizationService.getCopyCapabilities(eq(copyId)))
                .thenThrow(new UnauthorizedException("Authentication required"));

        assertThatThrownBy(() -> controller.getActionCapabilities(copyId))
                .isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(controlledCopyService);
    }

    @Test
    void copyCapability_userWithoutBaseAccess_denied_noMatrixReturned() {
        UUID copyId = UUID.randomUUID();
        when(controlledCopyAuthorizationService.getCopyCapabilities(eq(copyId)))
                .thenThrow(new org.springframework.security.access.AccessDeniedException("Controlled copy access denied"));

        assertThatThrownBy(() -> controller.getActionCapabilities(copyId))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(controlledCopyService);
    }

    @Test
    void getBatchActionCapabilities_returnsReadOnlyCapabilityResponse() {
        UUID batchId = UUID.randomUUID();
        ControlledCopyActionCapabilitiesResponse response = new ControlledCopyActionCapabilitiesResponse(
                null,
                batchId,
                null,
                null,
                null,
                "READY_FOR_DISTRIBUTION",
                "CONTROLLED_COPY_BATCH",
                "READY",
                "preview-token-2",
                "2026-07-04T00:00:00Z",
                Map.of("distributeBatch", ControlledCopyActionCapabilityDecisionResponse.allow("DISTRIBUTE_BATCH", "CONTROLLED_COPY_BATCH", "READY_FOR_DISTRIBUTION", "documents.controlled_copy.distribute"))
        );
        when(controlledCopyAuthorizationService.getBatchCapabilities(eq(batchId))).thenReturn(response);

        var result = controller.getBatchActionCapabilities(batchId);

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).isNotNull();
        assertThat(result.getBody().batchId()).isEqualTo(batchId);
        verifyNoInteractions(controlledCopyService);
    }

    @Test
    void batchCapability_unauthenticatedUser_denied() {
        UUID batchId = UUID.randomUUID();
        when(controlledCopyAuthorizationService.getBatchCapabilities(eq(batchId)))
                .thenThrow(new UnauthorizedException("Authentication required"));

        assertThatThrownBy(() -> controller.getBatchActionCapabilities(batchId))
                .isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(controlledCopyService);
    }

    @Test
    void batchCapability_userWithoutBaseAccess_denied_noMatrixReturned() {
        UUID batchId = UUID.randomUUID();
        when(controlledCopyAuthorizationService.getBatchCapabilities(eq(batchId)))
                .thenThrow(new org.springframework.security.access.AccessDeniedException("Controlled copy access denied"));

        assertThatThrownBy(() -> controller.getBatchActionCapabilities(batchId))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(controlledCopyService);
    }
}
