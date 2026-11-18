package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import com.eqms.entity.UserAccount;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * SECURITY-AUTHORIZATION-REVIEW D6: the Report Type "Permission Holders" is the export of Access Explorer. It is built from the chain the system decides with (ACTIVE profile, ACTIVE
 * permission set), is open to the audience of Access Explorer, is given to the whole system scope only, and has one row for each permission, profile and person.
 */
class PermissionHolderReportSourceTest {
    private final PermissionHolderReportMetadataProvider provider = new PermissionHolderReportMetadataProvider();
    private final UserAccount actor = new UserAccount();

    @Test
    void itFollowsTheChainTheSystemDecidesWithAndKeepsOneRowForEachPermissionProfileAndPerson() {
        actor.setId(UUID.randomUUID());
        String sql = provider.query(actor, List.of("SYSTEM"), Map.of()).fromWhere();

        assertTrue(sql.contains("ps.active") && sql.contains("rl.is_active"), "only active permission sets and active access profiles give a permission");
        assertTrue(sql.contains("user_access_profiles uap") && sql.contains("access_profile_permission_sets aps") && sql.contains("permission_set_items psi"));
        assertTrue(provider.identityColumn().contains("psi.id") && provider.identityColumn().contains("rl.id") && provider.identityColumn().contains("u.id") && provider.identityColumn().endsWith("::uuid"));
    }

    @Test
    void itIsForTheAudienceOfAccessExplorerAndForTheWholeSystemOnly() {
        assertEquals(List.of("settings.user.view", "security.access_profiles.view"), provider.usePermissions());
        assertEquals(List.of("SYSTEM"), provider.allowedScopes());
        assertThrows(SecurityException.class, () -> provider.query(actor, List.of("DEPARTMENT"), Map.of()));
        assertThrows(SecurityException.class, () -> provider.query(actor, List.of(), Map.of()));
        assertEquals("Security", provider.category());
    }

    @Test
    void filtersAreParametersNeverTextInTheQueryAndAnUnknownFilterIsRefused() {
        var query = provider.query(actor, List.of("SYSTEM"), Map.of("search", "x'; drop table app_users; --", "permission", "training.paper.verify", "status", "Active"));

        assertFalse(query.fromWhere().contains("drop table"));
        assertEquals(7, query.arguments().size(), "five search terms, the permission and the status");
    }

    @Test
    void noColumnCarriesASecretOrAContactDetail() {
        var codes = provider.columns().keySet();

        assertTrue(codes.containsAll(List.of("permissionCode", "fullName", "accessProfile", "permissionSet")));
        for (String forbidden : List.of("email", "phone", "address", "password", "idNumber", "dateOfBirth")) assertFalse(codes.contains(forbidden), forbidden);
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor, List.of("SYSTEM"), Map.of("email", "a@b.c")));
    }
}
