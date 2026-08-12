package com.eqms.service;

import com.eqms.dto.user.CapabilityResponse;
import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Service;

@Service
public class CapabilityService {

    private final PermissionEvaluationService permissionEvaluationService;

    public CapabilityService(PermissionEvaluationService permissionEvaluationService) {
        this.permissionEvaluationService = permissionEvaluationService;
    }

    public CapabilityResponse getCapabilities(UserAccount user) {
        boolean superAdmin = permissionEvaluationService.isSuperAdmin(user);
        return new CapabilityResponse(
                has(user, "documents.module.view"),
                has(user, "documents.document.create"),
                has(user, "documents.document.edit_metadata"),
                has(user, "documents.revision.submit_review"),
                has(user, "documents.revision.review"),
                has(user, "documents.revision.approve"),
                has(user, "documents.revision.publish"),
                has(user, "documents.training.manage"),
                has(user, "documents.training.complete"),
                has(user, "documents.document.view_audit"),
                has(user, "documents.controlled_copy.request"),
                has(user, "documents.controlled_copy.distribute"),
                has(user, "documents.controlled_copy.recall"),
                hasAny(user,
                        "settings.user.create",
                        "settings.user.edit",
                        "settings.user.delete",
                        "settings.user.reset_password",
                        "settings.user.force_logout"),
                hasAny(user,
                        "security.access_profiles.update",
                        "security.access_profiles.assign",
                        "security.permission_sets.update",
                        "security.workflow_authorization.manage",
                        "security.object_rules.manage",
                        "security.sod.manage"),
                hasAny(user, "settings.configuration.edit", "settings.configuration.manage"),
                hasAny(user, "settings.email_template.manage", "settings.configuration.edit"),
                hasAny(user, "settings.dictionary.manage", "settings.configuration.edit"),
                hasAny(user, "settings.system_info.view", "settings.configuration.view"),
                superAdmin
        );
    }

    private boolean has(UserAccount user, String code) {
        return permissionEvaluationService.hasPermission(user, code);
    }

    private boolean hasAny(UserAccount user, String... codes) {
        return permissionEvaluationService.hasAnyPermission(user, codes);
    }
}
