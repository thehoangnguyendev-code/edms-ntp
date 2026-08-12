package com.eqms.dto.user;

public record ExternalIdentityProvisioningResponse(
        String userId, String email, String provider, String tenantId, String objectId,
        String invitationId, String status, String statusLabel, String statusColor, String invitedAt, String redeemedAt,
        String disabledAt, String lastErrorCode, String lastErrorMessage, int attemptCount
) {}
