package com.eqms;

import com.eqms.controller.ControlledCopyController;
import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.security.ControlledCopyActionCapabilityDecisionResponse;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ControlledCopyControllerCapabilityTest {

    @Mock ControlledCopyService controlledCopyService;
    @Mock ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    @Mock ControlledCopyDistributionJobRepository controlledCopyDistributionJobRepository;
    @Mock com.eqms.repository.ControlledCopyDistributionJobItemRepository controlledCopyDistributionJobItemRepository;

    ControlledCopyController controller;

    @BeforeEach
    void setUp() {
        controller = new ControlledCopyController(controlledCopyService, controlledCopyAuthorizationService, controlledCopyDistributionJobRepository, controlledCopyDistributionJobItemRepository);
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
