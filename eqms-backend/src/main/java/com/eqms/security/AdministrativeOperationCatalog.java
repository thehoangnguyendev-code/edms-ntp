package com.eqms.security;

import java.util.Map;
import java.util.Set;

/**
 * Explicitly reviewed administrative handler methods. Other operations are not
 * classified by URL prefix: shared controllers also serve normal workflows.
 * Dedicated administration controllers are protected as a whole; shared
 * controllers use explicit method sets so workflow lookups remain accessible.
 */
public final class AdministrativeOperationCatalog {
    private AdministrativeOperationCatalog() {}
    private static final Set<String> ADMIN_CONTROLLERS = Set.of(
            "AdministrativeNetworkPolicyController", "NotificationPolicyController", "SecurityAccessProfileController",
            "SecurityPermissionSetController", "LifecycleStatePolicyController", "ObjectAccessRuleController",
            "SodConstraintController", "WorkflowActionPolicyController", "ReportConfigurationController",
            "EmailTemplateController", "StorageUsageController", "SettingsAnnouncementController",
            "AccessReviewController", "AuthorizationParticipantReconciliationController",
            "AuthorizationShadowEvaluationController", "EffectiveAccessDiagnosisController",
            "BackupAlertController", "BackupDrDrillController", "BackupDrPlanController", "BackupExportController",
            "BackupInspectionController", "BackupPolicyController", "BackupRehearsalController",
            "BackupRestoreController", "BackupRestoreRequestController", "BackupRestoreRulesController",
            "ReportPropertiesController", "ReportNameFormatController", "ReportTypeController",
            "ReportLayoutController", "KnowledgeHierarchyController", "KnowledgeComponentController"
    );

    private static final Map<String, Set<String>> METHODS = Map.ofEntries(
            Map.entry("com.eqms.controller.SettingsUserController", Set.of(
                    "createUser", "updateUser", "deleteUser", "suspendUser", "terminateUser",
                    "reinstateUser", "resetPassword", "unlockUser", "forceLogout",
                    "createTimeLimitedGrants", "updateTimeLimitedGrant", "cancelTimeLimitedGrant",
                    "updateRole", "updateDocumentAdministration", "getSystemConfiguration",
                    "getStoragePathPreview", "updateSystemConfiguration", "updateDocumentPropertiesConfig")),
            Map.entry("com.eqms.controller.DocumentTypeAdminController", Set.of(
                    "createDocumentType", "updateDocumentType", "createDocumentSubType", "updateDocumentSubType")),
            Map.entry("com.eqms.controller.SecurityAccessProfileController", Set.of(
                    "create", "createFull", "updateConfiguration", "setManagedPermissions",
                    "update", "delete", "duplicate", "toggleStatus", "setPermissionSets",
                    "addPermissionSet", "removePermissionSet", "setWorkflowRoles", "addWorkflowRole",
                    "removeWorkflowRole", "assignUser", "removeUser")),
            Map.entry("com.eqms.controller.ElectronicSignatureSettingsController", Set.of("getSettings", "saveSettings")),
            Map.entry("com.eqms.controller.StorageUsageController", Set.of("history", "policy", "savePolicy", "status")),
            Map.entry("com.eqms.controller.ConfigurationController", Set.of("updateSecurityConfiguration")),
            Map.entry("com.eqms.controller.AuthBackgroundVideoController", Set.of("upload", "preview")),
            Map.entry("com.eqms.controller.DashboardRoleLayoutController", Set.of("list", "roles", "save")),
            Map.entry("com.eqms.controller.SettingsDictionaryController", Set.of("createBusinessUnit", "updateBusinessUnit", "createDepartment", "updateDepartment", "createPosition", "updatePosition", "deletePosition", "createStorageLocation", "updateStorageLocation", "deleteStorageLocation", "createRetentionPolicy", "updateRetentionPolicy", "deleteRetentionPolicy")),
            Map.entry("com.eqms.controller.DocumentNameFormatController", Set.of("createFormat", "updateFormat", "createComponent", "updateComponent")),
            Map.entry("com.eqms.controller.SettingsEducationController", Set.of("createDegreeLevel", "updateDegreeLevel", "deleteDegreeLevel", "createSchool", "updateSchool", "deleteSchool")),
            Map.entry("com.eqms.controller.training.TrainingSettingsController", Set.of("get", "update")),
            Map.entry("com.eqms.controller.SecurityPermissionSetController", Set.of("create", "update", "delete")),
            Map.entry("com.eqms.controller.SodConstraintController", Set.of("create", "update", "delete", "recordScan")),
            Map.entry("com.eqms.controller.ObjectAccessRuleController", Set.of("create", "update", "delete")),
            Map.entry("com.eqms.controller.LifecycleStatePolicyController", Set.of("create", "update", "delete")),
            Map.entry("com.eqms.controller.WorkflowRoleController", Set.of("createCatalogEntry", "updateCatalogEntry", "deactivateCatalogEntry")),
            Map.entry("com.eqms.controller.WorkflowActionPolicyController", Set.of("createPolicy", "updatePolicy", "createDocumentTypeOverride", "duplicatePolicy", "activate", "deactivate", "resetToDefault")),
            Map.entry("com.eqms.controller.ControlledCopyPolicyController", Set.of("getPolicy", "savePolicy", "markingPreview")),
            Map.entry("com.eqms.controller.UncontrolledCopyPolicyController", Set.of("getPolicy", "savePolicy", "markingPreview", "listEligibilityRules", "listEligibilityRulesPaged", "createEligibilityRule", "updateEligibilityRule", "deleteEligibilityRule")),
            Map.entry("com.eqms.controller.ReportConfigurationController", Set.of("list", "get", "update", "updateFields", "history")),
            Map.entry("com.eqms.controller.EmailTemplateController", Set.of("getAllTemplates", "exportTemplates", "getTemplateById", "createTemplate", "updateTemplate", "deleteTemplate", "duplicateTemplate", "toggleStatus", "getVersionHistory", "publishTemplate", "restoreTemplateVersion", "previewTemplate", "previewDraftTemplate", "testSendTemplate")),
            Map.entry("com.eqms.controller.PublishingTemplateController", Set.of("savePlaceholderStyles", "deletePlaceholderStyle", "createTemplate", "updateTemplate", "duplicateTemplate", "createNewVersion", "toggleStatus", "deleteTemplate", "uploadComponent", "deleteComponent", "publishTemplate"))
    );

    public static boolean isReviewedAdministrativeMethod(Class<?> controller, String methodName) {
        if (controller == null) return false;
        return controller.getPackageName().equals("com.eqms.controller") && ADMIN_CONTROLLERS.contains(controller.getSimpleName())
                || METHODS.getOrDefault(controller.getName(), Set.of()).contains(methodName);
    }
}
