package com.eqms.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @Pattern(regexp = "^(?:$|NTP\\.\\d{4})$", message = "Invalid employee ID") String employeeCode,
        String username,
        String fullName,
        @Email String email,
        @Pattern(regexp = "^(?:$|\\d{7,15})$", message = "Invalid phone number") String phone,
        String role,
        String businessUnit,
        String department,
        String position,
        String status,
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
        String professionalLevel,
        String areaOfExpertise,
        String yearsOfExperience,
        String previousEmployer,
        // Same defensive cap as UpdateProfileRequest.avatar -- see that record's comment.
        @Size(max = 2_000_000, message = "Avatar image is too large") String avatar,
        /** DASHBOARD / NOTIFICATIONS / KNOWLEDGE -- null/omitted means "leave unchanged", same
         *  partial-update convention as every other field here. */
        String homePage,
        /** Admin-mandated MFA requirement for this user (see CreateUserRequest#mfaRequiredByAdmin).
         *  Null/omitted means "leave unchanged". */
        Boolean mfaRequiredByAdmin
) {
}
