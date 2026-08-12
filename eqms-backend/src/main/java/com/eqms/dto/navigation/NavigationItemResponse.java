package com.eqms.dto.navigation;

import java.util.List;

public record NavigationItemResponse(
        String id,
        String label,
        String icon,
        String path,
        Boolean showDividerAfter,
        List<NavigationItemResponse> children
) {}
