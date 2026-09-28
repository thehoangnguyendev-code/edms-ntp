package com.eqms.dto.user;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public record DocumentAdministrationRequest(
        boolean reviewerNoApprove,
        boolean authorCannotBeReviewerOrApprover,
        boolean coAuthorCannotBeReviewerOrApprover,
        boolean sameUserCannotHoldMultipleWorkflowRoles,
        @JsonProperty("workflowCoordinatorCannotBeReviewerOrApprover")
        @JsonAlias("dcoCannotBeReviewerOrApprover")
        boolean dcoCannotBeReviewerOrApprover,
        boolean reviewerAndApproverDifferentDepartments,
        String reason,
        String signatureToken
) {
}
