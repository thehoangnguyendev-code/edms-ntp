import type { OriginalDocumentInfo } from "@/features/documents/document-revisions/workspace-tabs";

export interface RevisionPerson {
  id: string;
  fullName: string;
  username?: string;
  position?: string;
  email?: string;
  department?: string;
  sequenceOrder?: number;
  actionStatus?: string | null;
  actedAt?: string | null;
  actionComment?: string | null;
}

export interface RevisionHistoryItem {
  id: string;
  actionType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  comment?: string | null;
  actedBy?: string | null;
  created?: string | null;
}

export interface RevisionWorkingNoteItem {
  id: string;
  author?: string | null;
  authorUsername?: string | null;
  timestamp?: string | null;
  content: string;
  workflowStage?: string | null;
  workflowStageLabel?: string | null;
  canDelete?: boolean;
}

export interface RevisionReviewCommentItem {
  id: string;
  pageNumber: number;
  positionX: number;
  positionY: number;
  /** Rectangle size (0-1 relative to page). Missing on legacy point-only pins — render as a dot. */
  width?: number | null;
  height?: number | null;
  content: string;
  reviewRound: number;
  snapshotVersionToken?: string | null;
  isStale: boolean;
  status: "OPEN" | "RESOLVED";
  resolutionNote?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  replies: RevisionReviewCommentReplyItem[];
  canReply: boolean;
  canResolve: boolean;
  canEdit: boolean;
  canDelete: boolean;
  attachments: RevisionReviewCommentAttachmentItem[];
}

export interface RevisionReviewCommentReplyItem {
  id: string;
  content: string;
  createdBy?: string | null;
  createdAt?: string | null;
  canEdit: boolean;
  canDelete: boolean;
  attachments: RevisionReviewCommentAttachmentItem[];
}

export interface RevisionReviewCommentAttachmentItem {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface RevisionReviewCommentListResponse {
  comments: RevisionReviewCommentItem[];
  currentReviewRound: number;
  currentSnapshotVersionToken?: string | null;
  openCommentCount: number;
}

export interface RevisionSnapshotHistoryItem {
  id: string;
  reviewRound: number;
  triggerAction: string;
  generatedAt?: string | null;
  generatedByName?: string | null;
}

export interface RevisionSignatureRecord {
  actionBy: string;
  actionByName: string;
  actionOn: string;
  actionOnValue: string;
}

export interface RevisionDetailResponse {
  id: string;
  documentId?: string | null;
  originalDocument?: OriginalDocumentInfo | null;
  documentNumber: string;
  documentName: string;
  displayName?: string | null;
  titleLocalLanguage?: string | null;
  revisionName: string;
  revisionNumber: string;
  status: string;
  statusCode?: string | null;
  statusInfo?: {
    id: string;
    name: string;
    code?: string;
    label?: string;
  } | null;
  type?: string | null;
  businessUnit?: string | null;
  department?: string | null;
  author?: string | null;
  owner?: string | null;
  openedBy?: string | null;
  submittedBy?: string | null;
  submittedByUsername?: string | null;
  created?: string | null;
  submittedOn?: string | null;
  effectiveDate?: string | null;
  validUntil?: string | null;
  reviewDate?: string | null;
  description?: string | null;
  knowledgeBase?: string | null;
  subType?: string | null;
  reviewRequirement?: "NONE" | "SINGLE" | "MULTIPLE" | null;
  periodicReviewCycle?: number | null;
  periodicReviewNotification?: number | null;
  language?: string | null;
  requiresTraining?: boolean;
  trainingPeriodDays?: number | null;
  reasonForSkippingTraining?: string | null;
  trainingPlannedDate?: string | null;
  trainingPeriodEndDate?: string | null;
  trainingCompletionDate?: string | null;
  isTemplate?: boolean;
  lastModifiedDate?: string | null;
  lastModifiedBy?: string | null;
  hasRelatedDocuments?: boolean;
  hasCorrelatedDocuments?: boolean;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  hasPreview?: boolean;
  previewType?: "NONE" | "SOURCE_DOCX" | "REVIEW_PDF" | "REVIEW_SNAPSHOT" | "PUBLISHED_PDF" | null;
  sourceStorageProvider?: string | null;
  sourceStorageBucket?: string | null;
  sourceStorageObjectKey?: string | null;
  sourceStorageVersionId?: string | null;
  sourceFileChecksum?: string | null;
  sourceUploadedAt?: string | null;
  publishedBy?: string | null;
  publishedOn?: string | null;
  coAuthors?: RevisionPerson[];
  reviewers?: RevisionPerson[];
  approvers?: RevisionPerson[];
  signatures?: RevisionSignatureRecord[];
  relatedDocuments?: any[];
  correlatedDocuments?: any[];
  workingNotes?: RevisionWorkingNoteItem[];
  workingNotesEditable?: boolean;
  workingNotesStage?: string | null;
  history?: RevisionHistoryItem[];
  storageProvider?: string | null;
  storageSiteId?: string | null;
  storageDriveId?: string | null;
  storageItemId?: string | null;
  storageWebUrl?: string | null;
  storageEditUrl?: string | null;
  storageViewUrl?: string | null;
  storagePdfUrl?: string | null;
  storageSyncStatus?: string | null;
  storageLastSyncedAt?: string | null;
  officeOnlineEverSynced?: boolean;
  canEditFileOnline?: boolean;
  canCompleteEditing?: boolean;
  canOpenPublishingWorkspace?: boolean;
  canReviewRevision?: boolean;
  canApproveRevision?: boolean;
  canCompleteTraining?: boolean;
  canPublishRevision?: boolean;
  canRequestControlledCopy?: boolean;
  editingStatus?: string | null;
  sourceLocked?: boolean;
  snapshotStatus?: 'GENERATING' | 'READY' | 'FAILED' | null;
  snapshotError?: string | null;
  message?: string | null;
  previewVersionToken?: string | null;
  previewStatus?: "NONE" | "GENERATING" | "READY" | "FAILED" | null;
  previewError?: string | null;
  previewLastGeneratedAt?: string | null;
  reviewSnapshotVersionToken?: string | null;
  publishingPreviewVersionToken?: string | null;
  publishedPdfVersionToken?: string | null;
}
