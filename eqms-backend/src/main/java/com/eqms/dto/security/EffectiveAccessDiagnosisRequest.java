package com.eqms.dto.security;

import java.util.UUID;

public record EffectiveAccessDiagnosisRequest(UUID subjectUserId, String resourceType, UUID resourceId, String actionCode) {}
