package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.notNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Backup alerts (SDS 15.1): permissions, acknowledgement with its audit, and the people who receive alerts. */
class BackupAlertControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String ALERT = "11111111-2222-3333-4444-555555555555";

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    UserAccountRepository accounts = mock(UserAccountRepository.class);
    UserAccount actor = mock(UserAccount.class);
    BackupAlertController controller;

    private BackupAgentClient.Reply reply(int code, String body) throws Exception {
        return new BackupAgentClient.Reply(code, JSON.readTree(body));
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

    @BeforeEach
    void setUp() {
        controller = new BackupAlertController(users, permissions, agent, audit, accounts);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("admin");
        allow("backup.admin.alerts.view", "backup.admin.alerts.manage");
    }

    @Test
    void viewingAndManagingNeedTheirOwnPermissions() {
        allow("backup.admin.alerts.view");
        assertThatThrownBy(() -> controller.acknowledge(ALERT, new BackupAlertController.AcknowledgeBody("seen"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.addRecipient(new BackupAlertController.RecipientBody("dco.test1"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.removeRecipient("dco.test1")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void anAlertIdIsValidatedBeforeAnythingIsSent() {
        assertThatThrownBy(() -> controller.acknowledge("../x", null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(agent);
    }

    @Test
    void anAcknowledgedAlertIsAuditedWithItsIdentifier() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/alerts/" + ALERT + "/acknowledge"), any())).thenReturn(reply(200, "{\"id\":\"" + ALERT + "\"}"));
        assertThat(controller.acknowledge(ALERT, new BackupAlertController.AcknowledgeBody("seen")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(audit).logAs(eq(actor), eq("BACKUP_ALERT"), eq(ALERT), notNull(), eq("ALERT_ACKNOWLEDGED"), eq("OPEN"), eq("ACKNOWLEDGED"), anyString());
    }

    @Test
    void aRefusedAcknowledgementIsNotAudited() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/alerts/" + ALERT + "/acknowledge"), any()))
                .thenReturn(reply(409, "{\"code\":\"ALERT_ALREADY_ACKNOWLEDGED\"}"));
        assertThat(controller.acknowledge(ALERT, null).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verifyNoInteractions(audit);
    }

    @Test
    void aRecipientMustBeAnActiveAccount() throws Exception {
        when(accounts.findByUsernameIgnoreCase("nobody")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> controller.addRecipient(new BackupAlertController.RecipientBody("nobody")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        UserAccount inactive = mock(UserAccount.class);
        when(inactive.getStatus()).thenReturn(UserStatus.Inactive);
        when(accounts.findByUsernameIgnoreCase("gone")).thenReturn(Optional.of(inactive));
        assertThatThrownBy(() -> controller.addRecipient(new BackupAlertController.RecipientBody("gone")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(agent, never()).exchange(eq(HttpMethod.POST), eq("/internal/alert-recipients"), any());
    }

    @Test
    void anAddedRecipientIsSentToTheAgentAndAudited() throws Exception {
        UserAccount dco = mock(UserAccount.class);
        when(dco.getStatus()).thenReturn(UserStatus.Active);
        when(dco.getUsername()).thenReturn("dco.test1");
        when(accounts.findByUsernameIgnoreCase("dco.test1")).thenReturn(Optional.of(dco));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/alert-recipients"), any())).thenReturn(reply(201, "{\"username\":\"dco.test1\"}"));

        controller.addRecipient(new BackupAlertController.RecipientBody("dco.test1"));
        verify(audit).logAs(eq(actor), eq("BACKUP_ALERT_RECIPIENT"), eq("dco.test1"), notNull(), eq("ALERT_RECIPIENT_ADDED"), isNull(), eq("ACTIVE"), anyString());
    }
}
