package com.eqms.dto.user;

import java.util.UUID;

public record PermissionSetAssignedAccessProfileResponse(
    UUID id,
    String name,
    String code,
    boolean active,
    long userCount
) {}
