package com.eqms.dto.publishing;

import java.util.List;

public record PublishingPlaceholderGroupResponse(
        String title,
        String description,
        List<PublishingPlaceholderItemResponse> items
) {}
