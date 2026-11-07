package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.UserActionCapabilitiesResponse;
import com.eqms.dto.user.UserManagementResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.EmergencyAccountChangeGuard;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.UserManagementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atMostOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The row menu of User Management opens with its items already decided: the list carries what the signed-in user may do with each account, so
 * the menu needs no request of its own. The decision is the same one that GET /users/{id}/capabilities gives, and each permission is read once for the page.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserManagementServiceCapabilitiesTest {
    @Mock private UserAccountRepository userRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private CurrentUserService currentUserService;
    @Mock private com.eqms.repository.AuthSessionRepository sessionRepository;
    @Mock private com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;
    @Mock private com.eqms.service.SystemConfigurationService systemConfigurationService;
    @InjectMocks private UserManagementService service;

    private UserAccount actor;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "emergencyAccountChangeGuard", mock(EmergencyAccountChangeGuard.class));
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setUsername("admin");
        actor.setStatus(UserStatus.Active);
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
    }

    private UserAccount account(boolean locked) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setUsername("u" + user.getId().toString().substring(0, 4));
        user.setFullName("Person");
        user.setStatus(UserStatus.Active);
        if (locked) user.setLockedUntil(Instant.now().plusSeconds(600));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void theCapabilitiesFollowThePermissionsOfTheSignedInUserAndTheLockOfTheAccount() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(false);
        when(permissionEvaluationService.hasPermission(actor, "settings.user.view")).thenReturn(true);
        when(permissionEvaluationService.hasPermission(actor, "settings.user.edit")).thenReturn(true);
        UserAccount locked = account(true);
        UserAccount free = account(false);

        UserActionCapabilitiesResponse forLocked = service.getUserCapabilities(locked.getId());
        UserActionCapabilitiesResponse forFree = service.getUserCapabilities(free.getId());

        assertThat(forLocked.actions().get("view").allowed()).isTrue();
        assertThat(forLocked.actions().get("suspend").allowed()).isTrue();
        assertThat(forLocked.actions().get("resetPassword").allowed()).isFalse();
        assertThat(forLocked.actions().get("resetPassword").reason()).contains("permission");
        assertThat(forLocked.actions().get("unlock").allowed()).isTrue();
        assertThat(forFree.actions().get("unlock").allowed()).isFalse();
        assertThat(forFree.actions().get("unlock").reason()).isEqualTo("Account is not currently locked.");
        assertThat(forFree.actions()).containsKeys("view", "edit", "resetPassword", "suspend", "terminate", "reinstate", "forceLogout", "unlock");
    }

    @Test
    void aPermissionIsReadOnceNoMatterHowManyActionsUseIt() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(true);
        UserAccount user = account(false);

        service.getUserCapabilities(user.getId());

        // suspend, terminate, reinstate, edit and unlock all rest on settings.user.edit.
        verify(permissionEvaluationService, atMostOnce()).hasPermission(actor, "settings.user.edit");
    }

    @Test
    void theUserListCarriesTheCapabilitiesOfEveryRowAndTheModelOfTheDetailScreensDoesNot() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(true);
        UserAccount first = account(true);
        UserAccount second = account(false);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(first, second)));

        List<UserManagementResponse> rows = service.getUsers(1, 10, null, null, null, null, null, null, null, null, null, null, null, null, null, "employeeCode", "asc", false).data();

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).capabilities()).isNotNull();
        assertThat(rows.get(0).capabilities().userId()).isEqualTo(first.getId().toString());
        assertThat(rows.get(0).capabilities().actions().get("unlock").allowed()).isTrue();
        assertThat(rows.get(1).capabilities().actions().get("unlock").allowed()).isFalse();
        // the same permission is not asked again for the second row
        verify(permissionEvaluationService, atMostOnce()).hasPermission(actor, "settings.user.edit");

        UserManagementResponse detail = service.toResponse(first, false);
        assertThat(detail.capabilities()).isNull();
    }
}
