package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.RevisionController;
import com.eqms.dto.document.*;
import com.eqms.dto.security.RevisionActionCapabilitiesResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.RevisionActionCapabilityService;
import com.eqms.service.RevisionService;
import com.eqms.service.RevisionWorkspaceBatchService;
import com.eqms.service.RevisionWorkspaceSnapshotService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevisionActionCapabilityControllerTest {

    @Mock RevisionService revisionService;
    @Mock RevisionActionCapabilityService capabilityService;
    @Mock RevisionWorkspaceSnapshotService revisionWorkspaceSnapshotService;
    @Mock RevisionWorkspaceBatchService revisionWorkspaceBatchService;

    RevisionController controller;

    @BeforeEach
    void setUp() {
        controller = new RevisionController(
                revisionService,
                capabilityService,
                revisionWorkspaceSnapshotService,
                revisionWorkspaceBatchService
        );
    }

    @Test
    void getActionCapabilities_reachesService() {
        UUID id = UUID.randomUUID();
        when(capabilityService.getCapabilities(eq(id))).thenReturn(
                new RevisionActionCapabilitiesResponse(id, null, "DRAFT", "SOURCE_DOCX", "DRAFT", null, "2026-07-03T00:00:00Z", Map.of())
        );

        var response = controller.getActionCapabilities(id);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().revisionId()).isEqualTo(id);
    }
}
