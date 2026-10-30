import React from "react";
import type { ParentDocument } from "./types";
import { RelationDocumentsTable } from "@/features/documents/document-detail/tabs/subtabs/components/RelationDocumentsTable";

interface CorrelatedDocumentsTabProps {
    correlatedDocuments: ParentDocument[];
    onCorrelatedDocumentsChange: (docs: ParentDocument[]) => void;
}

/** Only selected IDs are sent; the server owns search, sort and paging. */
export const CorrelatedDocumentsTab: React.FC<CorrelatedDocumentsTabProps> = ({ correlatedDocuments }) => (
    <RelationDocumentsTable documents={correlatedDocuments} relationType="CORRELATED" />
);
