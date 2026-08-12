package com.eqms.dto.user;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record DocumentAdministrationRequest(
        boolean reviewerNoApprove,
        boolean requireTwoReviewers,
        boolean requireOneApprover,
        boolean authorCannotBeReviewerOrApprover,
        boolean coAuthorCannotBeReviewerOrApprover,
        boolean sameUserCannotHoldMultipleWorkflowRoles,
        @JsonProperty("workflowCoordinatorCannotBeReviewerOrApprover")
        @JsonAlias("dcoCannotBeReviewerOrApprover")
        boolean dcoCannotBeReviewerOrApprover,
        boolean reviewerAndApproverDifferentDepartments,
        List<String> dcoUserIds,
        List<String> reviewerUserIds,
        List<String> approverUserIds,
        String reason,
        String signatureToken
) {
}
