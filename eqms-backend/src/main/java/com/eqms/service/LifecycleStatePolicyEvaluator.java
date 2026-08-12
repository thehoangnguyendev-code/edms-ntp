package com.eqms.service;

import com.eqms.entity.LifecycleStatePolicy;
import com.eqms.entity.UserAccount;
import com.eqms.enums.LifecycleActorScope;
import com.eqms.enums.LifecycleCapability;
import com.eqms.repository.LifecycleStatePolicyRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Evaluates lifecycle state policies (Veeva-style state-based security).
 * Additive ALLOW-only model: the capability is granted when ANY active matching
 * policy row passes both its actor-scope and required-permission checks.
 * Admin bypass (doc-admin/DCO/superadmin) is handled by callers before delegating here.
 */
@Service
public class LifecycleStatePolicyEvaluator {

    private static final String MODULE = "documents";
    private static final String OBJECT_TYPE = "DOCUMENT_REVISION";

    private final LifecycleStatePolicyRepository policyRepository;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    private final PermissionEvaluationService permissionEvaluationService;

    public LifecycleStatePolicyEvaluator(
            LifecycleStatePolicyRepository policyRepository,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            PermissionEvaluationService permissionEvaluationService) {
        this.policyRepository = policyRepository;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    public boolean canPerform(
            UserAccount user,
            LifecycleCapability capability,
            String statusCode,
            UUID documentTypeId,
            UUID revisionId,
            UUID authorId
    ) {
        return canPerform(user, OBJECT_TYPE, capability, statusCode, documentTypeId, revisionId, authorId);
    }

    /**
     * Generalized evaluation for any object type sharing this table (e.g. DOCUMENT master,
     * not just DOCUMENT_REVISION). PARTICIPANT actor scope only resolves against revisionId —
     * callers for object types without workflow participants (e.g. DOCUMENT) should only seed
     * ANY/AUTHOR-scoped rows.
     */
    public boolean canPerform(
            UserAccount user,
            String objectType,
            LifecycleCapability capability,
            String statusCode,
            UUID documentTypeId,
            UUID revisionId,
            UUID authorId
    ) {
        if (user == null || user.getId() == null || capability == null) {
            return false;
        }
        List<LifecycleStatePolicy> policies = policyRepository
                .findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                        MODULE, objectType, capability.name());
        Boolean participantCache = null;
        for (LifecycleStatePolicy policy : policies) {
            if (policy.getStatusCode() != null && !policy.getStatusCode().equalsIgnoreCase(statusCode)) {
                continue;
            }
            if (policy.getDocumentTypeId() != null && !Objects.equals(policy.getDocumentTypeId(), documentTypeId)) {
                continue;
            }
            boolean scopeOk;
            switch (LifecycleActorScope.valueOf(policy.getActorScope())) {
                case ANY -> scopeOk = true;
                case AUTHOR -> scopeOk = authorId != null && Objects.equals(authorId, user.getId());
                case PARTICIPANT -> {
                    if (participantCache == null) {
                        participantCache = revisionId != null
                                && revisionWorkflowParticipantRepository
                                        .countByRevision_IdAndUser_Id(revisionId, user.getId()) > 0;
                    }
                    scopeOk = participantCache;
                }
                default -> scopeOk = false;
            }
            if (!scopeOk) {
                continue;
            }
            String permission = policy.getRequiredPermissionCode();
            if (StringUtils.hasText(permission) && !permissionEvaluationService.hasPermission(user, permission)) {
                continue;
            }
            return true;
        }
        return false;
    }
}
