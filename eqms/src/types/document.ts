
/**
 * Label of a Document / Revision status as the server names it. The statuses, their order and their codes live in
 * the status lookup tables on the server; the client never lists them.
 */
export type DocumentStatus = string;

/** One step of a Document or Revision lifecycle, as the server defines it. */
export interface WorkflowStep {
  code: string;
  label: string;
  /** The status ends the lifecycle (Obsoleted, Closed - Cancelled). */
  terminal: boolean;
}

/** What a lifecycle stepper shows for one record. Worked out on the server; the screen only draws it. */
export interface WorkflowProgress {
  steps: WorkflowStep[];
  currentStepIndex: number;
  /** Labels of steps the record never went through. */
  skippedSteps: string[];
  /** Label of the step reached when the record ended; empty while it runs or when the history does not say. */
  terminalProgressStep: string;
}

/**
 * Base Document Interface
 * Standardized across all modules (Documents, Training, Tasks, Audit)
 */
export interface Document {
  id: string;               // Database UUID
  documentNumber: string;   // Canonical document code (e.g., SOP-QA-001)
  documentName: string;
  type: string;
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
  /** Lifecycle stepper for this Document, from the server. */
  workflow?: WorkflowProgress;
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
