package com.eqms.service;

import com.eqms.enums.WorkflowActorType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WorkspaceManagedRevisionPolicyTest {

    @Test
    void updateDraftMetadataUsesDedicatedPermission() {
        // No longer the catch-all documents.workspace.manage: split out so granting metadata
        // edit does not also grant submit/publish/training capabilities.
        var policy = WorkflowActionDefaultPolicyRegistry.get(
                "DOCUMENT_REVISION", "UPDATE_DRAFT_METADATA", "DRAFT");

        assertThat(policy).isNotNull();
        assertThat(policy.requiredPermissionCode()).isEqualTo("documents.revision.update_draft_metadata");
        assertThat(policy.actors()).singleElement().satisfies(actor -> {
            assertThat(actor.actorType()).isEqualTo(WorkflowActorType.PERMISSION);
            assertThat(actor.actorCode()).isEqualTo("documents.revision.update_draft_metadata");
        });
    }

    @Test
    void uploadSourceRequiresAssignedAuthorAndImmutablePermission() {
        var policy = WorkflowActionDefaultPolicyRegistry.get(
                "DOCUMENT_REVISION", "UPLOAD_SOURCE", "DRAFT");

        assertThat(policy).isNotNull();
        assertThat(policy.requiredPermissionCode()).isEqualTo("documents.revision.upload_source");
        assertThat(policy.actors()).singleElement().satisfies(actor -> {
            assertThat(actor.actorType()).isEqualTo(WorkflowActorType.AUTHOR);
            assertThat(actor.actorCode()).isNull();
        });
    }

    @Test
    void openPublishingWorkspaceUsesDedicatedPermission() {
        var policy = WorkflowActionDefaultPolicyRegistry.get(
                "DOCUMENT_REVISION", "OPEN_PUBLISHING_WORKSPACE", "READY_FOR_PUBLISHING");

        assertThat(policy).isNotNull();
        assertThat(policy.requiredPermissionCode()).isEqualTo("documents.revision.open_publishing_workspace");
        assertThat(policy.actors()).singleElement().satisfies(actor -> {
            assertThat(actor.actorType()).isEqualTo(WorkflowActorType.PERMISSION);
            assertThat(actor.actorCode()).isEqualTo("documents.revision.open_publishing_workspace");
        });
    }

    @Test
    void submitForReviewUsesDedicatedPermission() {
        var policy = WorkflowActionDefaultPolicyRegistry.get(
                "DOCUMENT_REVISION", "SUBMIT_FOR_REVIEW", "DRAFT");

        assertThat(policy).isNotNull();
        // The Author submits by default (Complete Editing is retired). Deliberately NOT DCO/DOCUMENT_CONTROLLER: adding Document
        // Control back is business configuration in Workflow Authorization, never a hard-coded system default. The permission
        // is its OWN dedicated one, not the catch-all documents.workspace.manage (V347).
        assertThat(policy.requiredPermissionCode()).isEqualTo("documents.revision.submit_review");
        assertThat(policy.actors()).singleElement().satisfies(actor -> {
            assertThat(actor.actorType()).isEqualTo(WorkflowActorType.AUTHOR);
            assertThat(actor.actorCode()).isNull();
        });
    }
}
