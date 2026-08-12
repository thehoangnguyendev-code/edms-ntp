package com.eqms.dto.user;

public record OfficeOnlineHealthResponse(
        String status,
        String message,
        boolean configured,
        boolean graphReachable,
        boolean sharingCapabilityTested,
        String checkedAt
) {}
