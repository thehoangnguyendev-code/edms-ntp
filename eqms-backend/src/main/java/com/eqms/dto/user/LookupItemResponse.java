package com.eqms.dto.user;

public record LookupItemResponse(
        String id,
        String name,
        String code,
        String label,
        String value
) {
}
