package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

public record EducationRequest(
        @NotBlank String degree,
        @NotBlank String fieldOfStudy,
        @NotBlank String institution,
        String graduationYear,
        String gpa
) {
}
