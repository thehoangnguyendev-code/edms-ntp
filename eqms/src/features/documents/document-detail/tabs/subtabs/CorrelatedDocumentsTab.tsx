import React from "react";
import { ParentDocument } from "./types";
import { RelationDocumentsTable } from "./components/RelationDocumentsTable";

interface CorrelatedDocumentsTabProps {
    correlatedDocuments: ParentDocument[];
    onCorrelatedDocumentsChange: (docs: ParentDocument[]) => void;
}

/** Correlated Documents: the selection is edited elsewhere (modal); this tab only lists it, with server-side search/sort/paging. */
export const CorrelatedDocumentsTab: React.FC<CorrelatedDocumentsTabProps> = ({ correlatedDocuments }) => (
    <RelationDocumentsTable documents={correlatedDocuments} relationType="CORRELATED" />
);
