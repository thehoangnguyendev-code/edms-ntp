package com.eqms.dto.user;

public record EducationResponse(
        String id,
        String degree,
        String fieldOfStudy,
        String institution,
        String graduationYear,
        String gpa
) {
}
