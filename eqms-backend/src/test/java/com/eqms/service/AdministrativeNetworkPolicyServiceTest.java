package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdministrativeNetworkPolicyServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final AdministrativeNetworkPolicyService service = new AdministrativeNetworkPolicyService(jdbc, new ObjectMapper(), users, permissions, audit);
    private final UserAccount actor = mock(UserAccount.class);

    @Test void unauthorizedActorCannotSave() {
        assertThrows(AccessDeniedException.class, () -> service.save(actor, null, "127.0.0.1", null));
        verifyNoInteractions(jdbc, audit);
    }

    @Test void rejectsInactiveEmergencyAccount() {
        var id = UUID.randomUUID();
        var emergency = mock(UserAccount.class);
        when(permissions.hasPermission(actor, "settings.configuration.manage")).thenReturn(true);
        when(users.findById(id)).thenReturn(Optional.of(emergency));
        when(emergency.getStatus()).thenReturn(UserStatus.Suspended);
        var policy = new AdministrativeNetworkPolicyService.Settings(true, List.of("10.0.0.0/8"), List.of(), id);
        assertThrows(IllegalArgumentException.class, () -> service.save(actor, policy, "10.0.0.1", null));
        verifyNoInteractions(jdbc, audit);
    }

    @Test void refusesToBlockTheCurrentAdministrator() {
        var id = UUID.randomUUID();
        var emergency = mock(UserAccount.class);
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(permissions.hasPermission(actor, "settings.configuration.manage")).thenReturn(true);
        when(permissions.hasPermission(emergency, "settings.configuration.manage")).thenReturn(true);
        when(users.findById(id)).thenReturn(Optional.of(emergency));
        when(emergency.getStatus()).thenReturn(UserStatus.Active);
        var policy = new AdministrativeNetworkPolicyService.Settings(true, List.of("10.0.0.0/8"), List.of(), id);
        assertThrows(IllegalArgumentException.class, () -> service.save(actor, policy, "192.168.1.2", null));
        verifyNoInteractions(jdbc, audit);
    }

    @Test void checkAddressSaysHowTheServerSeesTheCallerAndWhetherTheNetworksLetItIn() {
        var inside = service.checkAddress(new AdministrativeNetworkPolicyService.Settings(false, List.of("10.0.0.0/8"), List.of(), null), "10.4.5.6", null, false);
        var outside = service.checkAddress(new AdministrativeNetworkPolicyService.Settings(false, List.of("10.0.0.0/8"), List.of(), null), "203.0.113.9", null, true);

        assertEquals("10.4.5.6", inside.address());
        assertTrue(inside.allowed());
        assertFalse(outside.allowed());
        assertTrue(outside.recoveryDisabled());
    }

    @Test void checkAddressUsesTheForwardedAddressOnlyBehindATrustedProxy() {
        var viaProxy = new AdministrativeNetworkPolicyService.Settings(false, List.of("10.0.0.0/8"), List.of("172.18.0.0/16"), null);
        var untrusted = new AdministrativeNetworkPolicyService.Settings(false, List.of("10.0.0.0/8"), List.of(), null);

        assertEquals("10.9.9.9", service.checkAddress(viaProxy, "172.18.0.2", "10.9.9.9", false).address());
        assertEquals("172.18.0.2", service.checkAddress(untrusted, "172.18.0.2", "10.9.9.9", false).address());
    }

    @Test void checkAddressRejectsAnInvalidNetwork() {
        assertThrows(IllegalArgumentException.class, () -> service.checkAddress(new AdministrativeNetworkPolicyService.Settings(false, List.of("not-a-network"), List.of(), null), "10.0.0.1", null, false));
    }
}
