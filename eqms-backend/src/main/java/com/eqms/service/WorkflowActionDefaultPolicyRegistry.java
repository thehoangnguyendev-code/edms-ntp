package com.eqms.service;

import com.eqms.enums.WorkflowActorType;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Immutable baseline defaults for Document Master, Document Revision and Controlled Copy system policies.
 * Used by resetToSystemDefault() to fully restore a system policy.
 */
public final class WorkflowActionDefaultPolicyRegistry {

    private static final String DOCUMENT_WORKSPACE_MANAGE_PERMISSION = "documents.workspace.manage";

    private static final Map<String, DefaultPolicy> DOCUMENT_DEFAULTS;

    static {
        Map<String, DefaultPolicy> m = new java.util.LinkedHashMap<>();
        addDocument(m, "UPDATE_METADATA", "DRAFT", "documents.document.update_metadata",
                "System default: a user granted document metadata update may update Draft document metadata.",
                List.of(permission("documents.document.update_metadata")));
        addDocument(m, "CANCEL", "DRAFT", "documents.document.cancel",
                "System default: a user granted document workspace management may cancel a Draft document.",
                List.of(permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION)));
        addDocument(m, "REOPEN", "CLOSED_CANCELLED", "documents.document.reopen",
                "System default: only a user explicitly granted document reopen may reopen a cancelled document.",
                List.of(permission("documents.document.reopen")));
        addDocument(m, "OBSOLETE", "ACTIVE", "documents.document.obsolete",
                "System default: a user granted document workspace management may obsolete an Active document.",
                List.of(permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION)));
        DOCUMENT_DEFAULTS = Collections.unmodifiableMap(m);
    }

    public record DefaultActorEntry(WorkflowActorType actorType, String actorCode) {}

    public record DefaultPolicy(
            String actionCode,
            String fromStatus,
            String requiredPermissionCode,
            int priority,
            boolean active,
            String description,
            List<DefaultActorEntry> actors
    ) {}

    // ── Document Revision defaults ─────────────────────────────────────────────

    private static final Map<String, DefaultPolicy> REVISION_DEFAULTS;

    static {
        Map<String, DefaultPolicy> m = new java.util.LinkedHashMap<>();

        addRev(m, "UPDATE_DRAFT_METADATA", "DRAFT",
                "documents.revision.update_draft_metadata",
                "System default: a user granted revision metadata update may update Draft revision metadata.",
                List.of(permission("documents.revision.update_draft_metadata")));

        addRev(m, "UPLOAD_SOURCE", "DRAFT",
                "documents.revision.upload_source",
                "System default: only the assigned revision author may upload or replace the source file.",
                List.of(actor(WorkflowActorType.AUTHOR)));

        addRev(m, "COMPLETE_AUTHORING", "DRAFT",
                "documents.revision.complete_authoring",
                "System default: only the revision author may complete authoring.",
                List.of(actor(WorkflowActorType.AUTHOR)));

        addRev(m, "OPEN_PUBLISHING_WORKSPACE", "READY_FOR_PUBLISHING",
                "documents.revision.open_publishing_workspace",
                "System default: a user granted publishing workspace access may open it.",
                List.of(permission("documents.revision.open_publishing_workspace")));

        // Deliberately NOT DCO/DOCUMENT_CONTROLLER here. Who submits for review is a business
        // decision, not a system default — it lives as DATA in
        // V345__set_submit_for_review_actor_to_document_controller.sql, changeable via the
        // Workflow Authorization UI without a deploy. "Reset to System Default" must fall back
        // to a neutral, permission-only actor (pre-V345 behaviour), not silently re-bind the
        // policy to whichever Access Profile happened to be chosen when this was last written —
        // otherwise the "default" itself becomes an undocumented hard-coded business assumption.
        addRev(m, "SUBMIT_FOR_REVIEW", "DRAFT",
                "documents.revision.submit_review",
                "System default: a user granted revision submission may submit the revision for review.",
                List.of(permission("documents.revision.submit_review")));

        addRev(m, "GENERATE_REVIEW_SNAPSHOT", "DRAFT",
                "documents.revision.generate_preview",
                "System default: a user granted document workspace management may generate review snapshot.",
                List.of(permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION)));

        addRev(m, "REGENERATE_SNAPSHOT", "DRAFT",
                "documents.revision.generate_preview",
                "System default: a user granted document workspace management may regenerate snapshot.",
                List.of(permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION)));

        addRev(m, "COMPLETE_REVIEW", "PENDING_REVIEW",
                "documents.revision.review",
                "System default: only an assigned pending reviewer may complete review.",
                List.of(actor(WorkflowActorType.ASSIGNED_REVIEWER)));

        addRev(m, "REJECT_REVIEW", "PENDING_REVIEW",
                "documents.revision.reject_review",
                "System default: only an assigned pending reviewer may reject review.",
                List.of(actor(WorkflowActorType.ASSIGNED_REVIEWER)));

        addRev(m, "COMPLETE_APPROVAL", "PENDING_APPROVAL",
                "documents.revision.approve",
                "System default: only an assigned pending approver may complete approval.",
                List.of(actor(WorkflowActorType.ASSIGNED_APPROVER)));

        addRev(m, "REJECT_APPROVAL", "PENDING_APPROVAL",
                "documents.revision.reject_approval",
                "System default: only an assigned pending approver may reject approval.",
                List.of(actor(WorkflowActorType.ASSIGNED_APPROVER)));

        // No required_permission_code: gated purely by holding any one of the three actor
        // permissions below (matches the live seeded policy, which already diverged from an
        // earlier documents.workspace.manage-based default — this snapshot was out of sync with
        // production until corrected here, the same class of drift T-P1-3 fixed for
        // SUBMIT_FOR_REVIEW/OPEN_PUBLISHING_WORKSPACE).
        addRev(m, "COMPLETE_TRAINING", "PENDING_TRAINING",
                "",
                "System default: a user granted document training completion, training plan management, or training material management may complete training.",
                List.of(permission("documents.training.complete"), permission("documents.training.manage"),
                        permission("training.material.manage")));

        addRev(m, "PUBLISH", "READY_FOR_PUBLISHING",
                "documents.revision.publish",
                "System default: a user granted document workspace management may publish.",
                List.of(permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION)));

        m.put(cancelKey("DRAFT"), new DefaultPolicy(
                "CANCEL", "DRAFT", "documents.revision.cancel", 100, true,
                "System default: the revision Author, Co-author, or a user granted document workspace management may cancel a draft revision.",
                List.of(actor(WorkflowActorType.AUTHOR), actor(WorkflowActorType.CO_AUTHOR),
                        permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION))));

        addRev(m, "UPGRADE_REVISION", "EFFECTIVE",
                "documents.revision.upgrade",
                "System default: the assigned Author or a user granted document workspace management may upgrade an effective revision.",
                List.of(actor(WorkflowActorType.AUTHOR), permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION)));

        REVISION_DEFAULTS = Collections.unmodifiableMap(m);
    }

    // ── Controlled Copy defaults ───────────────────────────────────────────────
    // Keyed by actionCode + "_" + fromStatus (unique across CC policies from V160).

    private static final Map<String, DefaultPolicy> CC_DEFAULTS;

    static {
        Map<String, DefaultPolicy> m = new java.util.LinkedHashMap<>();
        List<DefaultActorEntry> dcoDa = List.of(permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION));
        List<DefaultActorEntry> dcoDaOwner = List.of(permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION), actor(WorkflowActorType.OWNER));
        List<DefaultActorEntry> dcoDaViewerOwner = List.of(
                permission(DOCUMENT_WORKSPACE_MANAGE_PERMISSION),
                actor(WorkflowActorType.RECIPIENT), actor(WorkflowActorType.OWNER));

        // A user who can view an Active document may request a copy for its
        // current Effective revision. Distribution and recall require their
        // explicit operational permissions; no display-role name grants them.
        addCC(m, "REQUEST_COPY",         "EFFECTIVE",              "documents.controlled_copy.request",              dcoDaViewerOwner);
        addCC(m, "VIEW_COPY",            "READY_FOR_DISTRIBUTION", "documents.controlled_copy.view",                 dcoDaViewerOwner);
        addCC(m, "VIEW_COPY",            "DISTRIBUTED",            "documents.controlled_copy.view",                 dcoDaViewerOwner);
        addCC(m, "PREVIEW_FILE",         "READY_FOR_DISTRIBUTION", "documents.controlled_copy.view_file",            dcoDaViewerOwner);
        addCC(m, "PREVIEW_FILE",         "DISTRIBUTED",            "documents.controlled_copy.view_file",            dcoDaViewerOwner);
        addCC(m, "DOWNLOAD_FILE",        "DISTRIBUTED",            "documents.controlled_copy.download_file",        dcoDaViewerOwner);
        addCC(m, "PRINT_COPY",           "READY_FOR_DISTRIBUTION", "documents.controlled_copy.print",                dcoDaViewerOwner);
        addCC(m, "PRINT_COPY",           "DISTRIBUTED",            "documents.controlled_copy.print",                dcoDaViewerOwner);
        addCC(m, "RECALL_COPY",          "READY_FOR_DISTRIBUTION", "documents.controlled_copy.recall",               dcoDa);
        addCC(m, "RECALL_COPY",          "DISTRIBUTED",            "documents.controlled_copy.recall",               dcoDa);
        addCC(m, "REPORT_LOST_DAMAGED",  "DISTRIBUTED",            "documents.controlled_copy.report_lost_damaged",  List.of(permission("documents.controlled_copy.report_lost_damaged")));
        addCC(m, "REPLACE_LOST_DAMAGED", "OBSOLETED",              "documents.controlled_copy.replace_lost_damaged", dcoDa);
        addCC(m, "UPLOAD_EVIDENCE",      "OBSOLETED",              "documents.controlled_copy.upload_evidence",      List.of(permission("documents.controlled_copy.upload_evidence")));
        addCC(m, "EXPIRE_COPY",          "READY_FOR_DISTRIBUTION", "documents.controlled_copy.expire",               dcoDa);
        addCC(m, "EXPIRE_COPY",          "DISTRIBUTED",            "documents.controlled_copy.expire",               dcoDa);
        addCC(m, "CANCEL_REQUEST",       "READY_FOR_DISTRIBUTION", "documents.controlled_copy.cancel_request",       dcoDa);
        // A single record uses a different action code from a batch.  Keep it in
        // the reset registry as well as the Flyway seed so a policy reset cannot
        // make the individual Distribute capability disagree with its mutation.
        addCC(m, "DISTRIBUTE_COPY",      "READY_FOR_DISTRIBUTION", "documents.controlled_copy.distribute",           dcoDa);
        addCC(m, "DISTRIBUTE_BATCH",     "READY_FOR_DISTRIBUTION", "documents.controlled_copy.distribute",           dcoDa);
        addCC(m, "RECALL_BATCH",         "DISTRIBUTED",            "documents.controlled_copy.recall",               dcoDa);

        CC_DEFAULTS = Collections.unmodifiableMap(m);
    }

    private WorkflowActionDefaultPolicyRegistry() {}

    // ── Lookup API ─────────────────────────────────────────────────────────────

    /**
     * Returns the default for (actionCode, fromStatus) in DOCUMENT_REVISION.
     * Kept for backward compatibility.
     */
    public static DefaultPolicy get(String actionCode, String fromStatus) {
        if ("CANCEL".equals(actionCode)) {
            return REVISION_DEFAULTS.get(cancelKey(fromStatus));
        }
        return REVISION_DEFAULTS.get(actionCode);
    }

    /**
     * Returns the default for (workflowKey, actionCode, fromStatus).
     * Supports DOCUMENT_REVISION and CONTROLLED_COPY.
     */
    public static DefaultPolicy get(String workflowKey, String actionCode, String fromStatus) {
        if ("DOCUMENT".equals(workflowKey)) {
            return DOCUMENT_DEFAULTS.get(actionCode);
        }
        if ("CONTROLLED_COPY".equals(workflowKey)) {
            return CC_DEFAULTS.get(ccKey(actionCode, fromStatus));
        }
        return get(actionCode, fromStatus);
    }

    /** All Document Revision defaults. */
    public static java.util.Collection<DefaultPolicy> all() {
        return REVISION_DEFAULTS.values();
    }

    /** All Controlled Copy defaults. */
    public static java.util.Collection<DefaultPolicy> allControlledCopy() {
        return CC_DEFAULTS.values();
    }

    /** All Document Master defaults. */
    public static java.util.Collection<DefaultPolicy> allDocument() {
        return DOCUMENT_DEFAULTS.values();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static DefaultActorEntry actor(WorkflowActorType type) {
        return new DefaultActorEntry(type, null);
    }

    private static DefaultActorEntry permission(String code) {
        return new DefaultActorEntry(WorkflowActorType.PERMISSION, code);
    }

    private static void addRev(Map<String, DefaultPolicy> m, String actionCode, String fromStatus,
                                String perm, String desc, List<DefaultActorEntry> actors) {
        m.put(actionCode, new DefaultPolicy(actionCode, fromStatus, perm, 100, true, desc, actors));
    }

    private static void addDocument(Map<String, DefaultPolicy> m, String actionCode, String fromStatus,
                                    String perm, String desc, List<DefaultActorEntry> actors) {
        m.put(actionCode, new DefaultPolicy(actionCode, fromStatus, perm, 100, true, desc, actors));
    }

    private static void addCC(Map<String, DefaultPolicy> m, String actionCode, String fromStatus,
                               String perm, List<DefaultActorEntry> actors) {
        m.put(ccKey(actionCode, fromStatus),
                new DefaultPolicy(actionCode, fromStatus, perm, 100, true,
                        "System default: " + actionCode + " from " + fromStatus + ".", actors));
    }

    private static String cancelKey(String fromStatus) {
        return "CANCEL_" + fromStatus;
    }

    private static String ccKey(String actionCode, String fromStatus) {
        return actionCode + "_" + (fromStatus != null ? fromStatus : "");
    }
}
