package com.eqms.dto.user;

/** Unlock now also issues a fresh temporary password (the account was locked out after
 * repeated failed attempts, so the old password is treated as compromised/forgotten) --
 * kept separate from UserManagementResponse so the raw password never rides along on the
 * list/detail endpoints that reuse that DTO. */
public record UnlockAccountResponse(
        String temporaryPassword,
        UserManagementResponse user
) {
}
