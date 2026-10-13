package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.BackupPolicyService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BackupPolicyControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    TransactionTemplate tx = mock(TransactionTemplate.class);
    UserAccount actor = mock(UserAccount.class);
    SimpleTransactionStatus status = new SimpleTransactionStatus();
    BackupPolicyController controller;

    private static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
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
    @SuppressWarnings("unchecked")
    void setUp() {
        BackupPolicyService service = new BackupPolicyService(agent, signatures, audit, tx);
        controller = new BackupPolicyController(users, permissions, agent, service);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("bob");
        allow("backup.admin.policy.view", "backup.admin.policy.propose", "backup.admin.policy.approve");
        when(tx.execute(any())).thenAnswer(inv -> ((TransactionCallback<Object>) inv.getArgument(0)).doInTransaction(status));
    }

    private BackupAgentClient.Reply reply(int code, String body) {
        return new BackupAgentClient.Reply(code, json(body));
    }

    @Test
    void readingNeedsTheViewPermission() {
        allow();
        assertThatThrownBy(() -> controller.list(null, null, "version", "desc", 1, 10)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.get(2)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.gate(2)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.targets()).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void theVersionListIsPassedOnWithBoundedAndEncodedParameters() {
        when(agent.exchange(eq(HttpMethod.GET), anyString(), isNull())).thenReturn(reply(200, "{\"data\":[]}"));
        controller.list("a&b c", "DRAFT", "status", "asc", 0, 5000);
        ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
        verify(agent).exchange(eq(HttpMethod.GET), path.capture(), isNull());
        assertThat(path.getValue()).startsWith("/internal/policies?").contains("search=a%26b%20c").contains("status=DRAFT").contains("sortDirection=asc")
                .contains("page=1").contains("limit=100");
    }

    @Test
    void theTargetsListIsAlsoOpenToWhoCanSeeStorageAndEncryption() {
        allow("backup.admin.storage.view");
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/targets"), isNull())).thenReturn(reply(200, "[]"));
        assertThat(controller.targets().getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void proposingNeedsItsOwnPermissionAndAReason() {
        allow("backup.admin.policy.view");
        assertThatThrownBy(() -> controller.propose(new BackupPolicyController.ProposeRequest(null, null, null, null, "why"))).isInstanceOf(AccessDeniedException.class);
        allow("backup.admin.policy.view", "backup.admin.policy.propose");
        assertThatThrownBy(() -> controller.propose(new BackupPolicyController.ProposeRequest(null, null, null, null, "  ")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("POLICY_REASON_REQUIRED"));
        assertThatThrownBy(() -> controller.propose(new BackupPolicyController.ProposeRequest(null, null, null, null, "x".repeat(501)))).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(agent);
    }

    @Test
    @SuppressWarnings("unchecked")
    void aProposalIsSentWithTheProposersUsernameAndAudited() {
        UUID id = UUID.randomUUID();
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/policies"), any())).thenReturn(reply(201, "{\"id\":\"" + id + "\",\"version\":3}"));
        ResponseEntity<JsonNode> response = controller.propose(new BackupPolicyController.ProposeRequest(json("{\"components\":[\"DATABASE\"]}"), null, null, json("{\"targets\":[]}"), "Add T3"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/policies"), body.capture());
        assertThat(body.getValue()).containsEntry("proposedBy", "bob").containsEntry("reason", "Add T3");
        verify(audit).logAs(eq(actor), eq("BACKUP_POLICY"), eq("Backup policy v3"), eq(id), eq("BACKUP_POLICY_PROPOSED"), any(), eq("DRAFT"), anyString());
    }

    @Test
    void aProposalTheAgentRejectsKeepsItsStatusAndReasonAndIsNotAudited() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/policies"), any())).thenReturn(reply(400, "{\"code\":\"POLICY_RETENTION\",\"message\":\"no\"}"));
        ResponseEntity<JsonNode> response = controller.propose(new BackupPolicyController.ProposeRequest(null, null, null, null, "why"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().path("code").asText()).isEqualTo("POLICY_RETENTION");
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }

    @Test
    void activatingNeedsTheApprovePermissionAndNothingReachesTheAgentWithoutIt() {
        allow("backup.admin.policy.view", "backup.admin.policy.propose");
        assertThatThrownBy(() -> controller.activate(2, new BackupPolicyController.ActivateRequest("tok"))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
        verifyNoInteractions(signatures);
    }

    @Test
    void anInvalidSignatureStopsTheActivationBeforeTheAgentIsAsked() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("Electronic signature is required")).when(signatures).requireValidToken(actor, null);
        assertThatThrownBy(() -> controller.activate(2, new BackupPolicyController.ActivateRequest(null))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void activationSignsFirstThenAsksTheAgentWithTheSignatureReferenceAndAuditsWithTheSignature() {
        UUID id = UUID.randomUUID();
        UUID signatureUuid = UUID.randomUUID();
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("SIG-000123");
        when(signature.getId()).thenReturn(signatureUuid);
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/policies/2"), isNull()))
                .thenReturn(reply(200, "{\"id\":\"" + id + "\",\"reason\":\"Add T3\",\"sha256\":\"abc\"}"));
        when(signatures.record(eq(actor), eq("tok"), eq("BACKUP_POLICY_CHANGE"), eq("BACKUP_POLICY"), eq(id), anyString(), eq("Add T3"), any(), eq("abc"))).thenReturn(signature);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/policies/2/activate"), any())).thenReturn(reply(200, "{\"status\":\"ACTIVE\"}"));

        ResponseEntity<JsonNode> response = controller.activate(2, new BackupPolicyController.ActivateRequest("tok"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var order = inOrder(signatures, agent, audit);
        order.verify(signatures).requireValidToken(actor, "tok");
        order.verify(signatures).record(eq(actor), eq("tok"), eq("BACKUP_POLICY_CHANGE"), eq("BACKUP_POLICY"), eq(id), anyString(), anyString(), any(), any());
        order.verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/policies/2/activate"), eq(Map.of("approvedBy", "bob", "signatureRef", "SIG-000123")));
        order.verify(audit).logAs(eq(actor), eq("BACKUP_POLICY"), eq("Backup policy v2"), eq(id), eq("BACKUP_POLICY_ACTIVATED"), eq("DRAFT"), eq("ACTIVE"), anyString(), isNull(), eq(signatureUuid));
        assertThat(status.isRollbackOnly()).isFalse();
    }

    @Test
    void whenTheAgentRefusesTheSignatureIsRolledBackAndTheRefusalIsStillAudited() {
        UUID id = UUID.randomUUID();
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("SIG-000124");
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/policies/2"), isNull())).thenReturn(reply(200, "{\"id\":\"" + id + "\",\"reason\":\"r\"}"));
        when(signatures.record(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/policies/2/activate"), any()))
                .thenReturn(reply(422, "{\"code\":\"POLICY_GATE_FAILED\",\"detail\":{\"passed\":false}}"));

        ResponseEntity<JsonNode> response = controller.activate(2, new BackupPolicyController.ActivateRequest("tok"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody().path("code").asText()).isEqualTo("POLICY_GATE_FAILED");
        assertThat(status.isRollbackOnly()).as("the signature must not outlive a refused activation").isTrue();
        verify(audit).logAs(eq(actor), eq("BACKUP_POLICY"), eq("Backup policy v2"), eq(id), eq("BACKUP_POLICY_ACTIVATION_REFUSED"), eq("DRAFT"), eq("DRAFT"), org.mockito.ArgumentMatchers.contains("POLICY_GATE_FAILED"));
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), eq("BACKUP_POLICY_ACTIVATED"), any(), any(), anyString(), any(), any());
    }

    @Test
    void anUnknownPolicyIsReportedWithoutSigningAnything() {
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/policies/9"), isNull())).thenReturn(reply(404, "{\"code\":\"POLICY_NOT_FOUND\"}"));
        ResponseEntity<JsonNode> response = controller.activate(9, new BackupPolicyController.ActivateRequest("tok"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        verify(signatures, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aVersionBelowOneNeverReachesTheAgent() {
        assertThatThrownBy(() -> controller.get(0)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.gate(-1)).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void discardingNeedsTheProposePermissionAndAReasonAndIsAudited() {
        UUID id = UUID.randomUUID();
        allow("backup.admin.policy.view", "backup.admin.policy.approve");
        assertThatThrownBy(() -> controller.discard(2, new BackupPolicyController.DiscardRequest("no"))).isInstanceOf(AccessDeniedException.class);
        allow("backup.admin.policy.view", "backup.admin.policy.propose");
        assertThatThrownBy(() -> controller.discard(2, new BackupPolicyController.DiscardRequest(""))).isInstanceOf(ResponseStatusException.class);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/policies/2/discard"), any())).thenReturn(reply(200, "{\"id\":\"" + id + "\",\"status\":\"DISCARDED\"}"));
        assertThat(controller.discard(2, new BackupPolicyController.DiscardRequest("Wrong list")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(audit).logAs(eq(actor), eq("BACKUP_POLICY"), eq("Backup policy v2"), eq(id), eq("BACKUP_POLICY_DISCARDED"), eq("DRAFT"), eq("DISCARDED"), anyString());
    }

    @Test
    void theEncryptionFactsNeedTheStorageViewPermission() {
        allow("backup.admin.policy.view");
        assertThatThrownBy(() -> controller.encryption()).isInstanceOf(AccessDeniedException.class);
        allow("backup.admin.storage.view");
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/encryption"), isNull())).thenReturn(reply(200, "{\"scheme\":\"OpenPGP\"}"));
        assertThat(controller.encryption().getBody().path("scheme").asText()).isEqualTo("OpenPGP");
    }

    @Test
    void testingATargetNeedsItsOwnPermissionAGoodCodeAndIsAudited() {
        allow("backup.admin.storage.view");
        assertThatThrownBy(() -> controller.testTarget("T3")).isInstanceOf(AccessDeniedException.class);
        allow("backup.admin.storage.view", "backup.admin.storage.test");
        assertThatThrownBy(() -> controller.testTarget("../x")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(agent);
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/targets/T3/test"), any())).thenReturn(reply(200, "{\"ok\":false}"));
        assertThat(controller.testTarget("T3").getStatusCode()).isEqualTo(HttpStatus.OK);
        // the audit row needs a non-null id; a target has a stable one derived from its code (a null id made the audit write fail)
        verify(audit).logAs(eq(actor), eq("BACKUP_TARGET"), eq("T3"), eq(com.eqms.service.BackupPolicyService.targetAuditId("T3")), eq("BACKUP_TARGET_TESTED"), isNull(), eq("FAILED"), anyString());
    }

    @Test
    void aTargetTheAgentDoesNotKnowIsNotAudited() {
        allow("backup.admin.storage.test");
        when(agent.exchange(eq(HttpMethod.POST), anyString(), any())).thenReturn(reply(404, "{\"error\":\"Unknown target T9\"}"));
        assertThat(controller.testTarget("T9").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }
}
