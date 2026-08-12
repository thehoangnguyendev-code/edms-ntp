package com.eqms.dto.user;

public record SodConstraintRequest(
    String name,
    String description,
    String permissionCodeA,
    String permissionCodeB,
    String severity,
    String regulationRef,
    boolean active,
    String signatureToken,
    String reason
) {}
