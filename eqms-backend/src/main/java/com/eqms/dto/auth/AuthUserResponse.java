package com.eqms.dto.auth;

import java.util.List;
import java.util.Map;

public record AuthUserResponse(
        String id,
        String username,
        String fullName,
        String email,
        String role,
        String department,
        String avatar,
        boolean requirePasswordChange,
        boolean mfaEnabled,
        boolean mfaEmailFallbackEnabled,
        boolean mfaRememberDeviceEnabled,
        boolean emailNotificationsEnabled,
        Map<String, Object> notificationPreferences,
        boolean mfaSetupRequired,
        boolean maintenanceMode,
        List<String> permissions,
        String employeeCode,
        String position,
        String businessUnit,
        String employmentType,
        String startDate,
        String nationality,
        String dateOfBirth,
        String gender,
        String address,
        String managerName,
        String language,
        String idNumber,
        String professionalLevel,
        String areaOfExpertise,
        String yearsOfExperience,
        String previousEmployer,
        String status,
        String lastLoginAt,
        String createdAt,
        String updatedAt,
        String passwordChangedAt,
        String suspendReason,
        String suspendedUntil,
        String terminationReason,
        String terminationDate,
        /** DASHBOARD / NOTIFICATIONS / KNOWLEDGE -- read by AppRoutes.tsx's post-login redirect,
         *  which must have it right off the login response (no extra /auth/me round trip). */
        String homePage,
        /** Admin-mandated per-user MFA requirement (see UserAccount#mfaRequiredByAdmin). */
        boolean mfaRequiredByAdmin
) {
}
