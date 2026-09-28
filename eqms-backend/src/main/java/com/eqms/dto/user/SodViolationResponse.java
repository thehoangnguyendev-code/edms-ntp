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
    /** A single Access Profile alone grants both sides of the pair -- fix the profile. */
    List<ViolatingAccessProfile> violatingAccessProfiles,
    /** No single Access Profile grants both sides, but this user's combined active profiles do --
     * fix the assignment (don't give this person both profiles), not any one profile. */
    List<ViolatingUserCombination> violatingUserCombinations
) {
    public record ViolatingAccessProfile(
            UUID accessProfileId,
            String accessProfileName,
            String accessProfileCode) {}

    public record ProfileRef(
            UUID accessProfileId,
            String accessProfileName,
            String accessProfileCode) {}

    public record ViolatingUserCombination(
            UUID userId,
            String username,
            String fullName,
            List<ProfileRef> profilesGrantingA,
            List<ProfileRef> profilesGrantingB) {}
}
