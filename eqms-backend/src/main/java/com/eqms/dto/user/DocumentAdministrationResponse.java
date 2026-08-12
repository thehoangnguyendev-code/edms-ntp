package com.eqms.dto.user;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record DocumentAdministrationResponse(
        boolean reviewerNoApprove,
        boolean requireTwoReviewers,
        boolean requireOneApprover,
        boolean authorCannotBeReviewerOrApprover,
        boolean coAuthorCannotBeReviewerOrApprover,
        boolean sameUserCannotHoldMultipleWorkflowRoles,
        @JsonProperty("workflowCoordinatorCannotBeReviewerOrApprover")
        boolean dcoCannotBeReviewerOrApprover,
        boolean reviewerAndApproverDifferentDepartments,
        List<String> dcoUserIds,
        List<String> reviewerUserIds,
        List<String> approverUserIds,
        List<DocumentAdministrationRuleResponse> sodRules,
        long version
) {
}
