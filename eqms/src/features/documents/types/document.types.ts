/**
 * Core Document Types
 * 
 * Shared type definitions used across the documents feature.
 */

import { 
  Document as GlobalDocument, 
  DocumentStatus, 
  DocumentType,
  DocumentSummary,
  User 
} from '@/types';

export type { DocumentStatus, DocumentType };
export { DOCUMENT_TYPES, DOCUMENT_TYPE_CODES, DOCUMENT_TYPE_LABELS } from '@/types/documentTypes';

// View type for document lists
export type DocumentViewType = "all" | "owned-by-me";

// Table column configuration
export interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  locked?: boolean;
}

/** 
 * Feature-specific Document Interface
 * Extends global document with UI-specific flags or legacy support if needed
 */
export interface Document extends GlobalDocument {
  hasRelatedDocuments?: boolean;
  openedBy: string; // User who opened/is viewing the doc in current session
}

// Uploaded file type
export interface UploadedFile {
  file: File;
  id: string;
  name: string;
  size: string;
  type: string;
  previewUrl?: string;
}

// Parent/Related document types
export interface ParentDocument extends DocumentSummary {}

export interface RelatedDocument extends DocumentSummary {
  relationshipType: 'reference' | 'supersedes' | 'child';
}

// Batch document for navigation
export interface BatchDocument {
  id: string;
  name: string;
  status: 'pending' | 'completed' | 'current';
}

// Controlled copy request
export interface ControlledCopyRequest {
  documentId: string;
  documentNumber?: string;
  sourceRevisionId?: string;
  locationId: string;
  locationName: string;
  reason: string;
  quantity: number;
  signature: string;
}

// ─── Document Detail (superset used by detail views) ─────────────────────────

/** Shared document-detail shape. Extends global Document. */
export interface DocumentDetail extends GlobalDocument {
  openedBy: string;
  reviewers: string[];
  approvers: string[];
  lastModifiedBy: string;
  isTemplate: boolean;
  titleLocalLanguage?: string;
  periodicReviewCycle: number;
  periodicReviewNotification: number;
  language: string;
  subType: string;
}

// ─── Revision Detail (extends DocumentDetail for revision-specific views) ────

export interface RevisionDetail extends DocumentDetail {
  coAuthors?: string[];
  documentType?: "Document" | "Revision";
  previousVersion?: string;
}

// ─── Reviewer / Approver ─────────────────────────────────────────────────────

export type ReviewStatus = "pending" | "approved" | "rejected" | "completed";

export interface Reviewer extends Pick<User, 'id' | 'fullName' | 'username' | 'position' | 'email' | 'department'> {
  order: number;
  status?: ReviewStatus;
  reviewDate?: string;
  comments?: string;
  signedOn?: string;
  actedAt?: string | null;
  actionStatus?: string | null;
  actionComment?: string | null;
}

export interface Approver extends Pick<User, 'id' | 'fullName' | 'username' | 'position' | 'email' | 'department'> {
  status?: string;
  approvalDate?: string;
  comments?: string;
  signedOn?: string;
  actedAt?: string | null;
  actionStatus?: string | null;
  actionComment?: string | null;
}

export type ReviewFlowType = "sequential" | "parallel";
