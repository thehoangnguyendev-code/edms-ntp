package com.eqms.dto.publishing;

import java.util.List;

public record PublishingPlaceholderCatalogResponse(
        List<PublishingPlaceholderGroupResponse> groups
) {}
