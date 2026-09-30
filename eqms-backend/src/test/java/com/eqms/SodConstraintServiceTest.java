package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.SodConstraintRequest;
import com.eqms.dto.user.SodConstraintResponse;
import com.eqms.entity.SodConstraint;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.SodConstraintRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
import com.eqms.service.SodConstraintService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Focused rules for {@link SodConstraintService}'s runtime hook and the system-row admin toggle:
 * <ul>
 *   <li>{@code isActiveConstraint} reflects an ACTIVE row for the unordered pair (delegates to findConflict).</li>
 *   <li>A system constraint can be activated/deactivated (e-signed, audited) but its definition stays fixed.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class SodConstraintServiceTest {

    private static final String A = "documents.uncontrolled_copy.request";
    private static final String B = "documents.uncontrolled_copy.approve_request";

    @Mock private SodConstraintRepository sodRepository;
    @Mock private RoleDefinitionRepository roleRepository;
    @Mock private EffectivePermissionService effectivePermissionService;
    @Mock private PermissionRepository permissionRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private SecurityChangeSignatureService securityChangeSignatureService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private UserAccessProfileRepository userAccessProfileRepository;
    @Mock private AccessProfilePermissionSetRepository accessProfilePermissionSetRepository;

    @InjectMocks
    private SodConstraintService service;

    // ---------------------------------------------------------------------------------------------------------
    // isActiveConstraint (runtime hook)
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void isActiveConstraint_true_whenActiveRowExistsForPair() {
        when(sodRepository.findConflict(A, B)).thenReturn(Optional.of(systemConstraint(true)));
        assertTrue(service.isActiveConstraint(A, B));
    }

    @Test
    void isActiveConstraint_false_whenNoActiveRow() {
        // findConflict only returns ACTIVE rows (either order); an inactive row therefore yields empty.
        when(sodRepository.findConflict(A, B)).thenReturn(Optional.empty());
        assertFalse(service.isActiveConstraint(A, B));
    }

    @Test
    void isActiveConstraint_false_forBlankCodes_withoutQuerying() {
        assertFalse(service.isActiveConstraint(" ", B));
        assertFalse(service.isActiveConstraint(A, null));
        verifyNoInteractions(sodRepository);
    }

    @Test
    void isActiveConstraint_requiresNoSodViewPermission() {
        when(sodRepository.findConflict(A, B)).thenReturn(Optional.empty());
        service.isActiveConstraint(A, B);
        verifyNoInteractions(currentUserService, permissionEvaluationService);
    }

    // ---------------------------------------------------------------------------------------------------------
    // System row: active flag is the only admin-changeable field
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void update_systemConstraint_deactivates_andKeepsDefinitionFixed() {
        UserAccount admin = manager();
        SodConstraint c = systemConstraint(true);
        when(sodRepository.findById(c.getId())).thenReturn(Optional.of(c));

        // Attempted definition changes on a system row are ignored -- only 'active' is applied.
        SodConstraintResponse response = service.update(c.getId(), new SodConstraintRequest(
                "Renamed", "changed", "x.a", "x.b", "WARN", "changed", false, "sig", "Pilot site allows self-approval"));

        assertFalse(c.isActive());
        assertFalse(response.active());
        assertEquals("Request vs Approve Uncontrolled Copy", c.getName());
        assertEquals(A, c.getPermissionCodeA());
        assertEquals(B, c.getPermissionCodeB());
        assertEquals("BLOCK", c.getSeverity());
        verify(securityChangeSignatureService).requireValidToken(admin, "sig");
        verify(sodRepository).save(c);
        verify(auditTrailService).logAs(eq(admin), eq("SOD_CONSTRAINT"), any(), eq(c.getId()),
                eq("UPDATED"), eq("Active"), eq("Inactive"), anyString(), anyList(), any());
    }

    @Test
    void update_systemConstraint_withoutActiveChange_isRejected() {
        manager();
        SodConstraint c = systemConstraint(true);
        when(sodRepository.findById(c.getId())).thenReturn(Optional.of(c));

        assertThrows(IllegalArgumentException.class, () -> service.update(c.getId(), new SodConstraintRequest(
                "Renamed", null, A, B, "BLOCK", null, true, "sig", null)));
        verify(sodRepository, never()).save(any());
        verifyNoInteractions(auditTrailService);
    }

    private UserAccount manager() {
        UserAccount admin = new UserAccount();
        admin.setId(UUID.randomUUID());
        when(currentUserService.requireCurrentUser()).thenReturn(admin);
        when(permissionEvaluationService.hasPermission(admin, "security.sod.manage")).thenReturn(true);
        return admin;
    }

    private static SodConstraint systemConstraint(boolean active) {
        SodConstraint c = new SodConstraint();
        org.springframework.test.util.ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        c.setName("Request vs Approve Uncontrolled Copy");
        c.setPermissionCodeA(A);
        c.setPermissionCodeB(B);
        c.setSeverity("BLOCK");
        c.setActive(active);
        c.setSystem(true);
        return c;
    }
}
