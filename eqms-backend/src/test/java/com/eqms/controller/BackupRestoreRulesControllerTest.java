package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** The restore rules (SDS 14.1): permissions, the electronic signature on a change, and the audit of the change. */
class BackupRestoreRulesControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String CODE = "REHEARSAL_MAX_AGE_DAYS";

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupRestoreRulesController controller;

    @BeforeEach
    void setUp() throws Exception {
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        controller = new BackupRestoreRulesController(users, permissions, agent, audit, signatures, new TransactionTemplate(manager));
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("qa.lead");
        allow("backup.admin.restore_controls.view", "backup.admin.restore_rules.manage");
    }

    private void allow(String... codes) {
        when(permissions.hasAnyPermission(any(UserAccount.class), any(String[].class))).thenAnswer(inv -> {
            Object[] args = inv.getArguments();
            for (int i = 1; i < args.length; i++) {
                if (args[i] instanceof String s && Arrays.asList(codes).contains(s)) return true;
                if (args[i] instanceof String[] arr && Arrays.stream(arr).anyMatch(Arrays.asList(codes)::contains)) return true;
            }
            return false;
        });
    }

    @Test
    void viewingAndChangingNeedTheirOwnPermissions() {
        allow("backup.admin.restore_controls.view");
        assertThatThrownBy(() -> controller.change(CODE, new BackupRestoreRulesController.ChangeBody(45, "why", "tok"))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent, signatures);
    }

    @Test
    void aChangeNeedsAReasonAValueAndAValidCode() {
        assertThatThrownBy(() -> controller.change(CODE, new BackupRestoreRulesController.ChangeBody(45, " ", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("RULE_REASON_REQUIRED"));
        assertThatThrownBy(() -> controller.change(CODE, new BackupRestoreRulesController.ChangeBody(null, "why", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("RULE_VALUE_REQUIRED"));
        assertThatThrownBy(() -> controller.change("../x", new BackupRestoreRulesController.ChangeBody(45, "why", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(agent, never()).exchange(any(), anyString(), any());
    }

    @Test
    void aChangeWithoutASignatureIsNotSent() {
        org.mockito.Mockito.doThrow(new IllegalStateException("signature required")).when(signatures).requireValidToken(actor, null);
        assertThatThrownBy(() -> controller.change(CODE, new BackupRestoreRulesController.ChangeBody(45, "why", null))).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void aSignedChangeCarriesTheSignatureRefAndIsAudited() throws Exception {
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-88");
        when(signatures.record(eq(actor), eq("tok"), eq("BACKUP_RESTORE_RULE_CHANGE"), eq("BACKUP_RESTORE_RULE"), any(), eq(CODE), anyString(), any(), any()))
                .thenReturn(signature);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restore-rules/" + CODE), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"code\":\"" + CODE + "\",\"value\":45,\"previous\":30}")));

        assertThat(controller.change(CODE, new BackupRestoreRulesController.ChangeBody(45, "Annual restore plan", "tok")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/restore-rules/" + CODE),
                eq(Map.of("value", 45, "by", "qa.lead", "reason", "Annual restore plan", "signatureRef", "ESIG-88")));
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE_RULE"), eq(CODE), any(), eq("RESTORE_RULE_CHANGED"), eq("30"), eq("45"), anyString());
    }
    @Test
    void aVerificationViewerSeesOnlyTheDrillInterval() throws Exception {
        allow("backup.admin.verification.view");
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/restore-rules"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("[{\"code\":\"REHEARSAL_MAX_AGE_DAYS\",\"value\":30},{\"code\":\"RESTORE_DRILL_INTERVAL_DAYS\",\"value\":365}]")));
        JsonNode body = controller.list().getBody();
        assertThat(body.size()).isEqualTo(1);
        assertThat(body.get(0).path("code").asText()).isEqualTo("RESTORE_DRILL_INTERVAL_DAYS");
    }

    @Test
    void aPersonWithoutAnyRuleViewIsRefused() {
        allow("backup.admin.retention.view");
        assertThatThrownBy(() -> controller.list()).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }
}
