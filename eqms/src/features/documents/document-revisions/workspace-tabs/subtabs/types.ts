// Shared types for subtabs
import { User, DocumentSummary } from '@/types';
import type { DocumentRelationBase } from "@/features/documents/shared/documentRelation.types";

// Document Revisions
export interface Revision {
    id: string;
    revisionNumber: string;
    created: string;
    openedBy: string;
    revisionName: string;
    status: "draft" | "pendingReview" | "approved" | "effective" | "obsolete";
}

// Document Relationships
export interface ParentDocument extends DocumentRelationBase {}

export interface RelatedDocument extends DocumentRelationBase {}

// Reviewers & Approvers
export interface Reviewer extends Pick<User, 'id' | 'fullName' | 'username' | 'position' | 'email' | 'department'> {
    order: number;
}

export interface Approver extends Pick<User, 'id' | 'fullName' | 'username' | 'position' | 'email' | 'department'> {}

export type ReviewFlowType = 'sequential' | 'parallel';

// Controlled Copies
export interface ControlledCopy {
    id: string;
    controlledCopiesName: string;
    copyNumber: string;
    created: string;
    status: "draft" | "pendingReview" | "approved" | "effective" | "obsolete";
    openedBy: string;
    validUntil: string;
    documentRevision: string;
    documentNumber: string;
}

// Knowledge Base
export interface Knowledge {
    id: string;
    title: string;
    category: string;
    tags: string[];
    dateAdded: string;
}
