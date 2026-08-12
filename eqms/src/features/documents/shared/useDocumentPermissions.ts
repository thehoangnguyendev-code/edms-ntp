import { useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export const DOCUMENT_PERMISSION_CODES = {
  moduleView: 'documents.module.view',
  view: 'documents.document.view',
  viewAudit: 'documents.document.view_audit',
  createShell: 'documents.document.create',
  editMetadata: 'documents.document.edit_metadata',
  manageReviewCycle: 'documents.document.edit_metadata',
  uploadRevisionFile: 'documents.revision.upload_source',
  uploadToOfficeOnline: 'documents.revision.upload_office_online',
  editFileOnline: 'documents.revision.edit_online',
  submitRevision: 'documents.revision.submit_review',
  cancelRevision: 'documents.revision.cancel',
  completeReview: 'documents.revision.review',
  rejectReview: 'documents.revision.reject_review',
  rejectApproval: 'documents.revision.reject_approval',
  approveRevision: 'documents.revision.approve',
  manageTrainingPlan: 'documents.training.manage',
  completeTraining: 'documents.training.complete',
  publishRevision: 'documents.revision.publish',
  openPublishingWorkspace: 'documents.revision.open_publishing_workspace',
  viewFinalPdfPreview: 'documents.document.preview_published',
  // Matches the actual backend enforcement (requireCanManageDocumentWorkspace) and the
  // workflow_action_policies row for DOCUMENT/OBSOLETE — not documents.document.obsolete,
  // which the button previously read but the mutation never checked.
  obsoleteDocument: 'documents.workspace.manage',
  cancelDocument: 'documents.document.cancel',
  requestControlledCopy: 'documents.controlled_copy.request',
  manageWorkspace: 'documents.workspace.manage',
  // The DOCUMENT/UPDATE_METADATA workflow_action_policies row was split out of the catch-all
  // documents.workspace.manage into its own permission (V347) so granting metadata edit no
  // longer implies Obsolete/Publish/etc. This key drives canAdministerDocumentWorkspace below.
  updateDocumentMetadata: 'documents.document.update_metadata',
  configureInitialDocumentWorkflow: 'documents.document.configure_initial_workflow',
  configureNextRevisionReviewers: 'documents.revision.configure_next_reviewers',
  configureNextRevisionApprovers: 'documents.revision.configure_next_approvers',
  configureNextRevisionRelatedDocuments: 'documents.revision.configure_next_related_documents',
  configureNextRevisionCorrelatedDocuments: 'documents.revision.configure_next_correlated_documents',
  accessDocumentAdministration: 'documents.admin.view',
  manageDocumentWorkflowRoles: 'documents.admin.manage_workflow_roles',
  manageDocumentSodConstraints: 'security.sod.manage',
  useDocumentTemplate: 'documents.template.use',
  manageDocumentTemplate: 'documents.template.manage',
} as const;

export function useDocumentPermissions() {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions, isAdministrator, isSuperAdmin } = usePermissions();
  // Document Control operations are intentionally a dedicated RBAC capability.
  // Metadata-edit or administration-view permissions must never be treated as
  // an implicit DCO/workspace grant.
  const canAdministerDocumentWorkspace = hasPermission(DOCUMENT_PERMISSION_CODES.updateDocumentMetadata);
  const canManageAllDraftRevisions = canAdministerDocumentWorkspace;

  return useMemo(() => ({
    user,
    isAdministrator,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAdministerDocumentWorkspace,
    canManageAllDraftRevisions,
    canAccessDocumentModule: hasPermission(DOCUMENT_PERMISSION_CODES.moduleView),
    canViewDocuments: hasPermission(DOCUMENT_PERMISSION_CODES.view),
    canCreateDocumentShell: hasPermission(DOCUMENT_PERMISSION_CODES.createShell),
    canEditDocumentMetadata: hasPermission(DOCUMENT_PERMISSION_CODES.editMetadata),
    canManageReviewCycle: hasPermission(DOCUMENT_PERMISSION_CODES.manageReviewCycle),
    canUploadRevisionFile: hasPermission(DOCUMENT_PERMISSION_CODES.uploadRevisionFile),
    canUploadToOfficeOnline: hasPermission(DOCUMENT_PERMISSION_CODES.uploadToOfficeOnline),
    canEditFileOnline: hasPermission(DOCUMENT_PERMISSION_CODES.editFileOnline),
    canSubmitRevision: hasPermission(DOCUMENT_PERMISSION_CODES.submitRevision),
    canCancelRevision: hasPermission(DOCUMENT_PERMISSION_CODES.cancelRevision),
    canCompleteReview: hasPermission(DOCUMENT_PERMISSION_CODES.completeReview),
    canRejectReview: hasPermission(DOCUMENT_PERMISSION_CODES.rejectReview),
    canRejectApproval: hasPermission(DOCUMENT_PERMISSION_CODES.rejectApproval),
    // Retained for existing screens. New workflow screens must use the step-specific flags above.
    canRejectRevision: hasAnyPermission([
      DOCUMENT_PERMISSION_CODES.rejectReview,
      DOCUMENT_PERMISSION_CODES.rejectApproval,
    ]),
    canApproveRevision: hasPermission(DOCUMENT_PERMISSION_CODES.approveRevision),
    canManageTrainingPlan: hasPermission(DOCUMENT_PERMISSION_CODES.manageTrainingPlan),
    canCompleteTraining: hasPermission(DOCUMENT_PERMISSION_CODES.completeTraining),
    canPublishRevision: hasPermission(DOCUMENT_PERMISSION_CODES.publishRevision),
    canOpenPublishingWorkspace: hasPermission(DOCUMENT_PERMISSION_CODES.openPublishingWorkspace),
    canViewFinalPdfPreview: hasPermission(DOCUMENT_PERMISSION_CODES.viewFinalPdfPreview),
    canObsoleteDocument: hasPermission(DOCUMENT_PERMISSION_CODES.obsoleteDocument),
    canCancelDocument: hasPermission(DOCUMENT_PERMISSION_CODES.cancelDocument),
    canRequestControlledCopy: hasPermission(DOCUMENT_PERMISSION_CODES.requestControlledCopy),
    canConfigureInitialDocumentWorkflow: hasPermission(DOCUMENT_PERMISSION_CODES.configureInitialDocumentWorkflow),
    canConfigureNextRevisionReviewers: hasPermission(DOCUMENT_PERMISSION_CODES.configureNextRevisionReviewers),
    canConfigureNextRevisionApprovers: hasPermission(DOCUMENT_PERMISSION_CODES.configureNextRevisionApprovers),
    canConfigureNextRevisionRelatedDocuments: hasPermission(DOCUMENT_PERMISSION_CODES.configureNextRevisionRelatedDocuments),
    canConfigureNextRevisionCorrelatedDocuments: hasPermission(DOCUMENT_PERMISSION_CODES.configureNextRevisionCorrelatedDocuments),
    canAccessDocumentAdministration: hasPermission(DOCUMENT_PERMISSION_CODES.accessDocumentAdministration),
    canManageDocumentWorkflowRoles: hasPermission(DOCUMENT_PERMISSION_CODES.manageDocumentWorkflowRoles),
    canUseDocumentTemplate: hasAnyPermission([
      DOCUMENT_PERMISSION_CODES.useDocumentTemplate,
      DOCUMENT_PERMISSION_CODES.manageDocumentTemplate,
    ]),
    canManageDocumentTemplate: hasPermission(DOCUMENT_PERMISSION_CODES.manageDocumentTemplate),
    canManageDocumentSodConstraints: hasPermission(DOCUMENT_PERMISSION_CODES.manageDocumentSodConstraints),
  }), [
    user,
    isAdministrator,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAdministerDocumentWorkspace,
    canManageAllDraftRevisions,
  ]);
}
