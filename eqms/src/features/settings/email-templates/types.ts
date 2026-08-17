// Email Templates Type Definitions

export type EmailTemplateType =
  | "password-reset"
  | "user-welcome"
  | "account-activation"
  | "document-review"
  | "document-approval"
  | "document-publish"
  | "training-notification"
  | "audit-notification"
  | "controlled-copy-notification"
  | "controlled-copy-distribution-notification"
  | "controlled-copy-cancellation-notification"
  | "controlled-copy-recall-notification"
  | "preference-notification"
  | "report-generation"
  | "system-maintenance"
  | "custom";

export type EmailTemplateStatus = "Active" | "Inactive" | "Draft";

export interface EmailVariable {
  key: string;
  label: string;
  description: string;
  example: string;
  category: "user" | "system" | "document" | "url" | "date" | "workflow" | "preference" | "custom";
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  subject: string;
  content: string;
  status: EmailTemplateStatus;
  variables: string[];
  logoUrl?: string;
  logoFileName?: string;
  copyright?: string;
  contactEmail?: string;
  primaryColor?: string;
  fontFamily?: string;
  createdBy: string;
  createdDate: string;
  updatedBy?: string;
  updatedDate?: string;
  lastUsed?: string;
  usageCount: number;
  latestVersionNumber?: number;
  description?: string;
}

/** Payload for creating/updating email template */
export interface EmailTemplatePayload {
  name: string;
  type: EmailTemplateType;
  subject: string;
  content: string;
  status: EmailTemplateStatus;
  variables: string[];
  logoUrl?: string;
  logoFileName?: string;
  copyright?: string;
  contactEmail?: string;
  primaryColor?: string;
  fontFamily?: string;
  description?: string;
  /** Electronic-signature reason captured when creating the template (audit trail). */
  reason?: string;
  signatureToken?: string;
}

export interface EmailTemplateListParams {
  search?: string;
  type?: EmailTemplateType | "All";
  status?: EmailTemplateStatus | "All";
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface EmailTemplateListResponse<T = EmailTemplate> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EmailTemplatePreviewPayload {
  variables?: Record<string, string>;
}

export interface EmailTemplateTestSendPayload {
  to: string;
  variables?: Record<string, string>;
}

export interface EmailTemplatePreviewResponse {
  id?: string | null;
  name: string;
  type: EmailTemplateType;
  subject: string;
  content: string;
  status: EmailTemplateStatus;
  variables: string[];
  description?: string;
  logoUrl?: string;
  logoFileName?: string;
  copyright?: string;
  contactEmail?: string;
  primaryColor?: string;
  usageCount?: number;
  lastUsed?: string;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
  latestVersionNumber?: number;
}

export interface EmailTemplatePreviewDraftPayload extends EmailTemplatePayload {
  sampleVariables?: Record<string, string>;
}

export interface EmailTemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  name: string;
  type: EmailTemplateType;
  subject: string;
  content: string;
  status: EmailTemplateStatus;
  variables: string[];
  description?: string;
  logoUrl?: string;
  logoFileName?: string;
  copyright?: string;
  contactEmail?: string;
  changeSummary?: string;
  createdBy?: string;
  createdAt: string;
  publishedBy?: string;
  publishedAt?: string;
}

export interface EmailTemplatePublishPayload {
  changeSummary?: string;
}

export interface EmailTemplateRestoreVersionPayload {
  changeSummary?: string;
}

/** Table column configuration for email templates */
export interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  locked?: boolean;
}
