package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.*;
import com.eqms.entity.UserAccount;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class EffectiveAccessDiagnosisService {
    private final CurrentUserService currentUser; private final PermissionEvaluationService permissions;
    private final UserAccountRepository users; private final DocumentRevisionRepository revisions;
    private final RevisionWorkflowAuthorizationService revisionAuthorization;
    private final EffectivePermissionService effectivePermissions;
    private final ObjectAccessEvaluationService objectAccess;
    private final ControlledCopyAuthorizationService controlledCopies;
    public EffectiveAccessDiagnosisService(CurrentUserService currentUser, PermissionEvaluationService permissions, UserAccountRepository users, DocumentRevisionRepository revisions, RevisionWorkflowAuthorizationService revisionAuthorization, EffectivePermissionService effectivePermissions, ObjectAccessEvaluationService objectAccess, ControlledCopyAuthorizationService controlledCopies) {
        this.currentUser=currentUser; this.permissions=permissions; this.users=users; this.revisions=revisions; this.revisionAuthorization=revisionAuthorization; this.effectivePermissions=effectivePermissions; this.objectAccess=objectAccess; this.controlledCopies=controlledCopies;
    }
    @Transactional(readOnly = true)
    public EffectiveAccessDiagnosisResponse diagnose(EffectiveAccessDiagnosisRequest request) {
        UserAccount actor=currentUser.requireCurrentUser();
        if (!permissions.hasPermission(actor, "security.access_profiles.update")) throw new AccessDeniedException("Access profile management permission required");
        UserAccount subject=users.findById(request.subjectUserId()).orElseThrow(() -> new IllegalArgumentException("Subject user not found"));
        String resourceType = request.resourceType().trim().toUpperCase(java.util.Locale.ROOT);
        if ("CONTROLLED_COPY".equals(resourceType) || "CONTROLLED_COPY_BATCH".equals(resourceType)) {
            return diagnoseControlledCopy(subject, request, resourceType);
        }
        if (!"DOCUMENT_REVISION".equals(resourceType)) throw new IllegalArgumentException("Unsupported resource type: " + request.resourceType());
        var revision=revisions.findById(request.resourceId()).orElseThrow(() -> new IllegalArgumentException("Revision not found"));
        RevisionWorkflowAction action=RevisionWorkflowAction.valueOf(request.actionCode().trim().toUpperCase());
        var decision=revisionAuthorization.check(subject, revision, action, RevisionWorkflowAuthorizationContext.of(revision));
        String state=revision.getStatus()==null?null:revision.getStatus().getCode();
        var effective = effectivePermissions.getEffectivePermissionResult(subject);
        List<EffectiveAccessDiagnosisLayer> layers = new ArrayList<>();
        boolean active = subject.getStatus() != null && subject.getStatus().name().equalsIgnoreCase("Active");
        layers.add(new EffectiveAccessDiagnosisLayer("USER_ACTIVE", active,
                active ? null : "USER_INACTIVE", active ? "User account is active." : "User account is inactive."));
        boolean inScope = objectAccess.canAccessRevision(subject, revision, "VIEW");
        layers.add(new EffectiveAccessDiagnosisLayer("OBJECT_SCOPE", inScope,
                inScope ? null : "OUT_OF_SCOPE", inScope ? "Subject is within object scope." : "Subject is outside object scope."));
        String permission = decision.permissionCode();
        boolean hasPermission = permission == null || effective.systemSuperAdmin() || permissions.hasPermission(subject, permission);
        layers.add(new EffectiveAccessDiagnosisLayer("PERMISSION", hasPermission,
                hasPermission ? null : "MISSING_PERMISSION", effective.systemSuperAdmin()
                        ? "SYSTEM_SUPER_ADMIN bypasses the permission layer only."
                        : hasPermission ? "Required permission is effective." : "Required permission is not effective."));
        boolean stateValid = !"INVALID_WORKFLOW_STATE".equals(decision.reasonCode());
        layers.add(new EffectiveAccessDiagnosisLayer("WORKFLOW_STATE", stateValid,
                stateValid ? null : decision.reasonCode(), stateValid ? "Workflow state is valid for the action." : decision.message()));
        layers.add(new EffectiveAccessDiagnosisLayer("ACTOR_AND_SOD", decision.allowed(),
                decision.allowed() ? null : decision.reasonCode(), decision.allowed()
                        ? "Actor and workflow constraints passed." : decision.message()));
        return new EffectiveAccessDiagnosisResponse(subject.getId(), "DOCUMENT_REVISION", revision.getId(), action.name(), state,
                decision.allowed(), decision.reasonCode(), decision.message(), permission,
                effective.systemSuperAdmin(), requiresESignature(action), layers);
    }

    private EffectiveAccessDiagnosisResponse diagnoseControlledCopy(
            UserAccount subject, EffectiveAccessDiagnosisRequest request, String resourceType
    ) {
        ControlledCopyWorkflowAction action = ControlledCopyWorkflowAction.valueOf(request.actionCode().trim().toUpperCase());
        var decision = "CONTROLLED_COPY".equals(resourceType)
                ? controlledCopies.diagnoseCopyAction(subject, request.resourceId(), action)
                : controlledCopies.diagnoseBatchAction(subject, request.resourceId(), action);
        var effective = effectivePermissions.getEffectivePermissionResult(subject);
        boolean active = subject.getStatus() != null && subject.getStatus().name().equalsIgnoreCase("Active");
        boolean permission = decision.requiredPermissionCode() == null || effective.systemSuperAdmin()
                || permissions.hasPermission(subject, decision.requiredPermissionCode());
        List<EffectiveAccessDiagnosisLayer> layers = List.of(
                new EffectiveAccessDiagnosisLayer("USER_ACTIVE", active, active ? null : "USER_INACTIVE",
                        active ? "User account is active." : "User account is inactive."),
                new EffectiveAccessDiagnosisLayer("PERMISSION", permission, permission ? null : "MISSING_PERMISSION",
                        effective.systemSuperAdmin() ? "SYSTEM_SUPER_ADMIN bypasses the permission layer only."
                                : permission ? "Required permission is effective." : "Required permission is not effective."),
                new EffectiveAccessDiagnosisLayer("LIFECYCLE_SCOPE_ACTOR", decision.allowed(),
                        decision.allowed() ? null : decision.reasonCode(), decision.allowed()
                                ? "Lifecycle, source-document scope and actor constraints passed." : decision.message())
        );
        return new EffectiveAccessDiagnosisResponse(subject.getId(), resourceType, request.resourceId(), action.name(),
                decision.status(), decision.allowed(), decision.reasonCode(), decision.message(),
                decision.requiredPermissionCode(), effective.systemSuperAdmin(), requiresESignature(action), layers);
    }

    private boolean requiresESignature(RevisionWorkflowAction action) {
        return switch (action) {
            case COMPLETE_AUTHORING, SUBMIT_FOR_REVIEW, COMPLETE_REVIEW, REJECT_REVIEW,
                    COMPLETE_APPROVAL, REJECT_APPROVAL, COMPLETE_TRAINING, PUBLISH,
                    CANCEL, UPGRADE_REVISION -> true;
            default -> false;
        };
    }

    private boolean requiresESignature(ControlledCopyWorkflowAction action) {
        return switch (action) {
            case DISTRIBUTE_COPY, RECALL_COPY, REPORT_LOST_DAMAGED, REPLACE_LOST_DAMAGED,
                    EXPIRE_COPY, CANCEL_REQUEST, DISTRIBUTE_BATCH, RECALL_BATCH -> true;
            default -> false;
        };
    }
}
