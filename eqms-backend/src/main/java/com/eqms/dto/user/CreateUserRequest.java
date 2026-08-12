package com.eqms.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateUserRequest(
        @NotBlank @Pattern(regexp = "^NTP\\.\\d{4}$", message = "Invalid employee ID") String employeeCode,
        @NotBlank String username,
        @NotBlank String fullName,
        @NotBlank @Email String email,
        @Pattern(regexp = "^(?:$|\\d{7,15})$", message = "Invalid phone number") String phone,
        @NotBlank String role,
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
        Boolean inviteExternal
) {
}
