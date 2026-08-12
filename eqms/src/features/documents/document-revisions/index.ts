/**
 * Document Revisions Module
 * 
 * Contains views and components for document revision management.
 */

// List Views
export { RevisionListView } from './views/RevisionListView';
export { RevisionsOwnedByMeView } from './views/RevisionsOwnedByMeView';
export { PendingDocumentsView } from './views/PendingDocumentsView';
export { DetailRevisionView } from './detail-revision/DetailRevisionView';

// Revision Creation & Workspace
export { NewRevisionView } from './views/NewRevisionEntryViews';
export { RevisionCreateView } from './views/RevisionCreateView';

// Review & Approval
export { RevisionReviewView } from './review-revision/RevisionReviewView';
export { RevisionApprovalView } from './approval-revision/RevisionApprovalView';
export { RevisionTrainingView } from './training-revision/RevisionTrainingView';

// Controlled Copy
export { RequestControlledCopyView } from './views/RequestControlledCopyView';

// Tabs
export * from './workspace-tabs';

// Local revision view types
export type { Revision, RelatedDocument, CorrelatedDocument } from './views/types';
