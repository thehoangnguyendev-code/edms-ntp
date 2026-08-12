package com.eqms.dto.user;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record RolePermissionsUpdateRequest(
        @NotNull List<String> permissions
) {
}
