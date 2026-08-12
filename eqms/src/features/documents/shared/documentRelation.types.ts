import type { DocumentSummary } from "@/types";

export interface DocumentRelationBase extends Omit<DocumentSummary, "documentName" | "type" | "status"> {
  created?: string;
  openedBy?: string;
  department?: string;
  author?: string;
  authorCoAuthor?: string;
  validUntil?: string;
  reviewDate?: string;
  revisionNumber?: string;
  version?: string;
  displayLabel?: string;
  documentName?: string;
  type?: string;
  state?: string;
  status?: string;
  correlationType?: string;
  relationType?: string;
}
