package com.eqms.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;

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
        String avatar
) {
}
