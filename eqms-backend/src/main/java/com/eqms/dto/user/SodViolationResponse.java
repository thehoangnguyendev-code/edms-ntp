package com.eqms.dto.user;

import java.util.List;
import java.util.UUID;

public record SodViolationResponse(
    UUID constraintId,
    String constraintName,
    String severity,
    String permissionCodeA,
    String permissionCodeB,
    String regulationRef,
    List<ViolatingAccessProfile> violatingAccessProfiles
) {
    public record ViolatingAccessProfile(
            UUID accessProfileId,
            String accessProfileName,
            String accessProfileCode) {}
}
