package com.eqms.dto.publishing;

import java.util.UUID;

public record PublishingJobStatusResponse(UUID publishingJobId, String publishingJobStatus,
        String publishingJobMessage, String publishingJobError) { }
