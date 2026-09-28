/**
 * Dictionaries Types
 *
 * Single source of truth for all dictionary/lookup-table entity types.
 */
import type { ElementType } from 'react';

// ─── Navigation ───────────────────────────────────────────────────────────────
export type DictionaryType =
  | "business-units"
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
  departmentHeadId?: string | null;
  departmentHeadName?: string | null;
  /** Auto-filled from the selected Department Head's phone number when set in the modal, but
   *  stored as its own editable field (not a live join) so it can be overridden. */
  primaryContactPhone?: string | null;
}

// ─── Position ────────────────────────────────────────────────────────────────
export interface PositionItem {
  id: string;
  name: string;
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
  /** Document Name Format used to generate this type's document numbers (Phase 2). */
  nameFormatId?: string | null;
  nameFormatName?: string | null;
}

// Document Sub-Type 
export interface DocumentSubTypeItem {
  id: string;
  name: string;
  documentTypeId: string;
  documentType: string;
  description?: string;
  reviewRequirement: "NONE" | "REQUIRED";
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
