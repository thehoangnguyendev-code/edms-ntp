package com.eqms.service;

import com.eqms.enums.WorkflowActorType;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Immutable baseline defaults for Document Master, Document Revision, Controlled Copy and Report template review system policies.
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

        addRev(m, "OPEN_PUBLISHING_WORKSPACE", "READY_FOR_PUBLISHING",
                "documents.revision.open_publishing_workspace",
                "System default: a user granted publishing workspace access may open it.",
                List.of(permission("documents.revision.open_publishing_workspace")));

        // The revision Author submits for review (Complete Editing no longer exists: Submit locks the source and signs).
        // Who else may submit, for example Document Control, is business configuration: add that Access Profile or permission
        // as an actor of this policy in Workflow Authorization, without a deploy.
        addRev(m, "SUBMIT_FOR_REVIEW", "DRAFT",
                "documents.revision.submit_review",
                "System default: the revision Author, granted revision submission, may submit the revision for review.",
                List.of(actor(WorkflowActorType.AUTHOR)));

        // Review-snapshot generation is now fully system-triggered (submitForReview requests it
        // automatically; RevisionSnapshotRetryScheduler retries failures) -- there is no manual
        // FE action left that calls these two anymore, and documents.revision.generate_preview
        // has been retired. Kept here (rather than removed outright) only so "Reset to System
        // Default" in the Workflow Authorization UI has a defined, valid target instead of
        // resurrecting the deleted permission code; matches the permission already live in the DB
        // for these two policy rows.
        addRev(m, "GENERATE_REVIEW_SNAPSHOT", "DRAFT",
                "documents.revision.submit_review",
                "System default: system-triggered; requires the same permission as submitting for review.",
                List.of(permission("documents.revision.submit_review")));

        addRev(m, "REGENERATE_SNAPSHOT", "DRAFT",
                "documents.revision.submit_review",
                "System default: system-triggered; requires the same permission as submitting for review.",
                List.of(permission("documents.revision.submit_review")));

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

    // ── Report template review defaults (V807) ───────────────────────────────

    private static final Map<String, DefaultPolicy> REPORT_TEMPLATE_DEFAULTS;

    static {
        Map<String, DefaultPolicy> m = new java.util.LinkedHashMap<>();
        m.put("APPROVE", new DefaultPolicy("APPROVE", "PENDING_APPROVAL", "reports.definition.approve", 100, true,
                "A holder of the approval permission approves a template that is not for GMP decisions, unless they wrote or submitted the version.",
                List.of(permission("reports.definition.approve"))));
        m.put("APPROVE_GMP", new DefaultPolicy("APPROVE_GMP", "PENDING_APPROVAL", "reports.definition.approve_gmp", 100, true,
                "A holder of the GMP approval permission approves a template for GMP decisions, unless they wrote or submitted the version.",
                List.of(permission("reports.definition.approve_gmp"))));
        m.put("REJECT", new DefaultPolicy("REJECT", "PENDING_APPROVAL", "reports.definition.approve", 100, true,
                "A holder of the approval permission returns a template that is not for GMP decisions to Draft, unless they wrote or submitted the version.",
                List.of(permission("reports.definition.approve"))));
        m.put("REJECT_GMP", new DefaultPolicy("REJECT_GMP", "PENDING_APPROVAL", "reports.definition.approve_gmp", 100, true,
                "A holder of the GMP approval permission returns a template for GMP decisions to Draft, unless they wrote or submitted the version.",
                List.of(permission("reports.definition.approve_gmp"))));
        m.put("SUBMIT", new DefaultPolicy("SUBMIT", "ANY", "reports.definition.manage", 100, true,
                "A holder of the manage permission submits a draft template for approval.",
                List.of(permission("reports.definition.manage"))));
        m.put("UPGRADE", new DefaultPolicy("UPGRADE", "ANY", "reports.definition.upgrade", 100, true,
                "A holder of the upgrade permission starts a new revision of a template that has an effective revision.",
                List.of(permission("reports.definition.upgrade"))));
        m.put("SET_ENABLED", new DefaultPolicy("SET_ENABLED", "ANY", "reports.definition.set_enabled", 100, true,
                "A holder of the enable permission turns an approved template on or off.",
                List.of(permission("reports.definition.set_enabled"))));
        m.put("DISCARD_REVISION", new DefaultPolicy("DISCARD_REVISION", "ANY", "reports.definition.discard_revision", 100, true,
                "A holder of the discard permission discards an open draft revision.",
                List.of(permission("reports.definition.discard_revision"))));
        m.put("DELETE", new DefaultPolicy("DELETE", "ANY", "reports.definition.manage", 100, true,
                "A holder of the manage permission deletes a template that is not for GMP decisions. A GMP template is disabled, never deleted (no DELETE_GMP policy exists).",
                List.of(permission("reports.definition.manage"))));
        REPORT_TEMPLATE_DEFAULTS = Collections.unmodifiableMap(m);
    }

    // ── Training defaults (V810) ─────────────────────────────────────────────

    /** A system policy of a Training lifecycle: the workflow, the object type of its resource and the default itself. */
    public record TrainingDefault(String workflowKey, String objectType, DefaultPolicy policy) {}

    private static final Map<String, TrainingDefault> TRAINING_DEFAULTS;

    static {
        Map<String, TrainingDefault> m = new java.util.LinkedHashMap<>();
        m.put("TRAINING_REQUIREMENT|SUBMIT|DRAFT", new TrainingDefault("TRAINING_REQUIREMENT", "TRAINING_REQUIREMENT", new DefaultPolicy("SUBMIT", "DRAFT", "training.requirement.prepare", 100, true,
                "A person who prepares requirements, in the department of the requirement, sends a draft with at least one line for review.",
                List.of(permission("training.requirement.prepare")))));
        m.put("TRAINING_REQUIREMENT|REVIEW|PENDING_REVIEW", new TrainingDefault("TRAINING_REQUIREMENT", "TRAINING_REQUIREMENT", new DefaultPolicy("REVIEW", "PENDING_REVIEW", "training.requirement.review", 100, true,
                "The person designated to review, who did not prepare the requirement, reviews it and sends it for approval.",
                List.of(permission("training.requirement.review")))));
        m.put("TRAINING_REQUIREMENT|APPROVE|PENDING_APPROVAL", new TrainingDefault("TRAINING_REQUIREMENT", "TRAINING_REQUIREMENT", new DefaultPolicy("APPROVE", "PENDING_APPROVAL", "training.requirement.approve", 100, true,
                "The person designated to approve, who neither prepared nor reviewed the requirement, approves it.",
                List.of(permission("training.requirement.approve")))));
        m.put("TRAINING_REQUIREMENT|REJECT|PENDING_REVIEW", new TrainingDefault("TRAINING_REQUIREMENT", "TRAINING_REQUIREMENT", new DefaultPolicy("REJECT", "PENDING_REVIEW", "training.requirement.review", 100, true,
                "The person designated to review sends the requirement back to Draft with a reason.",
                List.of(permission("training.requirement.review")))));
        m.put("TRAINING_REQUIREMENT|REJECT|PENDING_APPROVAL", new TrainingDefault("TRAINING_REQUIREMENT", "TRAINING_REQUIREMENT", new DefaultPolicy("REJECT", "PENDING_APPROVAL", "training.requirement.approve", 100, true,
                "The person designated to approve sends the requirement back to Draft with a reason.",
                List.of(permission("training.requirement.approve")))));
        m.put("TRAINING_MATRIX|SUBMIT|DRAFT", new TrainingDefault("TRAINING_MATRIX", "TRAINING_MATRIX_VERSION", new DefaultPolicy("SUBMIT", "DRAFT", "training.matrix.manage", 100, true,
                "A person who manages matrices, in the department of the matrix, sends a complete draft version for approval.",
                List.of(permission("training.matrix.manage")))));
        m.put("TRAINING_MATRIX|REVIEW|PENDING_REVIEW", new TrainingDefault("TRAINING_MATRIX", "TRAINING_MATRIX_VERSION", new DefaultPolicy("REVIEW", "PENDING_REVIEW", "training.matrix.manage", 100, true,
                "The person designated to review, who did not prepare the version, reviews it and sends it for approval.",
                List.of(permission("training.matrix.manage")))));
        m.put("TRAINING_MATRIX|REJECT|PENDING_REVIEW", new TrainingDefault("TRAINING_MATRIX", "TRAINING_MATRIX_VERSION", new DefaultPolicy("REJECT", "PENDING_REVIEW", "training.matrix.manage", 100, true,
                "The person designated to review sends the version back to Draft with a reason.",
                List.of(permission("training.matrix.manage")))));
        m.put("TRAINING_MATRIX|APPROVE|PENDING_APPROVAL", new TrainingDefault("TRAINING_MATRIX", "TRAINING_MATRIX_VERSION", new DefaultPolicy("APPROVE", "PENDING_APPROVAL", "training.matrix.approve", 100, true,
                "The person designated to approve, who did not prepare the version, approves it and it becomes the effective version.",
                List.of(permission("training.matrix.approve")))));
        m.put("TRAINING_MATRIX|REJECT|PENDING_APPROVAL", new TrainingDefault("TRAINING_MATRIX", "TRAINING_MATRIX_VERSION", new DefaultPolicy("REJECT", "PENDING_APPROVAL", "training.matrix.approve", 100, true,
                "The person designated to approve sends the version back to Draft with a reason.",
                List.of(permission("training.matrix.approve")))));
        m.put("TRAINING_ACTIVITY|UPDATE|PLANNED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("UPDATE", "PLANNED", "training.activity.organize", 100, true,
                "An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|UPDATE|NOTIFIED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("UPDATE", "NOTIFIED", "training.activity.organize", 100, true,
                "An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|UPDATE|IN_PROGRESS", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("UPDATE", "IN_PROGRESS", "training.activity.organize", 100, true,
                "An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|UPDATE|PENDING_QA_CONFIRMATION", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("UPDATE", "PENDING_QA_CONFIRMATION", "training.activity.organize", 100, true,
                "An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|ADD_SESSION|PLANNED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("ADD_SESSION", "PLANNED", "training.activity.organize", 100, true,
                "An organizer adds a session before the training starts.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|ADD_PARTICIPANTS|PLANNED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("ADD_PARTICIPANTS", "PLANNED", "training.activity.organize", 100, true,
                "An organizer adds people to a session until the list is confirmed.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|CONFIRM_LIST|PLANNED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CONFIRM_LIST", "PLANNED", "training.activity.organize", 100, true,
                "An organizer confirms the list of participants, with a signature.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|NOTIFY|PLANNED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("NOTIFY", "PLANNED", "training.activity.organize", 100, true,
                "An organizer notifies the participants once the list is confirmed and the content is approved.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|CANCEL|PLANNED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CANCEL", "PLANNED", "training.activity.cancel", 100, true,
                "A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.",
                List.of(permission("training.activity.cancel")))));
        m.put("TRAINING_ACTIVITY|CANCEL|NOTIFIED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CANCEL", "NOTIFIED", "training.activity.cancel", 100, true,
                "A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.",
                List.of(permission("training.activity.cancel")))));
        m.put("TRAINING_ACTIVITY|CANCEL|IN_PROGRESS", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CANCEL", "IN_PROGRESS", "training.activity.cancel", 100, true,
                "A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.",
                List.of(permission("training.activity.cancel")))));
        m.put("TRAINING_ACTIVITY|CANCEL|PENDING_QA_CONFIRMATION", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CANCEL", "PENDING_QA_CONFIRMATION", "training.activity.cancel", 100, true,
                "A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.",
                List.of(permission("training.activity.cancel")))));
        m.put("TRAINING_ACTIVITY|REOPEN_CONTENT|NOTIFIED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("REOPEN_CONTENT", "NOTIFIED", "training.activity.organize", 100, true,
                "An organizer reopens the reviewed and approved content, with a reason and a signature.",
                List.of(permission("training.activity.organize")))));
        // Only a Completed activity gets a supplementary training (owner decision 2026-11-23, DEC-TRAINING-2026-11-23-02; V842 retired the IN_PROGRESS and PENDING_QA_CONFIRMATION policies).
        m.put("TRAINING_ACTIVITY|SUPPLEMENTARY|COMPLETED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("SUPPLEMENTARY", "COMPLETED", "training.activity.organize", 100, true,
                "An organizer opens a supplementary training for people who were absent or failed.",
                List.of(permission("training.activity.organize")))));
        // The review of the content is not a step any more: one approver signs it (owner decision 2026-11-23, DEC-TRAINING-2026-11-23-08; V843 retired the CONTENT_REVIEW policies).
        // The content is approved by two people in turn through the status Pending Approval (owner decision 2026-11-23, DEC-TRAINING-2026-11-23-10; V844).
        m.put("TRAINING_ACTIVITY|SUBMIT_FOR_APPROVAL|PLANNED", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("SUBMIT_FOR_APPROVAL", "PLANNED", "training.activity.organize", 100, true,
                "An organizer submits the content and the test for approval, with a signature, once the two approvers are chosen and saved.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|CONTENT_APPROVE_FIRST|PENDING_APPROVAL", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CONTENT_APPROVE_FIRST", "PENDING_APPROVAL", "training.content.approve", 100, true,
                "The person designated to approve first, who did not create the activity, signs the first approval.",
                List.of(permission("training.content.approve")))));
        m.put("TRAINING_ACTIVITY|CONTENT_APPROVE|PENDING_APPROVAL", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CONTENT_APPROVE", "PENDING_APPROVAL", "training.content.approve", 100, true,
                "The person designated to approve second, after the first approval, who did not create the activity, signs the second approval.",
                List.of(permission("training.content.approve")))));
        m.put("TRAINING_ACTIVITY|CONTENT_REJECT|PENDING_APPROVAL", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CONTENT_REJECT", "PENDING_APPROVAL", "training.content.approve", 100, true,
                "The approver whose turn it is rejects the content with a reason and a signature; the activity returns to Planned.",
                List.of(permission("training.content.approve")))));
        m.put("TRAINING_ACTIVITY|NOTIFY|PENDING_APPROVAL", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("NOTIFY", "PENDING_APPROVAL", "training.activity.organize", 100, true,
                "An organizer notifies the participants once both approvers have signed and the list is confirmed.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|CANCEL|PENDING_APPROVAL", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CANCEL", "PENDING_APPROVAL", "training.activity.cancel", 100, true,
                "A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.",
                List.of(permission("training.activity.cancel")))));
        m.put("TRAINING_ACTIVITY|REOPEN_CONTENT|PENDING_APPROVAL", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("REOPEN_CONTENT", "PENDING_APPROVAL", "training.activity.organize", 100, true,
                "An organizer takes the content back to edit it (Edit Content), with a reason and a signature; the approvals start again.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|SEND_ATTENDANCE_LIST|IN_PROGRESS", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("SEND_ATTENDANCE_LIST", "IN_PROGRESS", "", 100, true,
                "The trainer of a session (or, for a session without a trainer, a conductor of the department) sends the attendance list.",
                List.of())));
        m.put("TRAINING_ACTIVITY|FINISH|IN_PROGRESS", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("FINISH", "IN_PROGRESS", "", 100, true,
                "The trainer (or the conductor of the department) finishes the training and sends the results to QA, with a signature.",
                List.of())));
        m.put("TRAINING_ACTIVITY|CONFIRM_COMPLETION|PENDING_QA_CONFIRMATION", new TrainingDefault("TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("CONFIRM_COMPLETION", "PENDING_QA_CONFIRMATION", "training.activity.close", 100, true,
                "A person who may close activities, in the department, other than the one who prepared the list, confirms the completion.",
                List.of(permission("training.activity.close")))));
        TRAINING_DEFAULTS = Collections.unmodifiableMap(m);
    }

    // ── Defaults of the modules added after Training (V812 and later): one generic map, filled by the generated lines below ──

    /** A system policy of any module's lifecycle: the module, the workflow, the object type of its resource and the default itself. */
    public record ModuleDefault(String moduleKey, String workflowKey, String objectType, DefaultPolicy policy) {}

    private static final Map<String, ModuleDefault> MODULE_DEFAULTS;

    static {
        Map<String, ModuleDefault> m = new java.util.LinkedHashMap<>();
        m.put("TRAINING_PARTICIPANT|REMIND_TO_READ|NOTIFIED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("REMIND_TO_READ", "NOTIFIED", "", 100, true,
                "A conductor, in the department of the activity, reminds an invited reader to read.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|REMIND_TO_READ|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("REMIND_TO_READ", "IN_PROGRESS", "", 100, true,
                "A conductor, in the department of the activity, reminds an invited reader to read.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|EXCUSE_READER|NOTIFIED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("EXCUSE_READER", "NOTIFIED", "", 100, true,
                "A conductor excuses a reader who cannot read, with a reason and a signature, but never for themselves.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|EXCUSE_READER|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("EXCUSE_READER", "IN_PROGRESS", "", 100, true,
                "A conductor excuses a reader who cannot read, with a reason and a signature, but never for themselves.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|CORRECT_ATTENDANCE|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("CORRECT_ATTENDANCE", "IN_PROGRESS", "", 100, true,
                "A conductor corrects a recorded attendance with a reason, but never their own.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|SET_PARTICIPATION|PLANNED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("SET_PARTICIPATION", "PLANNED", "", 100, true,
                "A conductor sets the role of a participant, but never their own.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|SET_PARTICIPATION|NOTIFIED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("SET_PARTICIPATION", "NOTIFIED", "", 100, true,
                "A conductor sets the role of a participant, but never their own.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|SET_PARTICIPATION|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("SET_PARTICIPATION", "IN_PROGRESS", "", 100, true,
                "A conductor sets the role of a participant, but never their own.",
                List.of())));
        m.put("TRAINING_PARTICIPANT|REMOVE_PARTICIPANT|PLANNED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("REMOVE_PARTICIPANT", "PLANNED", "training.activity.organize", 100, true,
                "An organizer removes an invited person while the list is not confirmed, with a reason.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_PARTICIPANT|SET_PLANNED_ABSENCE|PLANNED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("SET_PLANNED_ABSENCE", "PLANNED", "training.activity.organize", 100, true,
                "An organizer records or clears a planned absence of an invited person.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_PARTICIPANT|SET_PLANNED_ABSENCE|NOTIFIED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("SET_PLANNED_ABSENCE", "NOTIFIED", "training.activity.organize", 100, true,
                "An organizer records or clears a planned absence of an invited person.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_PARTICIPANT|CONFIRM_READ|NOTIFIED", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("CONFIRM_READ", "NOTIFIED", "training.self.view", 100, true,
                "The invited person confirms that they read the material, with a signature.",
                List.of(permission("training.self.view")))));
        m.put("TRAINING_PARTICIPANT|CONFIRM_READ|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", new DefaultPolicy("CONFIRM_READ", "IN_PROGRESS", "training.self.view", 100, true,
                "The invited person confirms that they read the material, with a signature.",
                List.of(permission("training.self.view")))));
        m.put("TRAINING_ASSESSMENT|UPDATE|DRAFT", new ModuleDefault("TRAINING", "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", new DefaultPolicy("UPDATE", "DRAFT", "", 100, true,
                "A person who may manage the assessment (all of them, or the ones they created) edits a draft assessment.",
                List.of())));
        m.put("TRAINING_ASSESSMENT|DELETE|DRAFT", new ModuleDefault("TRAINING", "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", new DefaultPolicy("DELETE", "DRAFT", "", 100, true,
                "A person who may manage the assessment deletes a draft assessment, with a reason.",
                List.of())));
        m.put("TRAINING_ASSESSMENT|SUBMIT|DRAFT", new ModuleDefault("TRAINING", "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", new DefaultPolicy("SUBMIT", "DRAFT", "", 100, true,
                "A person who may manage the assessment submits a draft with at least one item for approval.",
                List.of())));
        m.put("TRAINING_ASSESSMENT|APPROVE|PENDING_APPROVAL", new ModuleDefault("TRAINING", "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", new DefaultPolicy("APPROVE", "PENDING_APPROVAL", "training.assessment.approve", 100, true,
                "An approver who did not create, edit or submit the assessment approves it, with a signature.",
                List.of(permission("training.assessment.approve")))));
        m.put("TRAINING_ASSESSMENT|RETURN_TO_DRAFT|PENDING_APPROVAL", new ModuleDefault("TRAINING", "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", new DefaultPolicy("RETURN_TO_DRAFT", "PENDING_APPROVAL", "", 100, true,
                "A designer or an approver returns the assessment to Draft, with a reason.",
                List.of())));
        m.put("TRAINING_ASSESSMENT|UPGRADE_REVISION|EFFECTIVE", new ModuleDefault("TRAINING", "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", new DefaultPolicy("UPGRADE_REVISION", "EFFECTIVE", "", 100, true,
                "A person who may manage the assessment starts a new revision of an effective assessment.",
                List.of())));
        m.put("TRAINING_JOB_ASSIGNMENT|UPDATE|DRAFT", new ModuleDefault("TRAINING", "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", new DefaultPolicy("UPDATE", "DRAFT", "training.job_assignment.manage", 100, true,
                "A person who manages job assignments, in the department, edits a draft assignment.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_JOB_ASSIGNMENT|REQUEST_EXCEPTION|DRAFT", new ModuleDefault("TRAINING", "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", new DefaultPolicy("REQUEST_EXCEPTION", "DRAFT", "training.job_assignment.manage", 100, true,
                "The same person asks for an exception to the required training and chooses who approves it.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_JOB_ASSIGNMENT|APPROVE_EXCEPTION|DRAFT", new ModuleDefault("TRAINING", "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", new DefaultPolicy("APPROVE_EXCEPTION", "DRAFT", "training.job_assignment.exception.approve", 100, true,
                "The person designated approves the exception, unless they are the person assigned or created the assignment.",
                List.of(permission("training.job_assignment.exception.approve")))));
        m.put("TRAINING_JOB_ASSIGNMENT|SUBMIT|DRAFT", new ModuleDefault("TRAINING", "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", new DefaultPolicy("SUBMIT", "DRAFT", "training.job_assignment.manage", 100, true,
                "The assignor signs and sends the assignment to the person, who cannot assign themselves.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_JOB_ASSIGNMENT|ACCEPT|PENDING_RECEIVER", new ModuleDefault("TRAINING", "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", new DefaultPolicy("ACCEPT", "PENDING_RECEIVER", "training.self.view", 100, true,
                "The person assigned accepts, with a signature; it becomes effective.",
                List.of(permission("training.self.view")))));
        m.put("TRAINING_JOB_ASSIGNMENT|CANCEL|DRAFT", new ModuleDefault("TRAINING", "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", new DefaultPolicy("CANCEL", "DRAFT", "training.job_assignment.manage", 100, true,
                "A person who manages job assignments cancels the assignment, with a reason.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_JOB_ASSIGNMENT|CANCEL|PENDING_RECEIVER", new ModuleDefault("TRAINING", "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", new DefaultPolicy("CANCEL", "PENDING_RECEIVER", "training.job_assignment.manage", 100, true,
                "A person who manages job assignments cancels the assignment, with a reason.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_PERSONNEL_REVIEW|UPDATE_ITEM|OPEN", new ModuleDefault("TRAINING", "TRAINING_PERSONNEL_REVIEW", "TRAINING_PERSONNEL_REVIEW", new DefaultPolicy("UPDATE_ITEM", "OPEN", "training.job_assignment.manage", 100, true,
                "A person who manages job assignments, for the department of the person reviewed, updates an item of the review.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_PERSONNEL_REVIEW|CREATE_ACTIVITY|OPEN", new ModuleDefault("TRAINING", "TRAINING_PERSONNEL_REVIEW", "TRAINING_PERSONNEL_REVIEW", new DefaultPolicy("CREATE_ACTIVITY", "OPEN", "training.job_assignment.manage", 100, true,
                "The same person opens a training activity for an item.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_PERSONNEL_REVIEW|CLOSE|OPEN", new ModuleDefault("TRAINING", "TRAINING_PERSONNEL_REVIEW", "TRAINING_PERSONNEL_REVIEW", new DefaultPolicy("CLOSE", "OPEN", "training.job_assignment.manage", 100, true,
                "The closer chosen (or any person allowed, when none was chosen) closes the review with a signature, but not for themselves.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_PERSONNEL_REVIEW|CANCEL|OPEN", new ModuleDefault("TRAINING", "TRAINING_PERSONNEL_REVIEW", "TRAINING_PERSONNEL_REVIEW", new DefaultPolicy("CANCEL", "OPEN", "training.job_assignment.manage", 100, true,
                "A person who manages job assignments cancels the review, with a reason.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_PERSONNEL_REVIEW|CHANGE_CLOSER|OPEN", new ModuleDefault("TRAINING", "TRAINING_PERSONNEL_REVIEW", "TRAINING_PERSONNEL_REVIEW", new DefaultPolicy("CHANGE_CLOSER", "OPEN", "training.job_assignment.manage", 100, true,
                "A person who may reassign approval steps hands the closing over to another person, with a reason.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_RECORD_EXPORT|APPROVE|PENDING_APPROVAL", new ModuleDefault("TRAINING", "TRAINING_RECORD_EXPORT", "TRAINING_RECORD_EXPORT", new DefaultPolicy("APPROVE", "PENDING_APPROVAL", "training.record.export", 100, true,
                "The person designated, who did not prepare the export of a personal training record, approves it with a signature.",
                List.of(permission("training.record.export")))));
        m.put("TRAINING_RECORD_EXPORT|REJECT|PENDING_APPROVAL", new ModuleDefault("TRAINING", "TRAINING_RECORD_EXPORT", "TRAINING_RECORD_EXPORT", new DefaultPolicy("REJECT", "PENDING_APPROVAL", "training.record.export", 100, true,
                "The person designated rejects the export, with a reason.",
                List.of(permission("training.record.export")))));
        m.put("TRAINING_RECORD_EXPORT_BATCH|APPROVE|PENDING_APPROVAL", new ModuleDefault("TRAINING", "TRAINING_RECORD_EXPORT_BATCH", "TRAINING_RECORD_EXPORT_BATCH", new DefaultPolicy("APPROVE", "PENDING_APPROVAL", "training.record.export", 100, true,
                "The person designated, who did not prepare the yearly export of a department, approves it with a signature.",
                List.of(permission("training.record.export")))));
        m.put("TRAINING_RECORD_EXPORT_BATCH|REJECT|PENDING_APPROVAL", new ModuleDefault("TRAINING", "TRAINING_RECORD_EXPORT_BATCH", "TRAINING_RECORD_EXPORT_BATCH", new DefaultPolicy("REJECT", "PENDING_APPROVAL", "training.record.export", 100, true,
                "The person designated rejects the batch, with a reason.",
                List.of(permission("training.record.export")))));
        m.put("TRAINING_TRAINER_EXCEPTION|APPROVE|PENDING", new ModuleDefault("TRAINING", "TRAINING_TRAINER_EXCEPTION", "TRAINING_TRAINER_EXCEPTION", new DefaultPolicy("APPROVE", "PENDING", "training.trainer.exception.approve", 100, true,
                "The person designated approves a trainer who is not qualified, unless they asked for it or are the trainer.",
                List.of(permission("training.trainer.exception.approve")))));
        m.put("TRAINING_TRAINER_EXCEPTION|REJECT|PENDING", new ModuleDefault("TRAINING", "TRAINING_TRAINER_EXCEPTION", "TRAINING_TRAINER_EXCEPTION", new DefaultPolicy("REJECT", "PENDING", "training.trainer.exception.approve", 100, true,
                "The person designated rejects the exception, with a reason.",
                List.of(permission("training.trainer.exception.approve")))));
        m.put("TRAINING_SUSPENSION|RESUME|OPEN", new ModuleDefault("TRAINING", "TRAINING_SUSPENSION", "TRAINING_SUSPENSION", new DefaultPolicy("RESUME", "OPEN", "training.job_assignment.manage", 100, true,
                "A person who manages job assignments, for the department of the person, lets the work resume with a reason and a signature, but not their own.",
                List.of(permission("training.job_assignment.manage")))));
        m.put("TRAINING_VENDOR|APPROVE|DRAFT", new ModuleDefault("TRAINING", "TRAINING_VENDOR", "TRAINING_VENDOR", new DefaultPolicy("APPROVE", "DRAFT", "training.admin.manage", 100, true,
                "A Training administrator who did not create the external vendor approves it, with a signature.",
                List.of(permission("training.admin.manage")))));
        m.put("TRAINING_RECORD|VOID|ACTIVE", new ModuleDefault("TRAINING", "TRAINING_RECORD", "TRAINING_RECORD", new DefaultPolicy("VOID", "ACTIVE", "training.record.void", 100, true,
                "A person who may void records, in the department of the activity and other than the one who confirmed its completion, voids a record with a reason and a signature.",
                List.of(permission("training.record.void")))));
        m.put("REPORT_SCHEDULE|PAUSE|ANY", new ModuleDefault("REPORT", "REPORT_SCHEDULE", "REPORT_SCHEDULE", new DefaultPolicy("PAUSE", "ANY", "", 100, true,
                "Whoever may manage the schedule pauses it.",
                List.of())));
        m.put("REPORT_SCHEDULE|RESUME|ANY", new ModuleDefault("REPORT", "REPORT_SCHEDULE", "REPORT_SCHEDULE", new DefaultPolicy("RESUME", "ANY", "", 100, true,
                "Whoever may manage the schedule resumes it.",
                List.of())));
        m.put("REPORT_SCHEDULE|DELETE|ANY", new ModuleDefault("REPORT", "REPORT_SCHEDULE", "REPORT_SCHEDULE", new DefaultPolicy("DELETE", "ANY", "", 100, true,
                "Whoever may manage the schedule deletes it.",
                List.of())));
        m.put("REPORT_SCHEDULE|CHANGE_OWNER|ANY", new ModuleDefault("REPORT", "REPORT_SCHEDULE", "REPORT_SCHEDULE", new DefaultPolicy("CHANGE_OWNER", "ANY", "", 100, true,
                "Whoever may manage the schedule hands it to another active owner, with a reason.",
                List.of())));
        m.put("REPORT_RUN|RETRY|FAILED", new ModuleDefault("REPORT", "REPORT_RUN", "REPORT_RUN", new DefaultPolicy("RETRY", "FAILED", "", 100, true,
                "A person who may request reports and see the run retries a run that failed.",
                List.of())));
        m.put("REPORT_RUN|RETRY|RETRY_SCHEDULED", new ModuleDefault("REPORT", "REPORT_RUN", "REPORT_RUN", new DefaultPolicy("RETRY", "RETRY_SCHEDULED", "", 100, true,
                "A person who may request reports and see the run retries a run that failed.",
                List.of())));
        m.put("REPORT_ARTIFACT|PLACE_HOLD|NOT_HELD", new ModuleDefault("REPORT", "REPORT_ARTIFACT", "REPORT_ARTIFACT", new DefaultPolicy("PLACE_HOLD", "NOT_HELD", "", 100, true,
                "A person who manages report retention places a legal hold on a report file, with a reason.",
                List.of())));
        m.put("REPORT_ARTIFACT|RELEASE_HOLD|HELD", new ModuleDefault("REPORT", "REPORT_ARTIFACT", "REPORT_ARTIFACT", new DefaultPolicy("RELEASE_HOLD", "HELD", "", 100, true,
                "The same person releases the legal hold, with a reason and a signature.",
                List.of())));
        m.put("ACCESS_REVIEW_CAMPAIGN|DECIDE_ITEM|IN_PROGRESS", new ModuleDefault("SECURITY", "ACCESS_REVIEW_CAMPAIGN", "ACCESS_REVIEW_CAMPAIGN", new DefaultPolicy("DECIDE_ITEM", "IN_PROGRESS", "security.access_review.manage", 100, true,
                "A person who manages access reviews records a decision on an item of an in-progress campaign.",
                List.of(permission("security.access_review.manage")))));
        m.put("ACCESS_REVIEW_CAMPAIGN|COMPLETE|IN_PROGRESS", new ModuleDefault("SECURITY", "ACCESS_REVIEW_CAMPAIGN", "ACCESS_REVIEW_CAMPAIGN", new DefaultPolicy("COMPLETE", "IN_PROGRESS", "security.access_review.manage", 100, true,
                "The same person completes the campaign when no item is pending, with a signature.",
                List.of(permission("security.access_review.manage")))));
        m.put("ACCESS_REVIEW_CAMPAIGN|CANCEL|IN_PROGRESS", new ModuleDefault("SECURITY", "ACCESS_REVIEW_CAMPAIGN", "ACCESS_REVIEW_CAMPAIGN", new DefaultPolicy("CANCEL", "IN_PROGRESS", "security.access_review.manage", 100, true,
                "The same person cancels an in-progress campaign.",
                List.of(permission("security.access_review.manage")))));
        m.put("AUDIT_REVIEW_CAMPAIGN|DECIDE_ITEM|IN_PROGRESS", new ModuleDefault("AUDIT_TRAIL", "AUDIT_REVIEW_CAMPAIGN", "AUDIT_REVIEW_CAMPAIGN", new DefaultPolicy("DECIDE_ITEM", "IN_PROGRESS", "audit.review.manage", 100, true,
                "A person who manages audit trail reviews records a decision on an item of an in-progress campaign.",
                List.of(permission("audit.review.manage")))));
        m.put("AUDIT_REVIEW_CAMPAIGN|COMPLETE|IN_PROGRESS", new ModuleDefault("AUDIT_TRAIL", "AUDIT_REVIEW_CAMPAIGN", "AUDIT_REVIEW_CAMPAIGN", new DefaultPolicy("COMPLETE", "IN_PROGRESS", "audit.review.manage", 100, true,
                "The same person completes the campaign when no item is pending, with a signature.",
                List.of(permission("audit.review.manage")))));
        m.put("AUDIT_REVIEW_CAMPAIGN|CANCEL|IN_PROGRESS", new ModuleDefault("AUDIT_TRAIL", "AUDIT_REVIEW_CAMPAIGN", "AUDIT_REVIEW_CAMPAIGN", new DefaultPolicy("CANCEL", "IN_PROGRESS", "audit.review.manage", 100, true,
                "The same person cancels an in-progress campaign.",
                List.of(permission("audit.review.manage")))));
        m.put("UNCONTROLLED_COPY|DISTRIBUTE|READY_FOR_DISTRIBUTION", new ModuleDefault("DOCUMENT_CONTROL", "UNCONTROLLED_COPY", "UNCONTROLLED_COPY", new DefaultPolicy("DISTRIBUTE", "READY_FOR_DISTRIBUTION", "documents.uncontrolled_copy.distribute", 100, true,
                "A person who may distribute uncontrolled copies distributes a copy that is ready, with a signature.",
                List.of(permission("documents.uncontrolled_copy.distribute")))));
        m.put("UNCONTROLLED_COPY|CANCEL|READY_FOR_DISTRIBUTION", new ModuleDefault("DOCUMENT_CONTROL", "UNCONTROLLED_COPY", "UNCONTROLLED_COPY", new DefaultPolicy("CANCEL", "READY_FOR_DISTRIBUTION", "documents.uncontrolled_copy.cancel_request", 100, true,
                "A person who may cancel uncontrolled copy requests cancels a copy that is ready, with a reason and a signature.",
                List.of(permission("documents.uncontrolled_copy.cancel_request")))));
        m.put("TRAINING_ACTIVITY|START_TRAINING|NOTIFIED", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("START_TRAINING", "NOTIFIED", "", 100, true,
                "A conductor, in the department of the activity, starts the training with a signature, once the preparation is done and the tests are printed; the activity goes in progress.",
                List.of())));
        m.put("TRAINING_ACTIVITY|HOLD_SESSION|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("HOLD_SESSION", "IN_PROGRESS", "", 100, true,
                "A conductor, in the department of the activity, holds a session; the first one starts the activity, with a signature.",
                List.of())));
        m.put("TRAINING_ACTIVITY|RECORD_ATTENDANCE|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("RECORD_ATTENDANCE", "IN_PROGRESS", "", 100, true,
                "A conductor records the attendance of a person in a session that is being held.",
                List.of())));
        m.put("TRAINING_ACTIVITY|POSTPONE_SESSION|PLANNED", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("POSTPONE_SESSION", "PLANNED", "training.activity.organize", 100, true,
                "A person who organizes, in the department, moves a session that has not started, with a reason.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|POSTPONE_SESSION|NOTIFIED", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("POSTPONE_SESSION", "NOTIFIED", "training.activity.organize", 100, true,
                "A person who organizes, in the department, moves a session that has not started, with a reason.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|POSTPONE_SESSION|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("POSTPONE_SESSION", "IN_PROGRESS", "training.activity.organize", 100, true,
                "A person who organizes, in the department, moves a session that has not started, with a reason.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|UPDATE_SESSION|PLANNED", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("UPDATE_SESSION", "PLANNED", "training.activity.organize", 100, true,
                "A person who organizes, in the department, changes a session that has not started, with a reason.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|SET_CONTENT_EXEMPTIONS|PLANNED", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("SET_CONTENT_EXEMPTIONS", "PLANNED", "training.activity.organize", 100, true,
                "A person who organizes, in the department, sets the exemption of the materials or of the assessment, until the content is reviewed.",
                List.of(permission("training.activity.organize")))));
        m.put("TRAINING_ACTIVITY|RECORD_ASSESSMENT|IN_PROGRESS", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("RECORD_ASSESSMENT", "IN_PROGRESS", "training.assessment.record", 100, true,
                "A person who records assessments, in the department, writes the result of a participant while the training is in progress.",
                List.of(permission("training.assessment.record")))));
        m.put("TRAINING_ACTIVITY|DESIGNATE|ANY", new ModuleDefault("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", new DefaultPolicy("DESIGNATE", "ANY", "training.activity.organize", 100, true,
                "A person who organizes, in the department, designates the person of an approval step of the activity.",
                List.of(permission("training.activity.organize")))));
        MODULE_DEFAULTS = Collections.unmodifiableMap(m);
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
        if ("REPORT_TEMPLATE".equals(workflowKey)) {
            return REPORT_TEMPLATE_DEFAULTS.get(actionCode);
        }
        ModuleDefault generic = MODULE_DEFAULTS.get(workflowKey + "|" + actionCode + "|" + fromStatus);
        if (generic != null) return generic.policy();
        if (workflowKey != null && workflowKey.startsWith("TRAINING_")) {
            TrainingDefault found = TRAINING_DEFAULTS.get(workflowKey + "|" + actionCode + "|" + fromStatus);
            return found == null ? null : found.policy();
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

    /** The defaults of every module other than Document Control and Report: Training's own map and the generic one. */
    public static java.util.List<ModuleDefault> allModule() {
        java.util.List<ModuleDefault> out = new java.util.ArrayList<>();
        for (TrainingDefault d : TRAINING_DEFAULTS.values()) out.add(new ModuleDefault("TRAINING", d.workflowKey(), d.objectType(), d.policy()));
        out.addAll(MODULE_DEFAULTS.values());
        return out;
    }

    /** All Training defaults. */
    public static java.util.Collection<TrainingDefault> allTraining() {
        return TRAINING_DEFAULTS.values();
    }

    /** All Report template review defaults. */
    public static java.util.Collection<DefaultPolicy> allReportTemplate() {
        return REPORT_TEMPLATE_DEFAULTS.values();
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
