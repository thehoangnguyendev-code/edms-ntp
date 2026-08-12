package com.eqms.event;

import com.eqms.dto.publishing.PublishingWorkspaceRequest;

import java.util.UUID;

public record PublishingWorkspaceOpenedEvent(
        UUID jobId,
        UUID revisionId,
        UUID requestedByUserId,
        PublishingWorkspaceRequest request
) {}
