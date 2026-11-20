package com.eqms.dto.user;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Access Explorer (SECURITY-AUTHORIZATION-REVIEW D6): from a permission to the people who hold it, and through what. Read only. */
public final class AccessExplorerDtos {
    private AccessExplorerDtos() {
    }

    /** One permission of the catalogue, for the picker. */
    public record PermissionOption(String code, String name, String moduleKey, String category, String description) {}

    /** One line of the Access Explorer list: a permission with how widely it is held. */
    public record PermissionRow(String code, String name, String moduleKey, String category, String description, int permissionSetCount, int accessProfileCount, int holderCount,
                                int activeHolderCount) {}

    public record PermissionPage(List<PermissionRow> content, long totalElements, int totalPages, int page, int size) {}

    public record GrantingProfile(UUID id, String code, String name, boolean active, int holderCount) {}

    public record GrantingSet(UUID id, String code, String name, List<GrantingProfile> profiles) {}

    /** A person who holds the permission, with every access profile and permission set that gives it to them. */
    public record Holder(
            UUID userId,
            String employeeCode,
            String username,
            String fullName,
            String department,
            String status,
            List<String> viaProfiles,
            List<String> viaPermissionSets,
            Instant lastLoginAt,
            Instant timeLimitedUntil) {}

    public record HoldersResponse(
            PermissionOption permission,
            List<GrantingSet> permissionSets,
            List<Holder> holders,
            int holderCount,
            int activeHolderCount,
            /** The people that match the search and the "only active" switch, before paging: {@code holders} is one page of them. */
            long holderTotal,
            int totalPages) {}
}
