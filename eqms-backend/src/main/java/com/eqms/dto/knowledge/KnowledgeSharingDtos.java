package com.eqms.dto.knowledge;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Request and response shapes of the sharing of the Knowledge Base by the Heads and the people they name. */
public final class KnowledgeSharingDtos {
    private KnowledgeSharingDtos() {
    }

    /** BUSINESS_UNIT: the folder of a whole Unit. DEPARTMENT: the Department folder. DOCUMENT_TYPE: a Document Type folder inside a Department. DOCUMENT: one document. */
    public static final String KIND_BUSINESS_UNIT = "BUSINESS_UNIT";
    public static final String KIND_DEPARTMENT = "DEPARTMENT";
    public static final String KIND_DOCUMENT_TYPE = "DOCUMENT_TYPE";
    public static final String KIND_DOCUMENT = "DOCUMENT";

    /**
     * The thing that is shared, as the server worked it out from a folder of the explorer. {@code level} is what the current user is for it:
     * ADMIN, UNIT_HEAD, DEPARTMENT_HEAD or DELEGATE. A delegate cannot exclude and cannot name other delegates.
     */
    public record Node(boolean shareable, String reason, String kind, UUID businessUnitId, String businessUnitName, UUID departmentId,
                       String departmentName, UUID documentTypeId, UUID documentId, String label, boolean canManage, String level,
                       boolean canExclude, boolean canManageDelegates) {
    }

    /** A person or group a share is for; {@code canShare} marks a user who may share on behalf of the Head (a delegate of that Department or Unit). */
    public record GranteeChip(String label, boolean canShare) {
    }

    public record AccessEntry(UUID ruleId, String effect, String scopeKind, String scopeLabel, boolean inherited, boolean removable,
                              List<String> grantees, List<GranteeChip> chips, String createdBy, String createdByLevel, String createdAt,
                              boolean createdByMe) {
    }

    public record NodeAccess(Node node, List<AccessEntry> entries) {
    }

    public record GranteeUser(UUID id, String fullName, String employeeCode, String department) {
    }

    /** One page of a list that is loaded as it is scrolled: what was asked for and how many there are in all. */
    public record Paged<T>(List<T> items, long total) {
    }

    /**
     * One person or group a share reaches, as a row of the "Who has access" list. {@code granteeType} is USER, POSITION, DEPARTMENT, WHOLE
     * (everyone of the owner's Department or Unit) or EVERYONE; with {@code ruleId} it names what is taken away when the row is removed.
     */
    public record PersonRow(UUID ruleId, String effect, String granteeType, UUID granteeId, String label, String detail, boolean canShare,
                            boolean inherited, boolean removable, String scopeLabel, String createdBy, String createdByLevel, String createdAt,
                            boolean createdByMe) {
    }

    public record Option(String value, String label) {
    }

    public record Options(List<Option> positions, List<Option> departments) {
    }

    /** The Departments and Business Units the current user may share (empty for most users). */
    public record Managed(List<UUID> departmentIds, List<UUID> businessUnitIds) {
    }

    public record GrantRequest(
            @NotBlank @Size(max = 20) String kind,
            UUID businessUnitId,
            UUID departmentId,
            UUID documentTypeId,
            UUID documentId,
            /** ALLOW (share) or DENY (exclude: Heads only). */
            @NotBlank @Size(max = 10) String effect,
            List<UUID> userIds,
            List<UUID> positionIds,
            List<UUID> departmentIds,
            /** Everyone of the Department that owns the item (of the Unit, for the folder of a Unit). */
            boolean wholeDepartment,
            /** Everyone who may open the Knowledge Base. */
            boolean everyone) {
    }

    // ---- delegates ----

    public record DelegateRow(UUID id, UUID userId, String fullName, String employeeCode, String department, String position, String scopeKind, String scopeLabel,
                              String grantedBy, String grantedAt) {
    }

    public record DelegateRequest(@NotBlank @Size(max = 20) String scopeKind, UUID businessUnitId, UUID departmentId, UUID userId) {
    }

    // ---- links ----

    public record LinkRow(UUID id, String scopeKind, String scopeLabel, String label, boolean inherited, String status, String createdBy,
                          String createdByLevel, String createdAt, String expiresAt, String revokedAt, String revokedBy, long opens,
                          boolean revocable) {
    }

    public record LinkRequest(
            @NotBlank @Size(max = 20) String kind,
            UUID businessUnitId,
            UUID departmentId,
            UUID documentTypeId,
            UUID documentId,
            /** 1, 7, 30 or 90 days; null for a link that does not expire (Heads only). */
            Integer expiresInDays) {
    }

    /** A new link: the token appears here and nowhere else; only its hash is stored. */
    public record LinkCreated(LinkRow link, String token) {
    }

    /** Where an opened link leads: a document to open, or a folder of the explorer (when the hierarchy can express it). */
    public record LinkTarget(String kind, String label, UUID documentId, String documentNumber, String documentName, String revisionNumber,
                             String department, UUID hierarchyId, String knowledgeBaseKey, String knowledgeBaseLabel, List<String> path) {
    }

    public record LinkRedeemRequest(@NotBlank @Size(max = 200) String token) {
    }
}
