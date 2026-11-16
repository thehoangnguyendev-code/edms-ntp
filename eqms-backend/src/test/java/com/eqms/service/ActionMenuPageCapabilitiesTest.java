package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.*;
import com.eqms.repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ActionMenuPageCapabilitiesTest {
    @Test void profilePageMatchesCapabilityEndpointAndReflectsPermissionRevocation() {
        var roles=mock(RoleDefinitionRepository.class);
        var sets=mock(AccessProfilePermissionSetRepository.class);
        var participants=mock(UserAccessProfileRepository.class);
        var current=mock(CurrentUserService.class);
        var permissions=mock(PermissionEvaluationService.class);
        var actor=new UserAccount(); actor.setId(UUID.randomUUID());
        var role=new RoleDefinition(); role.setId(UUID.randomUUID()); role.setName("Profile"); role.setCode("PROFILE");
        var service=mock(AccessProfileService.class,CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service,"roleRepo",roles);
        ReflectionTestUtils.setField(service,"appSetRepo",sets);
        ReflectionTestUtils.setField(service,"appWfRepo",mock(AccessProfileWorkflowRoleRepository.class));
        ReflectionTestUtils.setField(service,"uapRepo",participants);
        ReflectionTestUtils.setField(service,"currentUserService",current);
        ReflectionTestUtils.setField(service,"permissionEvaluationService",permissions);
        when(current.requireCurrentUser()).thenReturn(actor);
        when(permissions.hasAnyPermission(eq(actor),any(String[].class))).thenReturn(true);
        when(permissions.hasPermission(eq(actor),anyString())).thenReturn(true);
        when(roles.findAll(any(Specification.class),any(Pageable.class))).thenReturn(new PageImpl<>(List.of(role)));
        when(roles.findById(role.getId())).thenReturn(Optional.of(role));
        when(participants.countByAccessProfileId(role.getId())).thenReturn(2L);
        var row=service.listProfiles(0,10,null,null,null,null,null,null,null,"name","asc").getContent().getFirst();
        assertThat(row.capabilities()).isEqualTo(service.getCapabilities(role.getId()));
        assertThat(row.capabilities().actions().get("delete").allowed()).isFalse();
        assertThat(row.capabilities().actions().get("edit").allowed()).isTrue();
        when(permissions.hasPermission(eq(actor),anyString())).thenReturn(false);
        var refreshed=service.listProfiles(0,10,null,null,null,null,null,null,null,"name","asc").getContent().getFirst();
        assertThat(refreshed.capabilities().actions().get("edit").allowed()).isFalse();
        assertThat(refreshed.capabilities().actions().get("assignUsers").allowed()).isFalse();
    }

    @Test void permissionSetCapabilitiesArePageBoundedAndPreserveSystemAndUsageGuards() {
        var repository=mock(PermissionSetRepository.class);
        var assignments=mock(AccessProfilePermissionSetRepository.class);
        var current=mock(CurrentUserService.class);
        var permissions=mock(PermissionEvaluationService.class);
        var actor=new UserAccount(); actor.setId(UUID.randomUUID());
        var system=new PermissionSet(); ReflectionTestUtils.setField(system,"id",UUID.randomUUID()); system.setName("A"); system.setCode("A"); system.setSystem(true); system.setActive(true);
        var assigned=new PermissionSet(); ReflectionTestUtils.setField(assigned,"id",UUID.randomUUID()); assigned.setName("B"); assigned.setCode("B"); assigned.setActive(true);
        var service=new PermissionSetService(repository,mock(PermissionSetItemRepository.class),mock(PermissionRepository.class),
                assignments,mock(UserAccessProfileRepository.class),current,mock(AuditTrailService.class),permissions,mock(SecurityChangeSignatureService.class));
        when(current.requireCurrentUser()).thenReturn(actor);
        when(permissions.hasAnyPermission(eq(actor),any(String[].class))).thenReturn(true);
        when(permissions.hasPermission(eq(actor),anyString())).thenReturn(true);
        when(repository.findAllByOrderByNameAsc()).thenReturn(List.of(system,assigned));
        var first=service.listPaged(1,1,null,null,null,null,null,null,null,null,null,"name","asc",false).data().getFirst();
        assertThat(first.capabilities().actions().get("toggleStatus").allowed()).isFalse();
        assertThat(first.capabilities().actions().get("delete").allowed()).isFalse();
        verify(assignments).countUsageForPage(List.of(system.getId()));
        when(assignments.countUsageForPage(List.of(assigned.getId()))).thenReturn(Collections.singletonList(new Object[]{assigned.getId(),1L}));
        var second=service.listPaged(2,1,null,null,null,null,null,null,null,null,null,"name","asc",false).data().getFirst();
        assertThat(second.capabilities().actions().get("delete").allowed()).isFalse();
        assertThat(second.capabilities().actions().get("clone").allowed()).isTrue();
        when(permissions.hasPermission(eq(actor),anyString())).thenReturn(false);
        var revoked=service.listPaged(2,1,null,null,null,null,null,null,null,null,null,"name","asc",false).data().getFirst();
        assertThat(revoked.capabilities().actions().get("clone").allowed()).isFalse();
        verify(assignments,never()).countByPermissionSetId(any());
    }

    @Test void deniedListDoesNotReadProfilesOrPermissionSets() {
        var current=mock(CurrentUserService.class);
        var permissions=mock(PermissionEvaluationService.class);
        when(current.requireCurrentUser()).thenReturn(new UserAccount());
        var repository=mock(PermissionSetRepository.class);
        var service=new PermissionSetService(repository,mock(PermissionSetItemRepository.class),mock(PermissionRepository.class),
                mock(AccessProfilePermissionSetRepository.class),mock(UserAccessProfileRepository.class),current,mock(AuditTrailService.class),permissions,mock(SecurityChangeSignatureService.class));
        assertThatThrownBy(()->service.listPaged(1,10,null,null,null,null,null,null,null,null,null,"name","asc",false))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(repository);
    }
}
