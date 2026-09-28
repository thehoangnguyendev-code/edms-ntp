package com.eqms.dto.user;

import java.util.List;
import java.util.UUID;

/**
 * SoD violation surfaced across a proposed SET of Access Profiles (e.g. the profiles about to be
 * assigned to a single user), as opposed to {@link SodViolationResponse} which scans each profile
 * individually. Shows exactly which profile(s) contribute each side of the conflicting pair so the
 * UI can explain "Profile X grants A, Profile Y grants B — together they violate constraint Z".
 *
 * Each contributing profile also carries impact-scoped remediation options (Mức 1/2/3):
 *   1. Remove this whole Access Profile from the user being edited -- scoped to just them, always
 *      safe, requires no further data (the FE renders this option on its own, not from a field
 *      here).
 *   2. Remove one of {@code permissionSets} from this Access Profile -- affects every OTHER user
 *      who also holds this profile ({@code usersHoldingThisProfile}).
 *   3. Remove the conflicting permission from a Permission Set's own definition -- affects every
 *      user of every Access Profile built on that set ({@code usersAffectedIfEditedAtSetLevel}),
 *      a strictly wider blast radius than option 2.
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
    public record ProfileRef(
        UUID accessProfileId,
        String accessProfileName,
        String accessProfileCode,
        long usersHoldingThisProfile,
        List<RemediationPermissionSet> permissionSets
    ) {}

    public record RemediationPermissionSet(
        UUID permissionSetId,
        String permissionSetName,
        long profilesUsingThisSet,
        long usersAffectedIfEditedAtSetLevel
    ) {}
}
