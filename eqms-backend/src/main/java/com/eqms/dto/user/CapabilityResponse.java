package com.eqms.dto.user;

public record CapabilityResponse(
        // Document module
        boolean canViewDocuments,
        boolean canCreateDocument,
        boolean canEditDocumentMetadata,
        boolean canSubmitRevision,
        boolean canReviewRevision,
        boolean canApproveRevision,
        boolean canPublishRevision,
        boolean canManageTraining,
        boolean canCompleteTraining,
        boolean canViewAuditTrail,

        // Controlled Copy
        boolean canRequestControlledCopy,
        boolean canDistributeControlledCopy,
        boolean canRecallControlledCopy,

        // Settings
        boolean canManageUsers,
        boolean canManageRoles,
        boolean canManageSystemConfiguration,
        boolean canManageEmailTemplates,
        boolean canManageDictionaries,
        boolean canViewSystemInfo,

        // Special
        boolean isSuperAdmin
) {
}
