package com.eqms.dto.user;

public record UserCreationResponse(
        UserManagementResponse user,
        String password
) {
}
