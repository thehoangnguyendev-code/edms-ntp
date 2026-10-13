package com.eqms.service;

import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Backup policy changes (SDS-BR-001 sections 6.1 and 24). The eQMS side checks who the person is and verifies the electronic
 * signature; the Backup Agent enforces the two-person rule, the 3-2-1-1 rule and the target tests. A signature is recorded only
 * together with a successful activation: if the agent refuses, the signature is rolled back with everything else.
 */
@Service
public class BackupPolicyService {

    public static final String MEANING_BACKUP_POLICY_CHANGE = "BACKUP_POLICY_CHANGE";

    private final BackupAgentClient agent;
    private final SecurityChangeSignatureService signatures;
    private final AuditTrailService auditTrailService;
    private final TransactionTemplate tx;

    public BackupPolicyService(BackupAgentClient agent, SecurityChangeSignatureService signatures, AuditTrailService auditTrailService, TransactionTemplate tx) {
        this.tx = tx;
        this.agent = agent;
        this.signatures = signatures;
        this.auditTrailService = auditTrailService;
    }

    public BackupAgentClient.Reply propose(UserAccount actor, Map<String, Object> proposal, String reason) {
        Map<String, Object> body = new LinkedHashMap<>(proposal);
        body.put("reason", reason);
        body.put("proposedBy", actor.getUsername());
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/policies", body);
        if (reply.ok()) {
            auditTrailService.logAs(actor, "BACKUP_POLICY", "Backup policy v" + reply.body().path("version").asInt(), uuid(reply.body().path("id").asText()),
                    "BACKUP_POLICY_PROPOSED", null, "DRAFT", "Proposed a backup policy change. Reason: " + reason);
        }
        return reply;
    }

    /** A target has no database id; its audit row carries a stable id derived from its code, because the audit table needs one. */
    public static UUID targetAuditId(String code) {
        return UUID.nameUUIDFromBytes(("backup-target:" + code).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public void recordTargetTest(UserAccount actor, String code, boolean ok) {
        auditTrailService.logAs(actor, "BACKUP_TARGET", code, targetAuditId(code), "BACKUP_TARGET_TESTED", null, ok ? "OK" : "FAILED",
                "Tested backup target " + code + ": " + (ok ? "it accepted, returned and (if immutable) refused to delete a test file" : "the test failed"));
    }

    public BackupAgentClient.Reply discard(UserAccount actor, int version, String reason) {
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/policies/" + version + "/discard",
                Map.of("discardedBy", actor.getUsername(), "reason", reason));
        if (reply.ok()) {
            auditTrailService.logAs(actor, "BACKUP_POLICY", "Backup policy v" + version, uuid(reply.body().path("id").asText()),
                    "BACKUP_POLICY_DISCARDED", "DRAFT", "DISCARDED", "Discarded a draft backup policy. Reason: " + reason);
        }
        return reply;
    }

    /**
     * The signature token is checked before anything is sent. The signature is then recorded and its identifier handed to the agent
     * as the reference of the approval; if the agent refuses, the transaction rolls back so no signature exists for an action that
     * did not happen. The refusal itself is audited afterwards, outside that transaction, so the record of the attempt survives.
     */
    public BackupAgentClient.Reply activate(UserAccount actor, int version, String signatureToken) {
        signatures.requireValidToken(actor, signatureToken);
        UUID[] policyId = new UUID[1];
        BackupAgentClient.Reply reply = tx.execute(status -> {
            BackupAgentClient.Reply current = agent.exchange(HttpMethod.GET, "/internal/policies/" + version, null);
            if (!current.ok()) return current;
            JsonNode policy = current.body();
            policyId[0] = uuid(policy.path("id").asText());
            ElectronicSignature signature = signatures.record(actor, signatureToken, MEANING_BACKUP_POLICY_CHANGE, "BACKUP_POLICY", policyId[0],
                    "Backup policy v" + version, policy.path("reason").asText(""), null, policy.path("sha256").asText(null));
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            BackupAgentClient.Reply activated = agent.exchange(HttpMethod.POST, "/internal/policies/" + version + "/activate",
                    Map.of("approvedBy", actor.getUsername(), "signatureRef", ref));
            if (!activated.ok()) {
                status.setRollbackOnly();
                return activated;
            }
            auditTrailService.logAs(actor, "BACKUP_POLICY", "Backup policy v" + version, policyId[0], "BACKUP_POLICY_ACTIVATED", "DRAFT", "ACTIVE",
                    "Activated backup policy v" + version + ". Signature " + ref, null, signature == null ? null : signature.getId());
            return activated;
        });
        if (reply != null && !reply.ok() && policyId[0] != null) {
            auditTrailService.logAs(actor, "BACKUP_POLICY", "Backup policy v" + version, policyId[0], "BACKUP_POLICY_ACTIVATION_REFUSED", "DRAFT", "DRAFT",
                    "Activation refused: " + reply.body().path("code").asText("UNKNOWN"));
        }
        return reply;
    }

    private static UUID uuid(String text) {
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
