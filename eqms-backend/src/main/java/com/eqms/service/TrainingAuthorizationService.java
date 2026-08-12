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

    public boolean canViewTrainingModule(UserAccount user) {
        return permissionEvaluationService.hasAnyPermission(
                user,
                "training.module.view",
                "training.material.manage"
        );
    }

    public void requireCanViewTrainingModule(UserAccount user) {
        if (!canViewTrainingModule(user)) {
            throw new AccessDeniedException("Current user is not allowed to access the Training module");
        }
    }

    public boolean canManageTrainingCatalog(UserAccount user) {
        return permissionEvaluationService.hasPermission(user, "training.material.manage");
    }

    public void requireCanManageTrainingCatalog(UserAccount user) {
        if (!canManageTrainingCatalog(user)) {
            throw new AccessDeniedException("Current user is not allowed to manage training materials or courses");
        }
    }

    public boolean canManageDocumentTrainingPlan(UserAccount user) {
        return permissionEvaluationService.hasAnyPermission(
                user,
                "documents.training.manage",
                "training.material.manage"
        );
    }

    public void requireCanManageDocumentTrainingPlan(UserAccount user) {
        if (!canManageDocumentTrainingPlan(user)) {
            throw new AccessDeniedException("Current user is not allowed to manage document training plans");
        }
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
