import React from "react";
import { RelatedDocument } from "./types";
import { RelationDocumentsTable } from "./components/RelationDocumentsTable";

interface RelatedDocumentsTabProps {
    relatedDocuments: RelatedDocument[];
    onRelatedDocumentsChange: (docs: RelatedDocument[]) => void;
}

/** Related Documents: the selection is edited elsewhere (modal); this tab only lists it, with server-side search/sort/paging. */
export const RelatedDocumentsTab: React.FC<RelatedDocumentsTabProps> = ({ relatedDocuments }) => (
    <RelationDocumentsTable documents={relatedDocuments} relationType="RELATED" />
);
