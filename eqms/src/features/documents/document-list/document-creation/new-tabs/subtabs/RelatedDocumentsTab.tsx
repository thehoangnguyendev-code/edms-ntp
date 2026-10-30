import React from "react";
import type { RelatedDocument } from "./types";
import { RelationDocumentsTable } from "@/features/documents/document-detail/tabs/subtabs/components/RelationDocumentsTable";

interface RelatedDocumentsTabProps {
    relatedDocuments: RelatedDocument[];
    onRelatedDocumentsChange: (docs: RelatedDocument[]) => void;
}

/** Only selected IDs are sent; the server owns search, sort and paging. */
export const RelatedDocumentsTab: React.FC<RelatedDocumentsTabProps> = ({ relatedDocuments }) => (
    <RelationDocumentsTable documents={relatedDocuments} relationType="RELATED" />
);
