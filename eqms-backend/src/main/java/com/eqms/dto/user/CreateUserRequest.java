package com.eqms.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.List;

// `role` (app_users.role_name) is intentionally not a field here -- it's retired as an entitlement
// source (V280) and is no longer caller-editable; UserManagementService.applyCreateOrUpdate sets
// it to a fixed marker.
public record CreateUserRequest(
        @NotBlank @Pattern(regexp = "^NTP\\.\\d{4}$", message = "Invalid employee ID") String employeeCode,
        @NotBlank String username,
        @NotBlank String fullName,
        @NotBlank @Email String email,
        @Pattern(regexp = "^(?:$|\\d{7,15})$", message = "Invalid phone number") String phone,
        /** Access Profiles to grant on creation -- one flat list, no primary/additional split (that
         *  distinction was never persisted in user_access_profiles anyway). Optional so other
         *  creation paths (e.g. external provisioning) aren't forced to pick one up front; a user
         *  with none simply can't use any permission-gated function until an admin assigns one.
         *  Bundled into this same settings.user.create action/signature by design decision -- does
         *  NOT require security.access_profiles.assign, unlike assigning a profile later via
         *  /security/access-profiles/**. Still SoD-BLOCK-checked server-side before commit
         *  (UserManagementService.createUser), never trusting the FE's own real-time check alone. */
        List<String> accessProfileIds,
        @NotBlank String businessUnit,
        @NotBlank String department,
        @NotBlank String position,
        @NotBlank String status,
        String dateOfBirth,
        String gender,
        String nationality,
        String address,
        @NotBlank String employmentType,
        @NotBlank String startDate,
        String managerName,
        String language,
        String idNumber,
        String degree,
        String fieldOfStudy,
        String institution,
        String graduationYear,
        String gpa,
        String professionalLevel,
        String areaOfExpertise,
        String yearsOfExperience,
        String previousEmployer,
        Boolean inviteExternal,
        /** DASHBOARD (default when omitted) / NOTIFICATIONS / KNOWLEDGE -- landing page immediately
         *  after login. Validated in UserManagementService against the 3 known codes. */
        String homePage,
        /** Admin-mandated MFA requirement for this user, independent of the global "Enforce
         *  Two-Factor Authentication" setting and of the user's own self-service mfaEnabled
         *  toggle. Null/omitted means false (not required). */
        Boolean mfaRequiredByAdmin
) {
}
