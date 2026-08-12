package com.eqms.dto.security;

import java.util.UUID;

public record ParticipantReconciliationMismatchResponse(
        String discrepancyType, UUID resourceId, String participantType, UUID userId,
        int sequenceOrder, String legacyActionStatus, String genericActionStatus
) {}
