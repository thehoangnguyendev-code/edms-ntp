package com.eqms.dto.user;

public record OfficeOnlineConfigurationTestRequest(
        Boolean enabled,
        String graphBaseUrl,
        String tenantId,
        String clientId,
        String clientSecret,
        String siteId,
        String driveId,
        String libraryFolder,
        String shareLinkScope,
        Boolean reviewLinksEnabled
) {
}
