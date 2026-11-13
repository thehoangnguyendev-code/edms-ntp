package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.notNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** The Disaster Recovery Plan (SDS 15.2): signed target and authority changes, verification of kit items, and their audit. */
class BackupDrPlanControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    UserAccountRepository accounts = mock(UserAccountRepository.class);
    UserAccount actor = mock(UserAccount.class);
    BackupDrPlanController controller;

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
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        controller = new BackupDrPlanController(users, permissions, agent, audit, signatures, new TransactionTemplate(manager), accounts);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("admin");
        allow("backup.admin.disaster_recovery.view", "backup.admin.disaster_recovery.manage");
    }

    @Test
    void theTargetsAreChangedOnlyWithASignature() throws Exception {
        doThrow(new IllegalStateException("signature required")).when(signatures).requireValidToken(actor, null);
        assertThatThrownBy(() -> controller.changeTargets("SERVER_LOSS", new BackupDrPlanController.TargetBody(12, 12, "tighter", null)))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void aSignedTargetChangeIsSentWithItsSignatureRefAndAudited() throws Exception {
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-41");
        when(signatures.record(eq(actor), eq("tok"), eq("BACKUP_DR_TARGET_CHANGE"), eq("BACKUP_DR_SCENARIO"), any(), eq("SERVER_LOSS"), anyString(), isNull(), isNull()))
                .thenReturn(signature);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/dr/scenarios/SERVER_LOSS/targets"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"code\":\"SERVER_LOSS\",\"status\":\"APPROVED\"}")));

        controller.changeTargets("SERVER_LOSS", new BackupDrPlanController.TargetBody(12, 12, "tighter", "tok"));
        verify(audit).logAs(eq(actor), eq("BACKUP_DR_SCENARIO"), eq("SERVER_LOSS"), any(), eq("DR_TARGET_CHANGED"), isNull(), eq("APPROVED"), anyString());
    }

    @Test
    void theDeclarationAuthorityMustBeAnActiveAccount() {
        when(accounts.findByUsernameIgnoreCase("ghost")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> controller.changeAuthority(new BackupDrPlanController.AuthorityBody("ghost", "why", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        UserAccount inactive = mock(UserAccount.class);
        when(inactive.getStatus()).thenReturn(UserStatus.Inactive);
        when(accounts.findByUsernameIgnoreCase("gone")).thenReturn(Optional.of(inactive));
        assertThatThrownBy(() -> controller.changeAuthority(new BackupDrPlanController.AuthorityBody("gone", "why", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verifyNoInteractions(agent);
    }

    @Test
    void aKitItemVerificationNeedsADateAndIsAuditedWithoutASignature() throws Exception {
        assertThatThrownBy(() -> controller.verify("BACKUP_KEY", new BackupDrPlanController.VerifyBody(" ", null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("VERIFIED_AT_REQUIRED"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/dr/kit/BACKUP_KEY/verify"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"code\":\"BACKUP_KEY\"}")));
        controller.verify("BACKUP_KEY", new BackupDrPlanController.VerifyBody("2026-10-10T08:00:00Z", "checked with two people"));
        verify(audit).logAs(eq(actor), eq("BACKUP_DR_KIT"), eq("BACKUP_KEY"), notNull(), eq("DR_KIT_VERIFIED"), eq("NOT_VERIFIED"), eq("VERIFIED"), anyString());
        verifyNoInteractions(signatures);
    }

    @Test
    void onlyTheDeclarationAuthorityMayDeclareADisasterAndNothingIsSentOrSignedOtherwise() throws Exception {
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/dr/authority"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"key\":\"DECLARATION_AUTHORITY\",\"value\":\"qa.lead\"}")));
        assertThatThrownBy(() -> controller.declare(new BackupDrPlanController.DeclareBody("SITE_LOSS", "fire", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(e.getReason()).isEqualTo("DR_NOT_THE_DECLARATION_AUTHORITY");
                });
        verifyNoInteractions(signatures);
        verify(agent, org.mockito.Mockito.never()).exchange(eq(HttpMethod.POST), anyString(), any());
    }

    @Test
    void theAuthorityDeclaresWithASignatureAndItIsAudited() throws Exception {
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/dr/authority"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"key\":\"DECLARATION_AUTHORITY\",\"value\":\"ADMIN\"}")));
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-77");
        when(signatures.record(eq(actor), eq("tok"), eq("BACKUP_DR_DECLARE"), eq("BACKUP_DR_DECLARATION"), any(), eq("SITE_LOSS"), anyString(), isNull(), isNull())).thenReturn(signature);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/dr/declarations"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"code\":\"DR-2026-0001\",\"status\":\"OPEN\"}")));
        controller.declare(new BackupDrPlanController.DeclareBody("SITE_LOSS", "The building burned", "tok"));
        verify(audit).logAs(eq(actor), eq("BACKUP_DR_DECLARATION"), eq("DR-2026-0001"), any(), eq("DR_DECLARED"), isNull(), eq("OPEN"), anyString());
    }

    @Test
    void aDeclarationNeedsAReasonAndAValidScenarioBeforeAnythingIsAsked() {
        assertThatThrownBy(() -> controller.declare(new BackupDrPlanController.DeclareBody("SITE_LOSS", " ", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("DR_REASON_REQUIRED"));
        assertThatThrownBy(() -> controller.declare(new BackupDrPlanController.DeclareBody("site loss; drop", "fire", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(agent);
    }

    @Test
    void closingNeedsASummaryAndASignatureAndTheCodeIsChecked() throws Exception {
        assertThatThrownBy(() -> controller.close("not-a-code", new BackupDrPlanController.CloseBody("done", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> controller.close("DR-2026-0001", new BackupDrPlanController.CloseBody(" ", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("DR_SUMMARY_REQUIRED"));
        doThrow(new IllegalStateException("signature required")).when(signatures).requireValidToken(actor, null);
        assertThatThrownBy(() -> controller.close("DR-2026-0001", new BackupDrPlanController.CloseBody("done", null))).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(agent);

        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-78");
        when(signatures.record(eq(actor), eq("tok"), eq("BACKUP_DR_CLOSE"), eq("BACKUP_DR_DECLARATION"), any(), eq("DR-2026-0001"), anyString(), isNull(), isNull())).thenReturn(signature);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/dr/declarations/DR-2026-0001/close"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"code\":\"DR-2026-0001\",\"status\":\"CLOSED\"}")));
        controller.close("DR-2026-0001", new BackupDrPlanController.CloseBody("Rebuilt on the spare server", "tok"));
        verify(audit).logAs(eq(actor), eq("BACKUP_DR_DECLARATION"), eq("DR-2026-0001"), any(), eq("DR_DECLARATION_CLOSED"), eq("OPEN"), eq("CLOSED"), anyString());
    }

    @Test
    void viewingNeedsOnlyTheViewPermission() {
        allow("backup.admin.disaster_recovery.view");
        assertThatThrownBy(() -> controller.verify("BACKUP_KEY", new BackupDrPlanController.VerifyBody("2026-10-10T08:00:00Z", null)))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }
}
