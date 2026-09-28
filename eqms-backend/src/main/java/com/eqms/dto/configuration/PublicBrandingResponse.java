package com.eqms.dto.configuration;

import java.util.Map;

/** Branding that is safe to expose before authentication. */
public record PublicBrandingResponse(
        String systemDisplayName,
        String systemLogo,
        String systemSidebarCollapsedLogo,
        boolean showSidebarUserProfile,
        boolean knowledgeExplorerEnabled,
        String systemFavicon,
        String systemFooter,
        Map<String, String> navigationLabelOverrides
) {
}
