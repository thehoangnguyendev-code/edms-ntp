/**
 * New Document Tabs
 * 
 * Tab components for new document creation workflow.
 * All tabs are owned locally by document-list flow.
 */

// Document-specific tabs (kept separate due to different functionality)
export { DocumentTab, type UploadedFile } from './DocumentTab';
export { GeneralTab, type GeneralTabFormData } from './GeneralTab';
export { TrainingTab, type TrainingConfig } from './TrainingTab';
export { SignaturesTab } from './SignaturesTab';
export { AuditTab, type AuditEntry } from './AuditTab';

// New-document local subtabs
export {
  DocumentRevisionsTab,
  ReviewersTab,
  ApproversTab,
  ControlledCopiesTab,
  RelatedDocumentsTab,
  CorrelatedDocumentsTab,
  DocumentRelationships,
} from './subtabs';

export type {
  Revision,
  ParentDocument,
  RelatedDocument,
  Reviewer,
  Approver,
  ReviewFlowType,
  ControlledCopy,
  Knowledge,
} from './subtabs';

