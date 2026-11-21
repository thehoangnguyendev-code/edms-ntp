package com.eqms.dto.user;

import java.util.List;

/**
 * A page of the permissions of one Permission Set. {@code modules} are the values of the Module filter: every module that has a permission matching the search
 * (whatever module is chosen), with how many.
 */
public record PermissionSetPermissionPageResponse(
        List<PermissionSetPermissionRowResponse> data,
        PaginationResponse pagination,
        List<ModuleCount> modules
) {
    public record ModuleCount(String module, long count) {
    }
}
