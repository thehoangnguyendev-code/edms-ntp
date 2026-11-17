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
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
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

    @org.junit.jupiter.api.Test
    void aRuleChangeNeedsTheManagePermissionAReasonAndAValidCodeAndIsAudited() throws Exception {
        allow("backup.admin.alerts.view");
        assertThatThrownBy(() -> controller.changeRule("CAPACITY_HIGH", new BackupAlertController.RuleBody(true, true, 90, "why")))
                .isInstanceOf(AccessDeniedException.class);
        allow("backup.admin.alerts.view", "backup.admin.alerts.manage");
        assertThatThrownBy(() -> controller.changeRule("capacity high; drop", new BackupAlertController.RuleBody(true, true, 90, "why")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> controller.changeRule("CAPACITY_HIGH", new BackupAlertController.RuleBody(true, true, 90, "  ")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("ALERT_RULE_REASON_REQUIRED"));
        verifyNoInteractions(agent);

        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/alert-rules/CAPACITY_HIGH"), any()))
                .thenReturn(reply(200, "{\"code\":\"CAPACITY_HIGH\",\"previous\":{\"inApp\":true,\"email\":true,\"threshold\":80}}"));
        controller.changeRule("CAPACITY_HIGH", new BackupAlertController.RuleBody(true, false, 90, "The NAS is large"));
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), eq("BACKUP_ALERT_RULE"), eq("Capacity High"), any(), eq("ALERT_RULE_CHANGED"), isNull(), eq("CHANGED"), text.capture(), any());
        assertThat(text.getValue()).contains("e-mail off").contains("limit 90").contains("was: in the application on, e-mail on, limit 80").contains("The NAS is large");
    }

    @org.junit.jupiter.api.Test
    void aRuleIsNotAuditedWhenTheAgentRefusesIt() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/alert-rules/CAPACITY_HIGH"), any())).thenReturn(reply(400, "{\"code\":\"ALERT_RULE_THRESHOLD_RANGE\"}"));
        var out = controller.changeRule("CAPACITY_HIGH", new BackupAlertController.RuleBody(true, true, 100, "too high"));
        assertThat(out.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString(), any());
    }

    @org.junit.jupiter.api.Test
    void theRulesAreSeenWithTheViewPermission() throws Exception {
        when(agent.exchange(eq(HttpMethod.GET), anyString(), any())).thenReturn(reply(200, "[]"));
        controller.rules();
        verify(agent).exchange(HttpMethod.GET, "/internal/alert-rules", null);
    }

    /** AUDIT-OBJECT-REGISTRY-2026-11-17: every alert of the list carries its Backup Alert Number, the older alert numbered first, and a search by a number asks the agent for that alert. */
    @Test
    void theListCarriesTheNumberOfEveryAlertAndASearchByNumberFindsTheAlert() throws Exception {
        com.eqms.service.ObjectNumberService numbers = mock(com.eqms.service.ObjectNumberService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "numbers", numbers);
        when(numbers.backupAlertNumber(eq("A-OLD"), org.mockito.ArgumentMatchers.anyInt())).thenReturn("BAL-2026-00001");
        when(numbers.backupAlertNumber(eq("A-NEW"), org.mockito.ArgumentMatchers.anyInt())).thenReturn("BAL-2026-00002");
        when(agent.exchange(eq(HttpMethod.GET), anyString(), isNull())).thenReturn(reply(200,
                "{\"data\":[{\"id\":\"A-NEW\",\"at\":\"2026-11-17T02:00:00Z\"},{\"id\":\"A-OLD\",\"at\":\"2026-11-16T22:00:00Z\"}],\"pagination\":{\"total\":2}}"));
        var body = controller.list(null, null, null, 1, 10, null, null, "at", "desc").getBody();
        assertThat(body.path("data").get(0).path("alertNumber").asText()).isEqualTo("BAL-2026-00002");
        assertThat(body.path("data").get(1).path("alertNumber").asText()).isEqualTo("BAL-2026-00001");
        org.mockito.InOrder order = org.mockito.Mockito.inOrder(numbers);
        order.verify(numbers).backupAlertNumber(eq("A-OLD"), org.mockito.ArgumentMatchers.anyInt());
        order.verify(numbers).backupAlertNumber(eq("A-NEW"), org.mockito.ArgumentMatchers.anyInt());

        when(numbers.backupAlertIdsByNumber("BAL-2026-00001")).thenReturn(java.util.List.of("A-OLD"));
        controller.list(null, null, "BAL-2026-00001", 1, 10, null, null, "at", "desc");
        ArgumentCaptor<String> uri = ArgumentCaptor.forClass(String.class);
        verify(agent, org.mockito.Mockito.atLeast(2)).exchange(eq(HttpMethod.GET), uri.capture(), isNull());
        String last = uri.getAllValues().get(uri.getAllValues().size() - 1);
        assertThat(last).contains("ids=A-OLD").doesNotContain("search=");
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
    void anAcknowledgedAlertIsAuditedByNameAndKeepsItsIdentifierInItsOwnColumn() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/alerts/" + ALERT + "/acknowledge"), any())).thenReturn(reply(200, "{\"id\":\"" + ALERT + "\"}"));
        assertThat(controller.acknowledge(ALERT, new BackupAlertController.AcknowledgeBody("seen")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(audit).logAs(eq(actor), eq("BACKUP_ALERT"), eq("Backup alert"), notNull(), eq("ALERT_ACKNOWLEDGED"), eq("OPEN"), eq("ACKNOWLEDGED"), argThat(text -> !text.contains(ALERT)), any());
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
        verify(audit).logAs(eq(actor), eq("BACKUP_ALERT_RECIPIENT"), eq("dco.test1"), notNull(), eq("ALERT_RECIPIENT_ADDED"), isNull(), eq("ACTIVE"), anyString(), any());
    }
}
