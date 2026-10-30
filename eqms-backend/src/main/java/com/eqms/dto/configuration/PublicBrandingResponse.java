package com.eqms.dto.configuration;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

/** Branding that is safe to expose before authentication. */
public record PublicBrandingResponse(
        String systemDisplayName,
        String systemLogo,
        String systemSidebarCollapsedLogo,
        boolean showSidebarUserProfile,
        boolean knowledgeExplorerEnabled,
        boolean compactDesktopFilters,
        boolean alternatingRecordColors,
        String alternatingRecordColor,
        JsonNode mainBackground,
        JsonNode authBackground,
        String toastPosition,
        /** How long a system message stays on screen, in seconds (2 to 60; 5 when the administrator set nothing). */
        int toastDurationSeconds,
        /** How the materials of a training are drawn: TABLE or TILES (TABLE when the administrator set nothing). */
        String trainingMaterialsLayout,
        String systemFavicon,
        String systemFooter,
        /** Text of the top bar on the Dashboard; null when the administrator left it empty (the screen then uses its default). */
        String systemHeaderTitle,
        Map<String, String> navigationLabelOverrides,
        /** Changes whenever the home-screen shortcut icon, its colour or its name change; empty when no custom icon is set. */
        String appIconVersion,
        /** The label of the home-screen shortcut; null when the administrator left it empty (the display name is used). */
        String appShortName
) {
}
