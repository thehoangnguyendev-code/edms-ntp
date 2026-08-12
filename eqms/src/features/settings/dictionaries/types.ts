/**
 * Dictionaries Types
 *
 * Single source of truth for all dictionary/lookup-table entity types.
 */
import type { ElementType } from 'react';

// ─── Navigation ───────────────────────────────────────────────────────────────
export type DictionaryType =
  | "business-units"
  | "document-types"
  | "sub-types"
  | "departments"
  | "positions"
  | "storage-locations"
  | "retention-policies";

export interface Dictionary {
  id: DictionaryType;
  label: string;
  icon?: ElementType;
}

// ─── Business Unit ───────────────────────────────────────────────────────────
export interface BusinessUnitItem {
  id: string;
  name: string;
  abbreviation: string;
  description?: string;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

// ─── Department ──────────────────────────────────────────────────────────────
export type BusinessUnit = "Corporate" | "Operations" | "Quality" | "Research";


export interface DepartmentItem {
  id: string;
  name: string;
  abbreviation: string;
  businessUnit: BusinessUnit;
  description?: string;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

// ─── Position ────────────────────────────────────────────────────────────────
export interface PositionItem {
  id: string;
  name: string;
  abbreviation?: string;
  businessUnit: BusinessUnit;
  department: string;
  description?: string;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

// ─── Document Type ───────────────────────────────────────────────────────────
export interface DocumentTypeItem {
  id: string;
  name: string;
  description?: string;
  shortCode: string;
  currentSequence: number;
  lastIssuedDocumentNumber?: string | null;
  nextDocumentNumber?: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

// â”€â”€â”€ Document Sub-Type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface DocumentSubTypeItem {
  id: string;
  name: string;
  documentTypeId: string;
  documentType: string;
  description?: string;
  reviewRequirement: "NONE" | "SINGLE" | "MULTIPLE";
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

// ─── Retention Policy ────────────────────────────────────────────────────────
export interface RetentionPolicyItem {
  id: string;
  name: string;
  description?: string;
  /** Omitted for a permanent policy. */
  retentionDays?: number | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

// ─── Storage Location ────────────────────────────────────────────────────────
export interface StorageLocationItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}
