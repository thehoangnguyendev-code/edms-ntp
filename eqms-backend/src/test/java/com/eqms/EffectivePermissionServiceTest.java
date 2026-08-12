package com.eqms;

import com.eqms.entity.*;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.EffectivePermissionService.EffectivePermissionResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EffectivePermissionServiceTest {
    @Mock private UserAccessProfileRepository userAccessProfileRepository;
    @Mock private AccessProfilePermissionSetRepository accessProfilePermissionSetRepository;
    @InjectMocks private EffectivePermissionService service;

    private UUID userId;
    private UserAccount user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = new UserAccount();
        user.setId(userId);
        user.setUsername("testuser");
    }

    @Test
    void resolvesPermissionsViaAccessProfileChain() {
        RoleDefinition profile = activeProfile("QA_MANAGER");
        when(userAccessProfileRepository.findByUserId(userId)).thenReturn(List.of(assignment(profile)));
        PermissionSet set = permissionSet("PS_AUDIT", true, "audit.view");
        when(accessProfilePermissionSetRepository.findByAccessProfileId(profile.getId()))
                .thenReturn(List.of(link(profile, set)));

        EffectivePermissionResult result = service.getEffectivePermissionResult(user);

        assertEquals(java.util.Set.of("audit.view"), result.permissionCodes());
        assertEquals(List.of("QA_MANAGER"), result.accessProfileCodes());
        assertFalse(result.systemSuperAdmin());
        assertFalse(result.legacyFallbackUsed());
    }

    @Test
    void ignoresInactivePermissionSet() {
        RoleDefinition profile = activeProfile("QA_MANAGER");
        when(userAccessProfileRepository.findByUserId(userId)).thenReturn(List.of(assignment(profile)));
        PermissionSet set = permissionSet("PS_INACTIVE", false, "audit.view");
        when(accessProfilePermissionSetRepository.findByAccessProfileId(profile.getId()))
                .thenReturn(List.of(link(profile, set)));

        EffectivePermissionResult result = service.getEffectivePermissionResult(user);

        assertTrue(result.permissionCodes().isEmpty());
        assertFalse(result.systemSuperAdmin());
    }

    @Test
    void roleNameNeverGrantsPermissionsWithoutAccessProfile() {
        user.setRoleName("DCO");
        when(userAccessProfileRepository.findByUserId(userId)).thenReturn(List.of());

        EffectivePermissionResult result = service.getEffectivePermissionResult(user);

        assertTrue(result.permissionCodes().isEmpty());
        assertFalse(result.systemSuperAdmin());
        assertFalse(result.legacyFallbackUsed());
    }

    @Test
    void systemSuperAdminIsDetectedOnlyByCanonicalAccessProfileCode() {
        RoleDefinition profile = activeProfile(EffectivePermissionService.SYSTEM_SUPER_ADMIN_CODE);
        when(userAccessProfileRepository.findByUserId(userId)).thenReturn(List.of(assignment(profile)));
        when(accessProfilePermissionSetRepository.findByAccessProfileId(profile.getId())).thenReturn(List.of());

        EffectivePermissionResult result = service.getEffectivePermissionResult(user);

        assertTrue(result.systemSuperAdmin());
        assertTrue(result.permissionCodes().isEmpty(), "Super admin receives only explicitly assigned permissions");
    }

    @Test
    void mutableProfileNameDoesNotAffectPermissionResolution() {
        RoleDefinition profile = activeProfile("DOC_GOVERNANCE");
        profile.setName("DCO");
        when(userAccessProfileRepository.findByUserId(userId)).thenReturn(List.of(assignment(profile)));
        PermissionSet set = permissionSet("PS_DOC", true, "documents.workspace.manage");
        when(accessProfilePermissionSetRepository.findByAccessProfileId(profile.getId()))
                .thenReturn(List.of(link(profile, set)));

        assertTrue(service.getEffectivePermissionCodes(user).contains("documents.workspace.manage"));

        profile.setName("Document Governance Officer");
        assertTrue(service.getEffectivePermissionCodes(user).contains("documents.workspace.manage"));
    }

    @Test
    void returnsEmptyResultForNullUser() {
        EffectivePermissionResult result = service.getEffectivePermissionResult(null);
        assertNull(result.userId());
        assertTrue(result.permissionCodes().isEmpty());
        assertFalse(result.systemSuperAdmin());
    }

    private RoleDefinition activeProfile(String code) {
        RoleDefinition profile = new RoleDefinition();
        profile.setId(UUID.randomUUID());
        profile.setCode(code);
        profile.setName(code);
        profile.setActive(true);
        return profile;
    }

    private UserAccessProfile assignment(RoleDefinition profile) {
        UserAccessProfile value = new UserAccessProfile();
        value.setUserId(userId);
        value.setAccessProfileId(profile.getId());
        ReflectionTestUtils.setField(value, "accessProfile", profile);
        return value;
    }

    private PermissionSet permissionSet(String code, boolean active, String permissionCode) {
        Permission permission = new Permission();
        permission.setCode(permissionCode);
        PermissionSetItem item = new PermissionSetItem();
        ReflectionTestUtils.setField(item, "permission", permission);
        PermissionSet set = new PermissionSet();
        ReflectionTestUtils.setField(set, "id", UUID.randomUUID());
        set.setCode(code);
        set.setActive(active);
        set.getItems().add(item);
        return set;
    }

    private AccessProfilePermissionSet link(RoleDefinition profile, PermissionSet set) {
        AccessProfilePermissionSet value = new AccessProfilePermissionSet();
        value.setAccessProfileId(profile.getId());
        value.setPermissionSetId(set.getId());
        ReflectionTestUtils.setField(value, "permissionSet", set);
        return value;
    }
}
