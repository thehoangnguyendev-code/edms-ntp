export * from './documentTypes';

/**
 * Global Document Statuses
 * Follows the standard document lifecycle: Draft -> Review -> Approval -> Training -> Effective -> Obsoleted
 */
export type DocumentStatus = 
  | "Draft" 
  | "Active"
  | "Pending Review" 
  | "Pending Approval" 
  | "Approved" 
  | "Pending Training" 
  | "Ready for Publishing" 
  | "Published" 
  | "Effective" 
  | "Archive"
  | "Obsoleted"
  | "Closed - Cancelled";

/**
 * Base Document Interface
 * Standardized across all modules (Documents, Training, Tasks, Audit)
 */
export interface Document {
  id: string;               // Database UUID
  documentNumber: string;   // Canonical document code (e.g., SOP-QA-001)
  documentName: string;
  type: DocumentType | string;
  status: DocumentStatus;
  department: string;
  businessUnit?: string;
  owner: string;            // Username or User ID of the owner
  author: string;           // Username or User ID of the author
  effectiveDate?: string;
  validUntil?: string;
  createdDate: string;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
  description?: string;
  knowledgeBase?: string;
  statusCode?: string;
  statusInfo?: {
    id: string;
    name: string;
  };
}

/** Specialized shape for document lists/summaries */
export type DocumentSummary = Pick<Document, "id" | "documentNumber" | "documentName" | "type" | "status" | "effectiveDate"> & {
  displayLabel?: string;
};

/** Filter interface for document queries */
export interface DocumentFilters {
  search?: string;
  status?: DocumentStatus | "All";
  type?: string | "All";
  department?: string | "All";
  businessUnit?: string | "All";
  dateFrom?: string;
  dateTo?: string;
  owner?: string;
}
