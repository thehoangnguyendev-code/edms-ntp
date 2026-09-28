package com.eqms.dto.user;

import java.util.List;

public record UserManagementResponse(
        String id,
        String employeeCode,
        String fullName,
        String username,
        String email,
        String phone,
        String role,
        /** Real Access Profile names actually granting this user's entitlement (user_access_profiles),
         *  ordered by assignedAt -- NOT the legacy `role` string above. Empty means the user has zero
         *  Access Profiles and cannot use any permission-gated function until an admin assigns one. */
        List<String> accessProfileNames,
        String position,
        String businessUnit,
        String department,
        String status,
        /** True while lockedUntil is set and in the future -- i.e. handleFailedLogin() has
         * actually locked the account out of login. Separate from `status` because there is no
         * UserStatus.Locked value: a lockout can happen to an otherwise-Active account and must
         * not be confused with (or silently overwrite) Suspended/Terminated. */
        boolean accountLocked,
        boolean inSession,
        boolean online,
        String lastLogin,
        String createdDate,
        String firstName,
        String lastName,
        List<String> permissions,
        String avatar,
        boolean requirePasswordChange,
        boolean mfaEnabled,
        boolean mfaEmailFallbackEnabled,
        boolean mfaRememberDeviceEnabled,
        boolean emailNotificationsEnabled,
        boolean mfaSetupRequired,
        boolean maintenanceMode,
        String dateOfBirth,
        String gender,
        String nationality,
        String address,
        String employmentType,
        String startDate,
        String managerName,
        String language,
        String idNumber,
        String degree,
        String fieldOfStudy,
        String institution,
        String graduationYear,
        String gpa,
        List<EducationResponse> educationList,
        String professionalLevel,
        String areaOfExpertise,
        String yearsOfExperience,
        String previousEmployer,
        List<CertificationResponse> certifications,
        String passwordChangedAt,
        String suspendReason,
        String suspendedUntil,
        String terminationReason,
        String terminationDate,
        String externalProvisioningStatus,
        String externalProvisioningEmail,
        String externalProvisioningStatusLabel,
        String externalProvisioningStatusColor,
        /** DASHBOARD / NOTIFICATIONS / KNOWLEDGE -- landing page immediately after login. */
        String homePage,
        /** Admin-mandated per-user MFA requirement (see UserAccount#mfaRequiredByAdmin). */
        boolean mfaRequiredByAdmin
) {
}
