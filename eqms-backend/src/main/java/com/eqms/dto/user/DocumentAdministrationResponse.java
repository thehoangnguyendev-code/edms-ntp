package com.eqms.dto.user;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record DocumentAdministrationResponse(
        boolean reviewerNoApprove,
        boolean authorCannotBeReviewerOrApprover,
        boolean coAuthorCannotBeReviewerOrApprover,
        boolean sameUserCannotHoldMultipleWorkflowRoles,
        @JsonProperty("workflowCoordinatorCannotBeReviewerOrApprover")
        boolean dcoCannotBeReviewerOrApprover,
        boolean reviewerAndApproverDifferentDepartments,
        List<DocumentAdministrationRuleResponse> sodRules,
        long version
) {
}
