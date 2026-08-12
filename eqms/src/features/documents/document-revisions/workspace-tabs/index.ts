/**
 * Revision Workspace Tabs
 *
 * All tab components used in RevisionWorkspaceView are exported from here.
 * Workspace-specific tabs live in this directory.
 * Shared tabs are re-exported so the workspace imports from one place.
 */

// Revision-specific DocumentTab
export { DocumentTab } from './DocumentTab';
export type { DocumentTabProps } from './DocumentTab';

// Workspace-specific new tabs
export { WorkingNotesTab } from './WorkingNotesTab';
export { InfoFromDocumentTab } from './InfoFromDocumentTab';
export { RevisionWorkspaceReviewersTab } from './RevisionWorkspaceReviewersTab';
export { RevisionWorkspaceApproversTab } from './RevisionWorkspaceApproversTab';

// Revision-local general/audit tabs
export { GeneralTab } from './GeneralTab';
export type { GeneralTabFormData } from './GeneralTab';

// Revision workspace-local tab implementations (identical UI to detail-revision/tabs)
export { GeneralInformationTab } from './GeneralInformationTab';
export type { GeneralInformationDocumentDetail } from './GeneralInformationTab';
export { TrainingInformationTab } from './TrainingInformationTab';
export type { TrainingInformationValue } from './TrainingInformationTab';
export { SignaturesTab } from './SignaturesTab';
export { AuditTab as AuditTrailTab } from './AuditTab';

// Upgrade-specific tabs (merged from subtabs/)
export { OriginalDocumentTab } from './OriginalDocumentTab';
export type { OriginalDocumentInfo } from './OriginalDocumentTab';
export { UpgradeReviewersTab } from './UpgradeReviewersTab';
export { UpgradeApproversTab } from './UpgradeApproversTab';

