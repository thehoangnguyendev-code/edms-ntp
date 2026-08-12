package com.eqms.dto.security;

import java.util.UUID;
import java.util.List;

public record EffectiveAccessDiagnosisResponse(UUID subjectUserId, String resourceType, UUID resourceId,
                                                String actionCode, String state, boolean allowed,
                                                String reasonCode, String reasonMessage,
                                                String requiredPermissionCode,
                                                boolean systemSuperAdmin,
                                                boolean requiresESignature,
                                                List<EffectiveAccessDiagnosisLayer> layers) {}
