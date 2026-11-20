package com.eqms.service;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class TrainingAuthorizationService {

    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentAuthorizationService documentAuthorizationService;

    public TrainingAuthorizationService(
            PermissionEvaluationService permissionEvaluationService,
            DocumentAuthorizationService documentAuthorizationService
    ) {
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentAuthorizationService = documentAuthorizationService;
    }

    public boolean canCompleteRevisionTraining(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || revision == null) {
            return false;
        }
        if (!documentAuthorizationService.canViewRevision(user, revision)) {
            return false;
        }
        return permissionEvaluationService.hasAnyPermission(
                user,
                "documents.training.complete",
                "documents.training.manage",
                "training.material.manage"
        );
    }

    public void requireCanCompleteRevisionTraining(UserAccount user, DocumentRevisionRecord revision) {
        if (!canCompleteRevisionTraining(user, revision)) {
            throw new AccessDeniedException("Current user is not allowed to complete revision training");
        }
    }
}
