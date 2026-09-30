interface DocumentRelations {
  relatedDocuments?: readonly unknown[];
  correlatedDocuments?: readonly unknown[];
}

const hasRelations = (row: DocumentRelations) =>
  Boolean(row.relatedDocuments?.length || row.correlatedDocuments?.length);

/** Use list-response metadata; never fetch every row just to decide whether to show a chevron. */
export const hasDocumentExpansion = (row: DocumentRelations & { hasAnyRevision?: boolean }) =>
  row.hasAnyRevision === true || hasRelations(row);

/** The parent Document is also displayed in ExpandedDocumentRow. */
export const hasRevisionExpansion = (row: DocumentRelations & { documentId?: string | null }) =>
  Boolean(row.documentId?.trim()) || hasRelations(row);

export const hasControlledCopyExpansion = (row: {
  batchId?: string;
  distributionBatchId?: string;
  batchQuantity?: number;
  copyIds?: readonly string[];
}) => {
  // totalCopies belongs to an individual copy's issuance metadata; it is not a child count.
  const quantity = row.batchQuantity ?? row.copyIds?.length ?? 0;
  return Boolean(row.batchId || row.distributionBatchId)
    && Number.isFinite(quantity) && quantity > 1;
};
