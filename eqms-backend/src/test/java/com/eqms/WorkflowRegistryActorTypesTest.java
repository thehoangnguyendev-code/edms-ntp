package com.eqms;

import com.eqms.enums.WorkflowActorType;
import com.eqms.service.workflow.DocumentsWorkflowDefinitionProvider;
import com.eqms.service.workflow.WorkflowRegistryService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Which actor types a Revision workflow action allows in a policy (the registry the policy editor and the policy validation read). */
class WorkflowRegistryActorTypesTest {

    private final WorkflowRegistryService registry = new WorkflowRegistryService(List.of(new DocumentsWorkflowDefinitionProvider()));

    private boolean allowed(String action, WorkflowActorType type) {
        return registry.getAllowedActorTypes("DOCUMENT_REVISION", action).contains(type);
    }

    @Test
    void authorMayUploadSource_ownerMayNot() {
        assertThat(allowed("UPLOAD_SOURCE", WorkflowActorType.AUTHOR)).isTrue();
        assertThat(allowed("UPLOAD_SOURCE", WorkflowActorType.OWNER)).isFalse();
    }

    @Test
    void onlyTheAssignedReviewerCompletesAReview() {
        assertThat(allowed("COMPLETE_REVIEW", WorkflowActorType.ASSIGNED_REVIEWER)).isTrue();
        assertThat(allowed("COMPLETE_REVIEW", WorkflowActorType.ASSIGNED_APPROVER)).isFalse();
    }

    @Test
    void theAuthorDoesNotPublish() {
        assertThat(allowed("PUBLISH", WorkflowActorType.AUTHOR)).isFalse();
    }
}
