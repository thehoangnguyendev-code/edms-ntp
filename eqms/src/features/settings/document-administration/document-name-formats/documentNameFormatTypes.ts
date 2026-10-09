export interface DocumentComponentItem {
  id: string;
  name: string;
  value: string;
  shortDescription?: string | null;
  sourceTable: "DOCUMENT" | "REVISION" | "USER" | "FREE_TEXT";
  sourceField?: string | null;
  freeText?: string | null;
  systemDefined: boolean;
  isActive: boolean;
  displayOrder: number;
  createdDate: string;
  modifiedDate: string;
  sampleValue: string;
}

export interface DocumentComponentFormData {
  name: string;
  shortDescription: string;
  freeText: string;
  isActive: boolean;
  displayOrder?: number;
}

export interface DocumentNameFormatComponentRef {
  componentId: string;
  name: string;
  value: string;
  displayOrder: number;
}

export interface DocumentNameFormatItem {
  id: string;
  name: string;
  separator: string;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
  components: DocumentNameFormatComponentRef[];
  previewExample: string;
  /** Whether this format can be assigned as a Document Type's real Document Number Format. */
  eligibleForDocumentNumber: boolean;
}

export interface DocumentNameFormatFormData {
  name: string;
  separator: string;
  description: string;
  isActive: boolean;
  components: { componentId: string; displayOrder: number }[];
}
