package com.eqms.dto.knowledge;

import com.eqms.dto.security.EffectiveAccessDiagnosisLayer;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** What the administrator sees of the Knowledge Base shares the Department Heads made. */
public final class KnowledgeShareOversightDtos {
    private KnowledgeShareOversightDtos() {
    }

    /** One share: a rule owned by a Department. */
    public record ShareRow(UUID ruleId, UUID departmentId, String departmentName, String scopeKind, String scopeLabel, String effect,
                           List<String> grantees, String createdBy, Instant createdAt, boolean active) {
    }

    /** One link, for the administrator: owner (Department or Business Unit), what it points to, status, who made it and how often it was opened. */
    public record LinkAdminRow(UUID id, String ownerName, String scopeKind, String scopeLabel, String label, String status, String createdBy,
                               String createdByLevel, Instant createdAt, Instant expiresAt, Instant revokedAt, String revokedBy, long opens) {
    }

    public record DocumentRef(UUID id, String documentNumber, String documentName, String department) {
    }

    /** Why a user can or cannot see a document in the Knowledge Base, layer by layer. */
    public record Explanation(UUID userId, String userName, UUID documentId, String documentLabel, boolean canSee, String summary,
                              List<EffectiveAccessDiagnosisLayer> layers, ShareRow decidingShare) {
    }
}
