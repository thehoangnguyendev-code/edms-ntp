/**
 * Document Type Definitions for Controlled Document Business Process
 * 
 * These are all the document templates enabled for the controlled document workflow.
 * Note: Full names must be used - no abbreviations allowed.
 */

export type DocumentType =
  | "Policy"
  | "Quality Manual"
  | "Site Master File"
  | "Standard Operating Procedure"
  | "Working Instruction"
  | "Forms"
  | "Annex"
  | "User Requirement Specification"
  | "Design Qualification Protocol and Report"
  | "Factory Acceptance Testing/Site Acceptance Testing Protocol and Report"
  | "Qualification Protocol and Report"
  | "Process Validation Protocol and Report"
  | "Cleaning Validation Protocol and Report"
  | "Guidelines";

/**
 * Document Type Display Labels (for backwards compatibility with existing code)
 */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  "Policy": "Policy",
  "Quality Manual": "Quality Manual",
  "Site Master File": "Site Master File",
  "Standard Operating Procedure": "Standard Operating Procedure",
  "Working Instruction": "Working Instruction",
  "Forms": "Forms",
  "Annex": "Annex",
  "User Requirement Specification": "User Requirement Specification",
  "Design Qualification Protocol and Report": "Design Qualification Protocol and Report",
  "Factory Acceptance Testing/Site Acceptance Testing Protocol and Report": "FAT/SAT Protocol and Report",
  "Qualification Protocol and Report": "Qualification Protocol and Report",
  "Process Validation Protocol and Report": "Process Validation Protocol and Report",
  "Cleaning Validation Protocol and Report": "Cleaning Validation Protocol and Report",
  "Guidelines": "Guidelines"
};

/**
 * Document Type Abbreviations (for document code generation XXX.YYYY.AA)
 */
export const DOCUMENT_TYPE_CODES: Record<DocumentType, string> = {
  "Policy": "POL",
  "Quality Manual": "QM",
  "Site Master File": "SMF",
  "Standard Operating Procedure": "SOP",
  "Working Instruction": "WI",
  "Forms": "FORM",
  "Annex": "ANNEX",
  "User Requirement Specification": "URS",
  "Design Qualification Protocol and Report": "DQ",
  "Factory Acceptance Testing/Site Acceptance Testing Protocol and Report": "FATSAT",
  "Qualification Protocol and Report": "QP",
  "Process Validation Protocol and Report": "PV",
  "Cleaning Validation Protocol and Report": "CV",
  "Guidelines": "GUIDE"
};

/**
 * All available document types as array (for dropdowns/selects)
 */
export const DOCUMENT_TYPES: DocumentType[] = [
  "Policy",
  "Quality Manual",
  "Site Master File",
  "Standard Operating Procedure",
  "Working Instruction",
  "Forms",
  "Annex",
  "User Requirement Specification",
  "Design Qualification Protocol and Report",
  "Factory Acceptance Testing/Site Acceptance Testing Protocol and Report",
  "Qualification Protocol and Report",
  "Process Validation Protocol and Report",
  "Cleaning Validation Protocol and Report",
  "Guidelines"
];
