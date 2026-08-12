export type ControlledCopyStatus =
  | "Ready for Distribution"
  | "Distributed"
  | "Obsoleted"
  | "Closed - Cancelled";

export type CurrentStage =
  | "Ready for Distribution"
  | "Distributed"
  | "Obsoleted"
  | "Closed - Cancelled";

export interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  locked?: boolean;
}

export interface ControlledCopy {
  id: string;
  controlledCopyNumber: string;
  createdDate: string;
  createdTime: string;
  openedBy: string;
  name: string;
  status: ControlledCopyStatus;
  validUntil: string;
  expiryDate?: string;
  hasExpiryDate?: boolean;
  expiryReminderSentAt?: string;
  documentNumber: string;
  distributionList?: string;
  distributionRecipients?: string;
  statusCode?: string;
  statusInfo?: {
    id: string;
    name: string;
  };
  distributionMode?: string;
  distributionScope?: string;
  externalRecipients?: string;
  revisionNumber: string;
  revisionName?: string;
  documentName?: string;
  location?: string;
  locationCode?: string;
  businessUnit?: string;
  department?: string;
  reason?: string;
  documentDisplayLabel?: string;
  distributedDate?: string;
  distributedBy?: string;
  recipientName?: string;
  distributionComment?: string;
  recipientSignature?: string;
  recipientDate?: string;
  recallDate?: string;
  recalledBy?: string;
  recallReason?: string;
  destroyedBy?: string;
  destroyedDate?: string;
  destroyReason?: string;
  obsoleteReason?: string;
  destructionMethod?: string;
  destructionType?: string;
  witnessedBy?: string;
  evidenceFiles?: ControlledCopyEvidenceFile[];
  controlNumber?: string;
  documentId?: string;
  sourceRevisionId?: string;
  copyNumber?: number;
  totalCopies?: number;
  requestDate?: string;
  requestedBy?: string;
  currentStage?: CurrentStage;
  effectiveDate?: string;
  printedDate?: string;
  printedBy?: string;
  distributionBatchId?: string;
  distributionBatchNumber?: string;
  copyIds?: string[];
  replacedControlledCopyId?: string;
  replacedControlledCopyNumber?: string;
  replacementControlledCopyId?: string;
  replacementControlledCopyNumber?: string;
}

export interface ControlledCopyEvidenceFile {
  id: string;
  fileName: string;
  contentType?: string;
  fileSize?: number;
  uploadedBy?: string;
  uploadedAt?: string;
  downloadUrl?: string;
  originalFileName?: string;
  originalContentType?: string;
  originalFileSize?: number;
  originalSha256?: string;
  watermarkedSha256?: string;
  watermarked?: boolean;
}

export interface ControlledCopyDistributionBatch {
  id: string;
  batchNumber: string;
  controlledCopyNumber?: string;
  controlledCopyName?: string;
  primaryControlledCopyId?: string;
  documentId?: string;
  documentNumber: string;
  documentTitle?: string;
  documentDisplayLabel?: string;
  revisionNumber?: string;
  sourceRevisionId?: string;
  validUntil?: string;
  expiryDate?: string;
  hasExpiryDate?: boolean;
  quantity: number;
  readyCount?: number;
  distributedCount?: number;
  status?: string;
  statusCode?: string;
  statusInfo?: {
    id?: string;
    name?: string;
  };
  currentStage?: string;
  distributionList?: string;
  distributionRecipients?: string;
  distributionScope?: string;
  location?: string;
  locationCode?: string;
  requestedBy?: string;
  requestedAt?: string;
  distributedBy?: string;
  distributedAt?: string;
  recallDate?: string;
  recallReason?: string;
  externalRecipients?: string;
  copyIds?: string[];
}
