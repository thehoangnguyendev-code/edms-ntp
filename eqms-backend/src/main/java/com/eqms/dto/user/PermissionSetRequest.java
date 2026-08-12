package com.eqms.dto.user;

import java.util.List;

public record PermissionSetRequest(
    String name,
    String code,
    String description,
    boolean active,
    List<String> permissionCodes,
    String signatureToken,
    String reason
) {}
