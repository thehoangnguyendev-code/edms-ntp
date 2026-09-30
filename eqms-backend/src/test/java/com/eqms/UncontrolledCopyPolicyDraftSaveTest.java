package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyPolicyRequest;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyRuleChange;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UncontrolledCopyPolicySetting;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UncontrolledCopyPolicySettingRepository;
import com.eqms.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class UncontrolledCopyPolicyDraftSaveTest {
    @Mock UncontrolledCopyPolicySettingRepository repository;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock CurrentUserService currentUserService;
    @Mock SecurityChangeSignatureService securityChangeSignatureService;
    @Mock AuditTrailService auditTrailService;
    @Mock ControlledCopyPolicyService controlledCopyPolicyService;
    @Mock UncontrolledCopyRuleDraftService ruleDraftService;
    @InjectMocks UncontrolledCopyPolicyService service;

    private final UserAccount actor = new UserAccount();
    private final List<UncontrolledCopyRuleChange> rules = List.of(new UncontrolledCopyRuleChange(null, null, false, null, true, true));
    private UncontrolledCopyPolicyRequest request() {
        return new UncontrolledCopyPolicyRequest(true, 48, true, null, "token", "reason", rules);
    }
    private void allow() {
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        when(permissionEvaluationService.hasAnyPermission(actor, "documents.admin.uncontrolled_copies_policy.manage", "settings.configuration.manage")).thenReturn(true);
    }

    @Test void oneSignatureAndAuditContainPolicyAndRuleChanges() {
        allow();
        when(repository.findById(UncontrolledCopyPolicySetting.DEFAULT_ID)).thenReturn(Optional.of(new UncontrolledCopyPolicySetting()));
        when(ruleDraftService.apply(rules, actor)).thenReturn(List.of(new AuditTrailChangeResponse("Rule Created", null, "Any; allowed=true; active=true")));
        var signature = new ElectronicSignature();
        signature.setId(UUID.randomUUID());
        when(securityChangeSignatureService.record(eq(actor), eq("token"), anyString(), anyString(), any(), anyString(), eq("reason"), isNull(), isNull())).thenReturn(signature);
        service.savePolicy(request());
        var order = inOrder(securityChangeSignatureService, ruleDraftService, auditTrailService);
        order.verify(securityChangeSignatureService).requireValidToken(actor, "token");
        order.verify(ruleDraftService).apply(rules, actor);
        order.verify(securityChangeSignatureService).record(eq(actor), eq("token"), anyString(), anyString(), any(), anyString(), eq("reason"), isNull(), isNull());
        order.verify(auditTrailService).logAs(eq(actor), eq("UNCONTROLLED_COPY_POLICY"), anyString(), any(), eq("UPDATED"),
                isNull(), isNull(), anyString(), argThat(changes -> changes.stream().anyMatch(c -> c.field().equals("Rule Created"))
                        && changes.stream().anyMatch(c -> c.field().equals("validityHours"))), eq(signature.getId()));
    }

    @Test void batchFailureNeverRecordsSuccessSignatureOrAudit() {
        allow();
        when(repository.findById(UncontrolledCopyPolicySetting.DEFAULT_ID)).thenReturn(Optional.of(new UncontrolledCopyPolicySetting()));
        when(ruleDraftService.apply(rules, actor)).thenThrow(new IllegalArgumentException("duplicate"));
        assertThrows(IllegalArgumentException.class, () -> service.savePolicy(request()));
        verify(securityChangeSignatureService, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(auditTrailService);
    }

    @Test void missingPermissionPreventsBothPolicyAndRuleWrites() {
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        assertThrows(AccessDeniedException.class, () -> service.savePolicy(request()));
        verifyNoInteractions(repository, ruleDraftService, securityChangeSignatureService, auditTrailService);
    }

    @Test void invalidSignaturePreventsBothPolicyAndRuleWrites() {
        allow();
        doThrow(new AccessDeniedException("invalid signature")).when(securityChangeSignatureService).requireValidToken(actor, "token");
        assertThrows(AccessDeniedException.class, () -> service.savePolicy(request()));
        verifyNoInteractions(repository, ruleDraftService, auditTrailService);
    }
}
