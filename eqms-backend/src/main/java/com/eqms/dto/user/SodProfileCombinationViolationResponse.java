package com.eqms.dto.user;

import java.util.List;
import java.util.UUID;

/**
 * SoD violation surfaced across a proposed SET of Access Profiles (e.g. the profiles about to be
 * assigned to a single user), as opposed to {@link SodViolationResponse} which scans each profile
 * individually. Shows exactly which profile(s) contribute each side of the conflicting pair so the
 * UI can explain "Profile X grants A, Profile Y grants B — together they violate constraint Z".
 */
public record SodProfileCombinationViolationResponse(
    UUID constraintId,
    String constraintName,
    String severity,
    String permissionCodeA,
    String permissionNameA,
    String permissionCodeB,
    String permissionNameB,
    String regulationRef,
    List<ProfileRef> contributingProfilesA,
    List<ProfileRef> contributingProfilesB
) {
    public record ProfileRef(UUID accessProfileId, String accessProfileName, String accessProfileCode) {}
}
