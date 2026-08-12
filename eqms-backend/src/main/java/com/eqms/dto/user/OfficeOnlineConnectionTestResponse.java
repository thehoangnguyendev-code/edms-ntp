package com.eqms.dto.user;

public record OfficeOnlineConnectionTestResponse(
        boolean success,
        String message,
        String siteId,
        String driveId,
        String libraryFolder
) {
}
