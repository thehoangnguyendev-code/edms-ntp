package com.eqms.service;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * Single source of truth for "does this candidate hold the permission that lets them act as
 * REVIEWER/APPROVER" -- shared by Document Master (next-revision participant configuration) and
 * Revision (draft participant assignment) so the two enforcement points can never silently diverge.
 * Author/Co-author/SoD exclusions are enforced separately by each caller's own validation.
 */
@Service
public class WorkflowParticipantEligibilityService {

    private final PermissionEvaluationService permissionEvaluationService;

    public WorkflowParticipantEligibilityService(PermissionEvaluationService permissionEvaluationService) {
        this.permissionEvaluationService = permissionEvaluationService;
    }

    public void requirePoolMembership(String poolType, UserAccount user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException(poolType + " user not found");
        }
        String requiredPermission = "APPROVER".equalsIgnoreCase(poolType)
                ? "documents.revision.approve"
                : "documents.revision.review";
        if (!permissionEvaluationService.hasPermission(user, requiredPermission)) {
            throw new IllegalArgumentException("Selected " + poolType.toLowerCase(Locale.ROOT) + " does not have the required permission");
        }
    }
}
